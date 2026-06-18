from decimal import Decimal
from uuid import UUID
from typing import Any

import stripe
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


async def create_payment_intent(
    amount: int,
    currency: str,
    booking_id: str,
    metadata: dict[str, str],
) -> dict[str, Any]:
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            metadata={**metadata, "booking_id": booking_id},
            automatic_payment_methods={"enabled": True},
        )
        return {
            "id": intent.id,
            "client_secret": intent.client_secret,
            "amount": intent.amount,
            "currency": intent.currency,
        }
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Stripe error: {str(e)}",
        )


async def handle_webhook(db: AsyncSession, event_type: str, event_data: dict[str, Any]) -> None:
    from app.models.payment import Payment
    from app.models.booking import Booking, BookingStatus, PaymentStatus

    if event_type == "payment_intent.succeeded":
        payment_intent_id = event_data.get("id")
        payment_result = await db.execute(
            select(Payment).where(Payment.stripe_payment_intent_id == payment_intent_id)
        )
        payment = payment_result.scalar_one_or_none()
        if payment:
            payment.status = "paid"
            if event_data.get("latest_charge"):
                payment.stripe_charge_id = event_data["latest_charge"]

            booking_result = await db.execute(
                select(Booking).where(Booking.id == payment.booking_id)
            )
            booking = booking_result.scalar_one_or_none()
            if booking:
                booking.status = BookingStatus.confirmed
                booking.payment_status = PaymentStatus.paid

            await db.flush()

    elif event_type == "payment_intent.payment_failed":
        payment_intent_id = event_data.get("id")
        payment_result = await db.execute(
            select(Payment).where(Payment.stripe_payment_intent_id == payment_intent_id)
        )
        payment = payment_result.scalar_one_or_none()
        if payment:
            payment.status = "failed"
            await db.flush()

    elif event_type == "charge.refunded":
        charge_id = event_data.get("id")
        payment_result = await db.execute(
            select(Payment).where(Payment.stripe_charge_id == charge_id)
        )
        payment = payment_result.scalar_one_or_none()
        if payment:
            payment.status = "refunded"
            booking_result = await db.execute(
                select(Booking).where(Booking.id == payment.booking_id)
            )
            booking = booking_result.scalar_one_or_none()
            if booking:
                booking.payment_status = PaymentStatus.refunded
            await db.flush()


async def process_refund(db: AsyncSession, booking_id: UUID) -> None:
    from app.models.payment import Payment
    from app.models.booking import Booking, PaymentStatus

    payment_result = await db.execute(
        select(Payment).where(Payment.booking_id == booking_id)
    )
    payment = payment_result.scalar_one_or_none()
    if not payment or not payment.stripe_payment_intent_id:
        return

    try:
        refund = stripe.Refund.create(payment_intent=payment.stripe_payment_intent_id)
        payment.status = "refunded"
        payment.stripe_charge_id = refund.charge

        booking_result = await db.execute(select(Booking).where(Booking.id == booking_id))
        booking = booking_result.scalar_one_or_none()
        if booking:
            booking.payment_status = PaymentStatus.refunded

        await db.flush()
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Refund failed: {str(e)}",
        )


def calculate_commission(amount: Decimal, rate: Decimal) -> Decimal:
    return (amount * rate / Decimal("100")).quantize(Decimal("0.01"))
