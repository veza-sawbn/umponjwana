from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


async def process_refund(db: AsyncSession, booking_id: UUID) -> None:
    from app.models.payment import Payment
    from app.models.booking import Booking, PaymentStatus

    payment_result = await db.execute(
        select(Payment).where(Payment.booking_id == booking_id)
    )
    payment = payment_result.scalar_one_or_none()
    if not payment:
        return

    payment.status = "refunded"

    booking_result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = booking_result.scalar_one_or_none()
    if booking:
        booking.payment_status = PaymentStatus.refunded

    await db.flush()


def calculate_commission(amount: Decimal, rate: Decimal) -> Decimal:
    return (amount * rate / Decimal("100")).quantize(Decimal("0.01"))
