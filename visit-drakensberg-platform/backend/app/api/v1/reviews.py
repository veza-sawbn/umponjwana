from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user, get_current_admin
from app.models.user import User
from app.models.booking import Booking, BookingStatus
from app.models.review import Review
from app.models.listing import Listing
from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    listing_id: UUID
    booking_id: UUID
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=10)


class ReviewResponse(BaseModel):
    id: UUID
    user_id: UUID
    listing_id: UUID
    booking_id: UUID
    rating: int
    comment: str
    is_verified: bool

    model_config = {"from_attributes": True}


router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    booking_result = await db.execute(
        select(Booking).where(
            Booking.id == review_data.booking_id,
            Booking.user_id == current_user.id,
            Booking.listing_id == review_data.listing_id,
            Booking.status == BookingStatus.completed,
        )
    )
    booking = booking_result.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only review completed bookings",
        )

    existing_result = await db.execute(
        select(Review).where(Review.booking_id == review_data.booking_id)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Review already submitted for this booking",
        )

    review = Review(
        user_id=current_user.id,
        listing_id=review_data.listing_id,
        booking_id=review_data.booking_id,
        rating=review_data.rating,
        comment=review_data.comment,
    )
    db.add(review)
    await db.flush()

    stats_result = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.listing_id == review_data.listing_id
        )
    )
    avg, count = stats_result.one()

    listing_result = await db.execute(select(Listing).where(Listing.id == review_data.listing_id))
    listing = listing_result.scalar_one_or_none()
    if listing:
        listing.rating_avg = float(avg or 0)
        listing.review_count = count or 0

    await db.refresh(review)
    return review


@router.get("/listing/{listing_id}", response_model=list[ReviewResponse])
async def get_listing_reviews(listing_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Review)
        .where(Review.listing_id == listing_id, Review.is_verified == True)
        .order_by(Review.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review(
    review_id: UUID,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    listing_id = review.listing_id
    await db.delete(review)
    await db.flush()

    stats_result = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.listing_id == listing_id
        )
    )
    avg, count = stats_result.one()

    listing_result = await db.execute(select(Listing).where(Listing.id == listing_id))
    listing = listing_result.scalar_one_or_none()
    if listing:
        listing.rating_avg = float(avg or 0)
        listing.review_count = count or 0

    return None
