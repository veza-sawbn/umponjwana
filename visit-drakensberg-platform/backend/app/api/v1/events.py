from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import get_current_supplier
from app.models.user import User

router = APIRouter(prefix="/events", tags=["events"])

_events: list[dict] = []


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: str = "event"  # event | special
    location: Optional[str] = None
    starts_at: datetime
    ends_at: Optional[datetime] = None
    ticket_price: float
    total_tickets: Optional[int] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    location: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    ticket_price: Optional[float] = None
    total_tickets: Optional[int] = None
    is_published: Optional[bool] = None


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate,
    current_user: User = Depends(get_current_supplier),
):
    event = {
        "id": str(uuid4()),
        "supplier_id": str(current_user.id),
        "title": payload.title,
        "description": payload.description,
        "event_type": payload.event_type,
        "location": payload.location,
        "starts_at": payload.starts_at.isoformat(),
        "ends_at": payload.ends_at.isoformat() if payload.ends_at else None,
        "ticket_price": payload.ticket_price,
        "total_tickets": payload.total_tickets,
        "tickets_sold": 0,
        "images": [],
        "is_published": True,
    }
    _events.append(event)
    return event


@router.get("/")
async def list_events(event_type: Optional[str] = None):
    """Public — list published events."""
    events = [e for e in _events if e["is_published"]]
    if event_type:
        events = [e for e in events if e["event_type"] == event_type]
    return events


@router.get("/mine")
async def list_my_events(current_user: User = Depends(get_current_supplier)):
    return [e for e in _events if e["supplier_id"] == str(current_user.id)]


@router.put("/{event_id}")
async def update_event(
    event_id: str,
    payload: EventUpdate,
    current_user: User = Depends(get_current_supplier),
):
    event = next((e for e in _events if e["id"] == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your event")
    updates = payload.model_dump(exclude_none=True)
    for field in ("starts_at", "ends_at"):
        if field in updates and updates[field]:
            updates[field] = updates[field].isoformat()
    event.update(updates)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user: User = Depends(get_current_supplier),
):
    global _events
    event = next((e for e in _events if e["id"] == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your event")
    _events = [e for e in _events if e["id"] != event_id]


@router.post("/{event_id}/tickets")
async def purchase_ticket(event_id: str, quantity: int = 1):
    """Public — purchase tickets for an event."""
    event = next((e for e in _events if e["id"] == event_id and e["is_published"]), None)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["total_tickets"] is not None:
        remaining = event["total_tickets"] - event["tickets_sold"]
        if quantity > remaining:
            raise HTTPException(status_code=400, detail=f"Only {remaining} tickets remaining")
    event["tickets_sold"] += quantity
    return {"message": f"{quantity} ticket(s) purchased", "event_id": event_id}
