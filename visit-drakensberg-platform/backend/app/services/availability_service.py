from datetime import date
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.booking import Booking, BookingStatus


async def get_booked_dates(db: AsyncSession, listing_id: UUID) -> list[dict]:
    result = await db.execute(
        select(Booking.check_in, Booking.check_out).where(
            and_(
                Booking.listing_id == listing_id,
                Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
            )
        )
    )
    return [{"check_in": str(row[0]), "check_out": str(row[1])} for row in result.fetchall()]


async def is_available(
    db: AsyncSession,
    listing_id: UUID,
    check_in: date,
    check_out: date,
) -> bool:
    result = await db.execute(
        select(Booking).where(
            and_(
                Booking.listing_id == listing_id,
                Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
                Booking.check_in < check_out,
                Booking.check_out > check_in,
            )
        )
    )
    overlap = result.scalar_one_or_none()
    return overlap is None


async def block_dates(
    db: AsyncSession,
    listing_id: UUID,
    supplier_id: UUID,
    check_in: date,
    check_out: date,
) -> Booking:
    from app.models.listing import Listing
    from fastapi import HTTPException, status
    from decimal import Decimal

    listing_result = await db.execute(
        select(Listing).where(
            Listing.id == listing_id,
            Listing.supplier_id == supplier_id,
        )
    )
    listing = listing_result.scalar_one_or_none()
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found or not owned by supplier",
        )

    block = Booking(
        user_id=supplier_id,
        listing_id=listing_id,
        check_in=check_in,
        check_out=check_out,
        guests=0,
        total_price=Decimal("0"),
        status=BookingStatus.confirmed,
        special_requests="[SUPPLIER_BLOCK]",
    )
    db.add(block)
    await db.flush()
    await db.refresh(block)
    return block
