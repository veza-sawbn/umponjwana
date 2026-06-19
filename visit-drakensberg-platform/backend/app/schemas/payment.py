from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class PaymentCreate(BaseModel):
    booking_id: UUID
    amount: Decimal
    currency: str = "ZAR"
    payment_reference: Optional[str] = None


class PaymentResponse(BaseModel):
    id: UUID
    booking_id: UUID
    amount: Decimal
    currency: str
    payment_reference: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
