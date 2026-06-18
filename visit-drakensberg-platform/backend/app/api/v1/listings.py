import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from app.core.database import get_db, redis
from app.core.security import get_current_user, get_current_supplier, get_current_admin
from app.models.user import User
from app.models.supplier import Supplier
from app.models.listing import Listing, ListingCategory
from app.models.booking import Booking, BookingStatus
from app.schemas.listing import (
    ListingCreate,
    ListingUpdate,
    ListingResponse,
    ListingSearch,
    ListingSearchResponse,
)
from app.services.availability_service import is_available

router = APIRouter(prefix="/listings", tags=["listings"])


@router.get("/featured", response_model=list[ListingResponse])
async def get_featured_listings(db: AsyncSession = Depends(get_db)):
    cache_key = "featured_listings"
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await db.execute(
        select(Listing).where(Listing.is_featured == True, Listing.is_active == True).limit(12)
    )
    listings = result.scalars().all()
    data = [ListingResponse.model_validate(l).model_dump(mode="json") for l in listings]
    redis.setex(cache_key, 600, json.dumps(data))
    return listings


@router.get("/categories")
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Listing.category, func.count(Listing.id))
        .where(Listing.is_active == True)
        .group_by(Listing.category)
    )
    counts = {row[0]: row[1] for row in result.fetchall()}
    return [
        {"category": cat.value, "count": counts.get(cat, 0)}
        for cat in ListingCategory
    ]


@router.get("/", response_model=ListingSearchResponse)
async def search_listings(
    category: str = None,
    location: str = None,
    check_in: str = None,
    check_out: str = None,
    guests: int = None,
    min_price: float = None,
    max_price: float = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"search:{category}:{location}:{check_in}:{check_out}:{guests}:{min_price}:{max_price}:{page}:{page_size}"
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)

    filters = [Listing.is_active == True]
    if category:
        filters.append(Listing.category == category)
    if location:
        filters.append(Listing.location.ilike(f"%{location}%"))
    if guests:
        filters.append(Listing.max_guests >= guests)
    if min_price is not None:
        filters.append(Listing.price_per_unit >= min_price)
    if max_price is not None:
        filters.append(Listing.price_per_unit <= max_price)

    count_result = await db.execute(
        select(func.count()).select_from(Listing).where(and_(*filters))
    )
    total = count_result.scalar()

    offset = (page - 1) * page_size
    result = await db.execute(
        select(Listing).where(and_(*filters)).offset(offset).limit(page_size)
    )
    listings = result.scalars().all()

    import math
    response = ListingSearchResponse(
        items=[ListingResponse.model_validate(l) for l in listings],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )
    redis.setex(cache_key, 300, response.model_dump_json())
    return response


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(listing_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")
    return listing


@router.post("/", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(
    listing_data: ListingCreate,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    supplier_result = await db.execute(
        select(Supplier).where(Supplier.user_id == current_user.id)
    )
    supplier = supplier_result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier profile not found")

    listing = Listing(
        supplier_id=supplier.id,
        **listing_data.model_dump(),
    )
    db.add(listing)
    await db.flush()
    await db.refresh(listing)
    return listing


@router.put("/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: UUID,
    update_data: ListingUpdate,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    supplier_result = await db.execute(
        select(Supplier).where(Supplier.user_id == current_user.id)
    )
    supplier = supplier_result.scalar_one_or_none()

    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")

    from app.models.user import UserRole
    if current_user.role != UserRole.admin and (not supplier or listing.supplier_id != supplier.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    for field, value in update_data.model_dump(exclude_none=True).items():
        setattr(listing, field, value)
    await db.flush()
    await db.refresh(listing)
    redis.delete(f"listing:{listing_id}")
    return listing


@router.delete("/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_listing(
    listing_id: UUID,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    supplier_result = await db.execute(
        select(Supplier).where(Supplier.user_id == current_user.id)
    )
    supplier = supplier_result.scalar_one_or_none()

    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")

    from app.models.user import UserRole
    if current_user.role != UserRole.admin and (not supplier or listing.supplier_id != supplier.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    await db.delete(listing)
    return None


@router.post("/{listing_id}/availability")
async def check_availability(
    listing_id: UUID,
    check_in: str,
    check_out: str,
    guests: int = 1,
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as date_type
    from dateutil.parser import parse

    result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found")

    check_in_date = parse(check_in).date()
    check_out_date = parse(check_out).date()

    if check_in_date >= check_out_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="check_out must be after check_in")

    available = await is_available(db, listing_id, check_in_date, check_out_date)
    can_accommodate = listing.max_guests >= guests

    return {
        "available": available and can_accommodate,
        "dates_available": available,
        "capacity_ok": can_accommodate,
        "max_guests": listing.max_guests,
    }
