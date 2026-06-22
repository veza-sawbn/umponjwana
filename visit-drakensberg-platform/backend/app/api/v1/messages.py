from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.email_service import send_email

router = APIRouter(prefix="/messages", tags=["messages"])


class MessageCreate(BaseModel):
    listing_id: UUID
    supplier_id: UUID
    body: str


class MessageReply(BaseModel):
    body: str


class MessageResponse(BaseModel):
    id: UUID
    listing_id: UUID
    guest_id: UUID
    supplier_id: UUID
    body: str
    direction: str  # "guest_to_supplier" | "supplier_to_guest"
    created_at: datetime
    is_read: bool

    class Config:
        from_attributes = True


# In-memory store (replace with DB model in production)
_messages: list[dict] = []


@router.post("/", status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: MessageCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Guest sends a message to a supplier about a listing."""
    msg = {
        "id": str(uuid4()),
        "listing_id": str(payload.listing_id),
        "guest_id": str(current_user.id),
        "supplier_id": str(payload.supplier_id),
        "body": payload.body,
        "direction": "guest_to_supplier",
        "created_at": datetime.utcnow().isoformat(),
        "is_read": False,
        "guest_name": current_user.full_name or current_user.email,
        "guest_email": current_user.email,
    }
    _messages.append(msg)

    # Email notification to supplier
    background_tasks.add_task(
        _notify_supplier_email,
        supplier_id=str(payload.supplier_id),
        guest_name=msg["guest_name"],
        body=payload.body,
        db=db,
    )

    return msg


@router.get("/inbox")
async def get_supplier_inbox(
    current_user: User = Depends(get_current_user),
):
    """Supplier retrieves all messages sent to them."""
    inbox = [m for m in _messages if m["supplier_id"] == str(current_user.id)]
    # Sort unread first, then by date desc
    inbox.sort(key=lambda m: (m["is_read"], m["created_at"]), reverse=False)
    return inbox


@router.get("/sent")
async def get_guest_sent(
    current_user: User = Depends(get_current_user),
):
    """Guest retrieves messages they sent."""
    sent = [m for m in _messages if m["guest_id"] == str(current_user.id)]
    sent.sort(key=lambda m: m["created_at"], reverse=True)
    return sent


@router.post("/{message_id}/reply", status_code=status.HTTP_201_CREATED)
async def reply_to_message(
    message_id: str,
    payload: MessageReply,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Supplier replies to a guest message."""
    original = next((m for m in _messages if m["id"] == message_id), None)
    if not original:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if original["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your message")

    # Mark original as read
    original["is_read"] = True

    reply_msg = {
        "id": str(uuid4()),
        "listing_id": original["listing_id"],
        "guest_id": original["guest_id"],
        "supplier_id": str(current_user.id),
        "body": payload.body,
        "direction": "supplier_to_guest",
        "created_at": datetime.utcnow().isoformat(),
        "is_read": False,
        "supplier_name": current_user.full_name or current_user.email,
    }
    _messages.append(reply_msg)

    # Email notification to guest
    background_tasks.add_task(
        _notify_guest_email,
        guest_id=original["guest_id"],
        supplier_name=reply_msg["supplier_name"],
        body=payload.body,
        db=db,
    )

    return reply_msg


@router.put("/{message_id}/read")
async def mark_message_read(
    message_id: str,
    current_user: User = Depends(get_current_user),
):
    msg = next((m for m in _messages if m["id"] == message_id), None)
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if msg["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your message")
    msg["is_read"] = True
    return {"message": "Marked as read"}


async def _notify_supplier_email(supplier_id: str, guest_name: str, body: str, db: AsyncSession):
    result = await db.execute(select(User).where(User.id == UUID(supplier_id)))
    supplier = result.scalar_one_or_none()
    if supplier and supplier.email:
        try:
            await send_email(
                to_email=supplier.email,
                subject=f"New message from {guest_name} — Visit Drakensberg",
                html_content=f"""
                <p>Hi,</p>
                <p>You have a new message from <strong>{guest_name}</strong>:</p>
                <blockquote style="border-left:3px solid #C9A96E;padding-left:12px;color:#555">{body}</blockquote>
                <p><a href="https://visitdrakensberg.com/supplier" style="color:#4A7251">Reply in your dashboard →</a></p>
                """,
            )
        except Exception:
            pass


async def _notify_guest_email(guest_id: str, supplier_name: str, body: str, db: AsyncSession):
    result = await db.execute(select(User).where(User.id == UUID(guest_id)))
    guest = result.scalar_one_or_none()
    if guest and guest.email:
        try:
            await send_email(
                to_email=guest.email,
                subject=f"Reply from {supplier_name} — Visit Drakensberg",
                html_content=f"""
                <p>Hi,</p>
                <p><strong>{supplier_name}</strong> replied to your enquiry:</p>
                <blockquote style="border-left:3px solid #C9A96E;padding-left:12px;color:#555">{body}</blockquote>
                <p><a href="https://visitdrakensberg.com/dashboard" style="color:#4A7251">View in your dashboard →</a></p>
                """,
            )
        except Exception:
            pass
