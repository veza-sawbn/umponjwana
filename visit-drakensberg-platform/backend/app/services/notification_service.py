from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.notification import Notification
from app.models.booking import Booking
from app.models.listing import Listing
from app.models.supplier import Supplier


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    body: str,
    notification_type: str,
    data: Optional[dict[str, Any]] = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        body=body,
        type=notification_type,
        data=data,
    )
    db.add(notification)
    await db.flush()
    await db.refresh(notification)
    return notification


async def send_booking_confirmation(db: AsyncSession, booking: Booking) -> None:
    listing_result = await db.execute(select(Listing).where(Listing.id == booking.listing_id))
    listing = listing_result.scalar_one_or_none()

    booking_data = {
        "booking_id": str(booking.id),
        "listing_id": str(booking.listing_id),
        "check_in": str(booking.check_in),
        "check_out": str(booking.check_out),
    }

    await create_notification(
        db,
        user_id=booking.user_id,
        title="Booking Created",
        body=f"Your booking for {listing.title if listing else 'the listing'} from {booking.check_in} to {booking.check_out} has been created. Please complete payment to confirm.",
        notification_type="booking_confirmed",
        data=booking_data,
    )

    if listing:
        supplier_result = await db.execute(
            select(Supplier).where(Supplier.id == listing.supplier_id)
        )
        supplier = supplier_result.scalar_one_or_none()
        if supplier:
            await create_notification(
                db,
                user_id=supplier.user_id,
                title="New Booking",
                body=f"You have a new booking for {listing.title} from {booking.check_in} to {booking.check_out}.",
                notification_type="booking_confirmed",
                data=booking_data,
            )

            from app.services.email_service import send_supplier_new_booking_email
            from app.models.user import User
            user_result = await db.execute(select(User).where(User.id == supplier.user_id))
            supplier_user = user_result.scalar_one_or_none()
            if supplier_user:
                await send_supplier_new_booking_email(booking, supplier_user, listing)


async def send_booking_cancellation(db: AsyncSession, booking: Booking) -> None:
    listing_result = await db.execute(select(Listing).where(Listing.id == booking.listing_id))
    listing = listing_result.scalar_one_or_none()

    booking_data = {
        "booking_id": str(booking.id),
        "listing_id": str(booking.listing_id),
    }

    await create_notification(
        db,
        user_id=booking.user_id,
        title="Booking Cancelled",
        body=f"Your booking for {listing.title if listing else 'the listing'} has been cancelled.",
        notification_type="booking_cancelled",
        data=booking_data,
    )

    if listing:
        supplier_result = await db.execute(
            select(Supplier).where(Supplier.id == listing.supplier_id)
        )
        supplier = supplier_result.scalar_one_or_none()
        if supplier:
            await create_notification(
                db,
                user_id=supplier.user_id,
                title="Booking Cancelled",
                body=f"A booking for {listing.title} (check-in: {booking.check_in}) has been cancelled by the guest.",
                notification_type="booking_cancelled",
                data=booking_data,
            )
