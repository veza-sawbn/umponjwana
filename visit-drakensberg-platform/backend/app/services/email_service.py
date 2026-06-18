import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    try:
        message = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=html_content,
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info(f"Email sent to {to_email}: status {response.status_code}")
        return response.status_code in (200, 202)
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


async def send_verification_email(user: object, token: str) -> bool:
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d6a4f;">Welcome to Visit Drakensberg!</h2>
        <p>Hi {user.full_name},</p>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <a href="{verification_url}"
           style="display: inline-block; padding: 12px 24px; background-color: #2d6a4f; color: white;
                  text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Verify Email
        </a>
        <p>This link expires in 24 hours.</p>
        <p>If you did not create an account, please ignore this email.</p>
    </div>
    """
    return await send_email(user.email, "Verify your Visit Drakensberg account", html)


async def send_password_reset_email(user: object, token: str) -> bool:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d6a4f;">Password Reset Request</h2>
        <p>Hi {user.full_name},</p>
        <p>We received a request to reset your password. Click the button below to reset it:</p>
        <a href="{reset_url}"
           style="display: inline-block; padding: 12px 24px; background-color: #c0392b; color: white;
                  text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Reset Password
        </a>
        <p>This link expires in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
    </div>
    """
    return await send_email(user.email, "Reset your Visit Drakensberg password", html)


async def send_booking_confirmation_email(booking: object, user: object, listing: object) -> bool:
    nights = (booking.check_out - booking.check_in).days
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d6a4f;">Booking Confirmed!</h2>
        <p>Hi {user.full_name},</p>
        <p>Your booking has been confirmed. Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background: #f4f4f4;">
                <td style="padding: 8px; font-weight: bold;">Listing</td>
                <td style="padding: 8px;">{listing.title}</td>
            </tr>
            <tr>
                <td style="padding: 8px; font-weight: bold;">Location</td>
                <td style="padding: 8px;">{listing.location}</td>
            </tr>
            <tr style="background: #f4f4f4;">
                <td style="padding: 8px; font-weight: bold;">Check-in</td>
                <td style="padding: 8px;">{booking.check_in}</td>
            </tr>
            <tr>
                <td style="padding: 8px; font-weight: bold;">Check-out</td>
                <td style="padding: 8px;">{booking.check_out}</td>
            </tr>
            <tr style="background: #f4f4f4;">
                <td style="padding: 8px; font-weight: bold;">Nights</td>
                <td style="padding: 8px;">{nights}</td>
            </tr>
            <tr>
                <td style="padding: 8px; font-weight: bold;">Guests</td>
                <td style="padding: 8px;">{booking.guests}</td>
            </tr>
            <tr style="background: #f4f4f4;">
                <td style="padding: 8px; font-weight: bold;">Total</td>
                <td style="padding: 8px;">R {booking.total_price:.2f}</td>
            </tr>
        </table>
        <p>We look forward to your visit to the Drakensberg!</p>
        <a href="{settings.FRONTEND_URL}/bookings/{booking.id}"
           style="display: inline-block; padding: 12px 24px; background-color: #2d6a4f; color: white;
                  text-decoration: none; border-radius: 4px;">
            View Booking
        </a>
    </div>
    """
    return await send_email(user.email, f"Booking Confirmed - {listing.title}", html)


async def send_supplier_new_booking_email(booking: object, supplier_user: object, listing: object) -> bool:
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d6a4f;">New Booking for {listing.title}</h2>
        <p>Hi {supplier_user.full_name},</p>
        <p>You have received a new booking:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background: #f4f4f4;">
                <td style="padding: 8px; font-weight: bold;">Booking ID</td>
                <td style="padding: 8px;">{booking.id}</td>
            </tr>
            <tr>
                <td style="padding: 8px; font-weight: bold;">Check-in</td>
                <td style="padding: 8px;">{booking.check_in}</td>
            </tr>
            <tr style="background: #f4f4f4;">
                <td style="padding: 8px; font-weight: bold;">Check-out</td>
                <td style="padding: 8px;">{booking.check_out}</td>
            </tr>
            <tr>
                <td style="padding: 8px; font-weight: bold;">Guests</td>
                <td style="padding: 8px;">{booking.guests}</td>
            </tr>
            <tr style="background: #f4f4f4;">
                <td style="padding: 8px; font-weight: bold;">Total</td>
                <td style="padding: 8px;">R {booking.total_price:.2f}</td>
            </tr>
        </table>
        <a href="{settings.FRONTEND_URL}/supplier/bookings/{booking.id}"
           style="display: inline-block; padding: 12px 24px; background-color: #2d6a4f; color: white;
                  text-decoration: none; border-radius: 4px;">
            View Booking
        </a>
    </div>
    """
    return await send_email(supplier_user.email, f"New Booking - {listing.title}", html)
