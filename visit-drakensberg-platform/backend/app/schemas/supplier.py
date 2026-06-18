from datetime import datetime
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel


class SupplierCreate(BaseModel):
    business_name: str
    description: str
    website: Optional[str] = None


class SupplierUpdate(BaseModel):
    business_name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    bank_details: Optional[dict[str, Any]] = None


class SupplierResponse(BaseModel):
    id: UUID
    user_id: UUID
    business_name: str
    description: str
    logo_url: Optional[str]
    website: Optional[str]
    is_verified: bool
    commission_rate: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class SupplierStats(BaseModel):
    total_earnings: Decimal
    pending_bookings: int
    confirmed_bookings: int
    completed_bookings: int
    cancelled_bookings: int
    average_rating: float
    total_reviews: int
    total_listings: int
