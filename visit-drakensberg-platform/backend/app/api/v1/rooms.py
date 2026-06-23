from uuid import UUID, uuid4
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_supplier
from app.models.user import User
from app.models.supplier import Supplier
from app.models.listing import Listing

router = APIRouter(prefix="/rooms", tags=["rooms"])

_rooms: list[dict] = []


class RoomCreate(BaseModel):
    listing_id: UUID
    name: str
    description: Optional[str] = None
    max_guests: int = 2
    price_per_night: float
    amenities: List[str] = []


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_guests: Optional[int] = None
    price_per_night: Optional[float] = None
    amenities: Optional[List[str]] = None
    is_available: Optional[bool] = None


async def _get_supplier(user: User, db: AsyncSession) -> Supplier:
    result = await db.execute(select(Supplier).where(Supplier.user_id == user.id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


async def _assert_listing_owner(listing_id: UUID, supplier: Supplier, db: AsyncSession):
    result = await db.execute(
        select(Listing).where(Listing.id == listing_id, Listing.supplier_id == supplier.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Listing not yours")


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_room(
    payload: RoomCreate,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    supplier = await _get_supplier(current_user, db)
    await _assert_listing_owner(payload.listing_id, supplier, db)
    room = {
        "id": str(uuid4()),
        "listing_id": str(payload.listing_id),
        "name": payload.name,
        "description": payload.description,
        "max_guests": payload.max_guests,
        "price_per_night": payload.price_per_night,
        "amenities": payload.amenities,
        "is_available": True,
        "images": [],
        "supplier_id": str(current_user.id),
    }
    _rooms.append(room)
    return room


@router.get("/")
async def list_rooms(listing_id: UUID):
    """Public — get all rooms for a listing."""
    return [r for r in _rooms if r["listing_id"] == str(listing_id)]


@router.put("/{room_id}")
async def update_room(
    room_id: str,
    payload: RoomUpdate,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    room = next((r for r in _rooms if r["id"] == room_id), None)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your room")
    for field, value in payload.model_dump(exclude_none=True).items():
        room[field] = value
    return room


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    room_id: str,
    current_user: User = Depends(get_current_supplier),
):
    global _rooms
    room = next((r for r in _rooms if r["id"] == room_id), None)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your room")
    _rooms = [r for r in _rooms if r["id"] != room_id]
