from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user, get_current_supplier
from app.core.dependencies import PaginationParams
from app.models.user import User, UserRole
from app.models.supplier import Supplier
from app.models.listing import Listing
from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.payment import Payment
from app.models.review import Review
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse, SupplierStats

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


@router.post("/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_data: SupplierCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.user_id == current_user.id))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplier profile already exists",
        )

    supplier = Supplier(
        user_id=current_user.id,
        business_name=supplier_data.business_name,
        description=supplier_data.description,
        website=supplier_data.website,
    )
    db.add(supplier)
    current_user.role = UserRole.supplier
    await db.flush()
    await db.refresh(supplier)
    return supplier


@router.get("/me", response_model=SupplierResponse)
async def get_my_supplier_profile(
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.user_id == current_user.id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier profile not found")
    return supplier


@router.put("/me", response_model=SupplierResponse)
async def update_my_supplier_profile(
    update_data: SupplierUpdate,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.user_id == current_user.id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier profile not found")

    for field, value in update_data.model_dump(exclude_none=True).items():
        setattr(supplier, field, value)
    await db.flush()
    await db.refresh(supplier)
    return supplier


@router.get("/me/stats", response_model=SupplierStats)
async def get_supplier_stats(
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    supplier_result = await db.execute(select(Supplier).where(Supplier.user_id == current_user.id))
    supplier = supplier_result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    listings_result = await db.execute(
        select(Listing.id).where(Listing.supplier_id == supplier.id)
    )
    listing_ids = [row[0] for row in listings_result.fetchall()]
    listing_count = len(listing_ids)

    if not listing_ids:
        return SupplierStats(
            total_earnings=Decimal("0"),
            pending_bookings=0,
            confirmed_bookings=0,
            completed_bookings=0,
            cancelled_bookings=0,
            average_rating=0.0,
            total_reviews=0,
            total_listings=0,
        )

    bookings_result = await db.execute(
        select(Booking.status, func.count(Booking.id)).where(
            Booking.listing_id.in_(listing_ids)
        ).group_by(Booking.status)
    )
    status_counts = {row[0]: row[1] for row in bookings_result.fetchall()}

    earnings_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).join(
            Booking, Payment.booking_id == Booking.id
        ).where(
            Booking.listing_id.in_(listing_ids),
            Booking.payment_status == PaymentStatus.paid,
        )
    )
    total_earnings = earnings_result.scalar() or Decimal("0")

    reviews_result = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.listing_id.in_(listing_ids)
        )
    )
    avg_rating, review_count = reviews_result.one()

    return SupplierStats(
        total_earnings=Decimal(str(total_earnings)),
        pending_bookings=status_counts.get(BookingStatus.pending, 0),
        confirmed_bookings=status_counts.get(BookingStatus.confirmed, 0),
        completed_bookings=status_counts.get(BookingStatus.completed, 0),
        cancelled_bookings=status_counts.get(BookingStatus.cancelled, 0),
        average_rating=float(avg_rating or 0),
        total_reviews=review_count or 0,
        total_listings=listing_count,
    )


@router.get("/", response_model=dict)
async def list_suppliers(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    count_result = await db.execute(
        select(func.count()).select_from(Supplier).where(Supplier.is_verified == True)
    )
    total = count_result.scalar()

    result = await db.execute(
        select(Supplier)
        .where(Supplier.is_verified == True)
        .offset(pagination.skip)
        .limit(pagination.limit)
    )
    suppliers = result.scalars().all()
    return {
        "items": [SupplierResponse.model_validate(s) for s in suppliers],
        "total": total,
        "skip": pagination.skip,
        "limit": pagination.limit,
    }


@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(supplier_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
    return supplier
