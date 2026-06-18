from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field


class BookingCreate(BaseModel):
    listing_id: UUID
    check_in: date
    check_out: date
    guests: int = Field(gt=0)
    special_requests: Optional[str] = None


class BookingUpdate(BaseModel):
    status: Optional[str] = None
    special_requests: Optional[str] = None


class BookingResponse(BaseModel):
    id: UUID
    user_id: UUID
    listing_id: UUID
    check_in: date
    check_out: date
    guests: int
    total_price: Decimal
    status: str
    payment_status: str
    special_requests: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class BookingWithDetails(BookingResponse):
    listing_title: Optional[str] = None
    listing_location: Optional[str] = None
    listing_images: Optional[list[Any]] = None
    listing_category: Optional[str] = None
