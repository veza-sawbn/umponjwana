from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field


class ListingCreate(BaseModel):
    category: str
    title: str = Field(min_length=1, max_length=255)
    description: str
    location: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_per_unit: Decimal = Field(gt=0)
    unit_type: str
    max_guests: int = Field(gt=0)
    amenities: list[str] = []
    images: list[str] = []


class ListingUpdate(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    price_per_unit: Optional[Decimal] = None
    unit_type: Optional[str] = None
    max_guests: Optional[int] = None
    amenities: Optional[list[str]] = None
    images: Optional[list[str]] = None
    is_active: Optional[bool] = None


class ListingResponse(BaseModel):
    id: UUID
    supplier_id: UUID
    category: str
    title: str
    description: str
    location: str
    lat: Optional[float]
    lng: Optional[float]
    price_per_unit: Decimal
    unit_type: str
    max_guests: int
    amenities: list[Any]
    images: list[Any]
    is_active: bool
    is_featured: bool
    rating_avg: float
    review_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ListingSearch(BaseModel):
    category: Optional[str] = None
    location: Optional[str] = None
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    guests: Optional[int] = None
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    amenities: Optional[list[str]] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class ListingSearchResponse(BaseModel):
    items: list[ListingResponse]
    total: int
    page: int
    page_size: int
    pages: int
