from datetime import datetime
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel


class PaymentCreate(BaseModel):
    booking_id: UUID
    amount: Decimal
    currency: str = "ZAR"


class PaymentResponse(BaseModel):
    id: UUID
    booking_id: UUID
    amount: Decimal
    currency: str
    stripe_payment_intent_id: Optional[str]
    stripe_charge_id: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StripeWebhookEvent(BaseModel):
    type: str
    data: dict[str, Any]


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int
    currency: str
