from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_admin
from app.core.dependencies import PaginationParams
from app.models.user import User
from app.models.supplier import Supplier
from app.models.listing import Listing
from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.payment import Payment
from app.schemas.user import UserResponse
from app.schemas.supplier import SupplierResponse
from app.schemas.listing import ListingResponse
from app.schemas.booking import BookingResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar()
    total_suppliers = (await db.execute(select(func.count()).select_from(Supplier))).scalar()
    total_listings = (await db.execute(select(func.count()).select_from(Listing))).scalar()
    total_bookings = (await db.execute(select(func.count()).select_from(Booking))).scalar()

    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == "paid")
    )
    total_revenue = revenue_result.scalar()

    pending_bookings = (
        await db.execute(
            select(func.count()).select_from(Booking).where(Booking.status == BookingStatus.pending)
        )
    ).scalar()

    return {
        "total_users": total_users,
        "total_suppliers": total_suppliers,
        "total_listings": total_listings,
        "total_bookings": total_bookings,
        "total_revenue": float(total_revenue or 0),
        "pending_bookings": pending_bookings,
    }


@router.get("/users")
async def admin_list_users(
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count()).select_from(User))).scalar()
    result = await db.execute(select(User).offset(pagination.skip).limit(pagination.limit))
    users = result.scalars().all()
    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total,
    }


@router.get("/suppliers")
async def admin_list_suppliers(
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count()).select_from(Supplier))).scalar()
    result = await db.execute(select(Supplier).offset(pagination.skip).limit(pagination.limit))
    suppliers = result.scalars().all()
    return {
        "items": [SupplierResponse.model_validate(s) for s in suppliers],
        "total": total,
    }


@router.get("/listings")
async def admin_list_listings(
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count()).select_from(Listing))).scalar()
    result = await db.execute(select(Listing).offset(pagination.skip).limit(pagination.limit))
    listings = result.scalars().all()
    return {
        "items": [ListingResponse.model_validate(l) for l in listings],
        "total": total,
    }


@router.get("/bookings")
async def admin_list_bookings(
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count()).select_from(Booking))).scalar()
    result = await db.execute(
        select(Booking).order_by(Booking.created_at.desc()).offset(pagination.skip).limit(pagination.limit)
    )
    bookings = result.scalars().all()
    return {
        "items": [BookingResponse.model_validate(b) for b in bookings],
        "total": total,
    }


@router.put("/suppliers/{supplier_id}/verify")
async def verify_supplier(
    supplier_id: UUID,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    supplier.is_verified = True
    await db.flush()
    await db.refresh(supplier)
    return SupplierResponse.model_validate(supplier)


@router.put("/listings/{listing_id}/feature")
async def toggle_feature_listing(
    listing_id: UUID,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")

    listing.is_featured = not listing.is_featured
    await db.flush()
    await db.refresh(listing)
    return ListingResponse.model_validate(listing)


@router.delete("/listings/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_listing(
    listing_id: UUID,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")

    await db.delete(listing)
    return None
