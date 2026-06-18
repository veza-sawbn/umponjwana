from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.listing import Listing
from app.schemas.booking import BookingCreate
from app.services.notification_service import send_booking_confirmation, send_booking_cancellation


async def check_availability(
    db: AsyncSession,
    listing_id: UUID,
    check_in: date,
    check_out: date,
    guests: int,
) -> bool:
    listing_result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = listing_result.scalar_one_or_none()
    if not listing:
        return False
    if listing.max_guests < guests:
        return False

    overlap_result = await db.execute(
        select(Booking).where(
            and_(
                Booking.listing_id == listing_id,
                Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
                Booking.check_in < check_out,
                Booking.check_out > check_in,
            )
        )
    )
    overlapping = overlap_result.scalar_one_or_none()
    return overlapping is None


async def create_booking(
    db: AsyncSession,
    user_id: UUID,
    booking_data: BookingCreate,
) -> Booking:
    if booking_data.check_in >= booking_data.check_out:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="check_out must be after check_in",
        )

    listing_result = await db.execute(
        select(Listing).where(Listing.id == booking_data.listing_id, Listing.is_active == True)
    )
    listing = listing_result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")

    available = await check_availability(
        db,
        booking_data.listing_id,
        booking_data.check_in,
        booking_data.check_out,
        booking_data.guests,
    )
    if not available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Listing is not available for the selected dates or guests",
        )

    nights_or_units = (booking_data.check_out - booking_data.check_in).days
    if listing.unit_type == "per_night":
        total_price = Decimal(str(listing.price_per_unit)) * nights_or_units
    elif listing.unit_type == "per_person":
        total_price = Decimal(str(listing.price_per_unit)) * booking_data.guests * nights_or_units
    else:
        total_price = Decimal(str(listing.price_per_unit))

    booking = Booking(
        user_id=user_id,
        listing_id=booking_data.listing_id,
        check_in=booking_data.check_in,
        check_out=booking_data.check_out,
        guests=booking_data.guests,
        total_price=total_price,
        special_requests=booking_data.special_requests,
    )
    db.add(booking)
    await db.flush()
    await db.refresh(booking)

    await send_booking_confirmation(db, booking)

    return booking


async def cancel_booking(db: AsyncSession, booking_id: UUID, user_id: UUID) -> Booking:
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    from app.models.user import UserRole
    from app.core.database import get_db as _get_db

    if booking.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if booking.status in (BookingStatus.cancelled, BookingStatus.completed):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a {booking.status} booking",
        )

    booking.status = BookingStatus.cancelled

    if booking.payment_status == PaymentStatus.paid:
        from app.services.payment_service import process_refund
        await process_refund(db, booking_id)

    await db.flush()
    await db.refresh(booking)

    await send_booking_cancellation(db, booking)
    return booking


async def confirm_booking_after_payment(db: AsyncSession, booking_id: UUID) -> Booking:
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    booking.status = BookingStatus.confirmed
    booking.payment_status = PaymentStatus.paid
    await db.flush()
    await db.refresh(booking)
    return booking
