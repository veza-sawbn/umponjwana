from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user, get_current_supplier
from app.models.user import User, UserRole
from app.models.supplier import Supplier
from app.models.booking import Booking, BookingStatus
from app.models.listing import Listing
from app.schemas.booking import BookingCreate, BookingResponse, BookingWithDetails
from app.services.booking_service import create_booking, cancel_booking

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("/", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_new_booking(
    booking_data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_booking(db, current_user.id, booking_data)


@router.get("/my-bookings", response_model=list[BookingWithDetails])
async def get_my_bookings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking, Listing)
        .join(Listing, Booking.listing_id == Listing.id)
        .where(Booking.user_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    rows = result.all()
    bookings_with_details = []
    for booking, listing in rows:
        data = BookingWithDetails.model_validate(booking)
        data.listing_title = listing.title
        data.listing_location = listing.location
        data.listing_images = listing.images
        data.listing_category = listing.category
        bookings_with_details.append(data)
    return bookings_with_details


@router.get("/supplier/bookings", response_model=list[BookingWithDetails])
async def get_supplier_bookings(
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    supplier_result = await db.execute(
        select(Supplier).where(Supplier.user_id == current_user.id)
    )
    supplier = supplier_result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier profile not found")

    result = await db.execute(
        select(Booking, Listing)
        .join(Listing, Booking.listing_id == Listing.id)
        .where(Listing.supplier_id == supplier.id)
        .order_by(Booking.created_at.desc())
    )
    rows = result.all()
    bookings_with_details = []
    for booking, listing in rows:
        data = BookingWithDetails.model_validate(booking)
        data.listing_title = listing.title
        data.listing_location = listing.location
        data.listing_images = listing.images
        data.listing_category = listing.category
        bookings_with_details.append(data)
    return bookings_with_details


@router.get("/{booking_id}", response_model=BookingWithDetails)
async def get_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking, Listing)
        .join(Listing, Booking.listing_id == Listing.id)
        .where(Booking.id == booking_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    booking, listing = row

    if current_user.role == UserRole.guest and booking.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if current_user.role == UserRole.supplier:
        supplier_result = await db.execute(
            select(Supplier).where(Supplier.user_id == current_user.id)
        )
        supplier = supplier_result.scalar_one_or_none()
        if not supplier or listing.supplier_id != supplier.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    data = BookingWithDetails.model_validate(booking)
    data.listing_title = listing.title
    data.listing_location = listing.location
    data.listing_images = listing.images
    data.listing_category = listing.category
    return data


@router.put("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_my_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await cancel_booking(db, booking_id, current_user.id)
