from uuid import UUID

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.booking import Booking, PaymentStatus
from app.models.payment import Payment
from app.schemas.payment import PaymentCreate, PaymentResponse, PaymentIntentResponse
from app.services.payment_service import create_payment_intent, handle_webhook, process_refund

router = APIRouter(prefix="/payments", tags=["payments"])

stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/create-intent", response_model=PaymentIntentResponse)
async def create_intent(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(
            Booking.id == payment_data.booking_id,
            Booking.user_id == current_user.id,
        )
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if booking.payment_status == PaymentStatus.paid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking already paid")

    intent = await create_payment_intent(
        amount=int(float(payment_data.amount) * 100),
        currency=payment_data.currency.lower(),
        booking_id=str(payment_data.booking_id),
        metadata={"user_id": str(current_user.id), "booking_id": str(payment_data.booking_id)},
    )

    existing_payment = await db.execute(
        select(Payment).where(Payment.booking_id == payment_data.booking_id)
    )
    existing = existing_payment.scalar_one_or_none()
    if not existing:
        payment = Payment(
            booking_id=payment_data.booking_id,
            amount=payment_data.amount,
            currency=payment_data.currency,
            stripe_payment_intent_id=intent["id"],
            status="pending",
        )
        db.add(payment)
        await db.flush()

    return PaymentIntentResponse(
        client_secret=intent["client_secret"],
        payment_intent_id=intent["id"],
        amount=intent["amount"],
        currency=intent["currency"],
    )


@router.post("/confirm/{booking_id}", response_model=PaymentResponse)
async def confirm_payment(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.user_id == current_user.id,
        )
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    payment_result = await db.execute(select(Payment).where(Payment.booking_id == booking_id))
    payment = payment_result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    payment.status = "paid"
    booking.payment_status = PaymentStatus.paid
    from app.services.booking_service import confirm_booking_after_payment
    await confirm_booking_after_payment(db, booking_id)
    await db.flush()
    await db.refresh(payment)
    return payment


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    await handle_webhook(db, event["type"], event["data"]["object"])
    return {"received": True}


@router.get("/booking/{booking_id}", response_model=PaymentResponse)
async def get_payment_by_booking(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    booking_result = await db.execute(
        select(Booking).where(Booking.id == booking_id, Booking.user_id == current_user.id)
    )
    booking = booking_result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    payment_result = await db.execute(select(Payment).where(Payment.booking_id == booking_id))
    payment = payment_result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    return payment
