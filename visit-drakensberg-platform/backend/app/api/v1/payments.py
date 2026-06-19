from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.booking import Booking, PaymentStatus
from app.models.payment import Payment
from app.schemas.payment import PaymentCreate, PaymentResponse

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/confirm/{booking_id}", response_model=PaymentResponse)
async def confirm_payment(
    booking_id: UUID,
    payment_data: PaymentCreate,
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

    if booking.payment_status == PaymentStatus.paid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking already paid")

    payment = Payment(
        booking_id=booking_id,
        amount=payment_data.amount,
        currency=payment_data.currency,
        status="paid",
        payment_reference=payment_data.payment_reference,
    )
    db.add(payment)

    booking.payment_status = PaymentStatus.paid
    from app.services.booking_service import confirm_booking_after_payment
    await confirm_booking_after_payment(db, booking_id)
    await db.flush()
    await db.refresh(payment)
    return payment


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
