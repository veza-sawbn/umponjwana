import logging

import resend

from app.core.config import settings
from app.services.email_layout import (
    cta_button,
    detail_table,
    email_shell,
    esc,
    fine_print,
    greeting,
    paragraph,
)

logger = logging.getLogger(__name__)

resend.api_key = settings.RESEND_API_KEY


def _money(amount: float) -> str:
    """Rands, grouped with a space — matching formatMoney() on the frontend."""
    return f"R {amount:,.2f}".replace(",", " ")


def _date(value: object) -> str:
    """A date the way the site writes them: 14 March 2026."""
    try:
        return value.strftime("%-d %B %Y")  # type: ignore[attr-defined]
    except (AttributeError, ValueError):
        return str(value)


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    try:
        resend.Emails.send({
            "from": settings.FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        })
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


async def send_verification_email(user: object, token: str) -> bool:
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = email_shell(
        origin=settings.FRONTEND_URL,
        eyebrow="Account",
        heading="Confirm your email address",
        preheader="Confirm your email to finish setting up your Visit Drakensberg account.",
        body_html=f"""
        {greeting(user.full_name)}
        {paragraph("Thank you for registering. Confirming your address is the last step — it lets us send you booking confirmations and keeps your account recoverable.")}
        {cta_button(verification_url, "Confirm my email")}
        {fine_print("This link expires in 24 hours. If you did not create an account, you can ignore this email and nothing further will happen.")}""",
    )
    return await send_email(user.email, "Confirm your Visit Drakensberg email", html)


async def send_password_reset_email(user: object, token: str) -> bool:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = email_shell(
        origin=settings.FRONTEND_URL,
        eyebrow="Account security",
        heading="Reset your password",
        preheader="A password reset was requested for your Visit Drakensberg account.",
        body_html=f"""
        {greeting(user.full_name)}
        {paragraph("We received a request to reset your password. Choose a new one using the link below.")}
        {cta_button(reset_url, "Reset my password")}
        {fine_print("This link expires in 1 hour. If you did not request a reset, ignore this email — your current password stays active and unchanged.")}""",
    )
    return await send_email(user.email, "Reset your Visit Drakensberg password", html)


async def send_booking_confirmation_email(booking: object, user: object, listing: object) -> bool:
    nights = (booking.check_out - booking.check_in).days
    html = email_shell(
        origin=settings.FRONTEND_URL,
        eyebrow="Booking confirmed",
        heading=listing.title,
        preheader=f"Confirmed for {_date(booking.check_in)} — {nights} night{'' if nights == 1 else 's'}.",
        body_html=f"""
        {greeting(user.full_name)}
        {paragraph("Your booking is confirmed. Here are the details we have on file.")}
        {detail_table(
            [
                ("Stay", listing.title),
                ("Location", listing.location),
                ("Check in", _date(booking.check_in)),
                ("Check out", _date(booking.check_out)),
                ("Nights", str(nights)),
                ("Guests", str(booking.guests)),
            ],
            ("Total", _money(booking.total_price)),
        )}
        {cta_button(f"{settings.FRONTEND_URL}/bookings/{booking.id}", "View your booking")}
        {fine_print("Keep this email for your records. If anything above doesn't look right, get in touch before you travel.")}""",
    )
    return await send_email(user.email, f"Booking confirmed — {listing.title}", html)


async def send_supplier_new_booking_email(booking: object, supplier_user: object, listing: object) -> bool:
    html = email_shell(
        origin=settings.FRONTEND_URL,
        eyebrow="New booking",
        heading=listing.title,
        preheader=f"A new booking came in for {listing.title}.",
        body_html=f"""
        {greeting(supplier_user.full_name)}
        {paragraph(f"You have received a new booking for <strong>{esc(listing.title)}</strong>.")}
        {detail_table(
            [
                ("Booking", str(booking.id)),
                ("Check in", _date(booking.check_in)),
                ("Check out", _date(booking.check_out)),
                ("Guests", str(booking.guests)),
            ],
            ("Total", _money(booking.total_price)),
        )}
        {cta_button(f"{settings.FRONTEND_URL}/supplier/bookings/{booking.id}", "View this booking")}""",
    )
    return await send_email(supplier_user.email, f"New booking — {listing.title}", html)
