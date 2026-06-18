"""
Booking queue worker using Upstash Redis.

Task types
----------
- send_confirmation      : send booking-confirmation email to guest
- expire_pending_bookings: cancel bookings pending > 30 min
- update_listing_stats   : recalculate rating_avg / review_count for a listing
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

QUEUE_NAME = "drakensberg:booking_queue"


# ---------------------------------------------------------------------------
# Redis client helper
# ---------------------------------------------------------------------------

def _build_redis():
    from upstash_redis import Redis
    from app.core.config import settings

    url = settings.REDIS_URL
    if "token=" in url:
        base_url = url.split("?")[0] if "?" in url else url
        token = url.split("token=")[1].split("&")[0]
        return Redis(url=base_url, token=token)
    return Redis.from_env()


# ---------------------------------------------------------------------------
# Enqueue
# ---------------------------------------------------------------------------

def enqueue_task(redis_client, task_type: str, data: dict[str, Any]) -> None:
    """Push a JSON task onto the right end of the queue list."""
    payload = json.dumps({"type": task_type, "data": data})
    redis_client.rpush(QUEUE_NAME, payload)
    logger.debug("Enqueued task %s: %s", task_type, data)


# ---------------------------------------------------------------------------
# Task handlers
# ---------------------------------------------------------------------------

async def _handle_send_confirmation(data: dict[str, Any]) -> None:
    from uuid import UUID
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.user import User
    from app.models.listing import Listing
    from app.services.email_service import send_booking_confirmation_email

    booking_id = UUID(data["booking_id"])

    async with AsyncSessionLocal() as db:
        booking = (await db.execute(select(Booking).where(Booking.id == booking_id))).scalar_one_or_none()
        if booking is None:
            logger.warning("send_confirmation: booking %s not found", booking_id)
            return
        user = (await db.execute(select(User).where(User.id == booking.user_id))).scalar_one_or_none()
        listing = (await db.execute(select(Listing).where(Listing.id == booking.listing_id))).scalar_one_or_none()
        if user and listing:
            await send_booking_confirmation_email(booking, user, listing)
            logger.info("Confirmation email sent for booking %s", booking_id)


async def expire_pending_bookings() -> None:
    """Cancel bookings that have been in 'pending' status for more than 30 minutes."""
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking, BookingStatus

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Booking).where(
                Booking.status == BookingStatus.pending,
                Booking.created_at < cutoff,
            )
        )
        stale = result.scalars().all()
        for booking in stale:
            booking.status = BookingStatus.cancelled
            logger.info("Expired pending booking %s", booking.id)
        if stale:
            await db.commit()
            logger.info("Expired %d stale bookings", len(stale))


async def _handle_update_listing_stats(data: dict[str, Any]) -> None:
    from uuid import UUID
    from sqlalchemy import select, func
    from app.core.database import AsyncSessionLocal
    from app.models.listing import Listing
    from app.models.review import Review

    listing_id = UUID(data["listing_id"])

    async with AsyncSessionLocal() as db:
        avg, count = (
            await db.execute(
                select(func.avg(Review.rating), func.count(Review.id)).where(
                    Review.listing_id == listing_id
                )
            )
        ).one()
        listing = (await db.execute(select(Listing).where(Listing.id == listing_id))).scalar_one_or_none()
        if listing:
            listing.rating_avg = float(avg or 0)
            listing.review_count = count or 0
            await db.commit()
            logger.info("Updated listing %s stats: avg=%.2f count=%d", listing_id, listing.rating_avg, count)


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

async def _dispatch(task_type: str, data: dict[str, Any]) -> None:
    if task_type == "send_confirmation":
        await _handle_send_confirmation(data)
    elif task_type == "expire_pending_bookings":
        await expire_pending_bookings()
    elif task_type == "update_listing_stats":
        await _handle_update_listing_stats(data)
    else:
        logger.warning("Unknown task type: %s", task_type)


# ---------------------------------------------------------------------------
# Main queue loop
# ---------------------------------------------------------------------------

async def process_booking_queue() -> None:
    """
    Blocking loop: pop tasks from the queue and process them.
    Runs periodic housekeeping (expiry) every 10 minutes between tasks.
    """
    redis_client = _build_redis()
    logger.info("Booking worker started, listening on '%s'", QUEUE_NAME)

    last_expiry_run = datetime.now(timezone.utc)

    while True:
        now = datetime.now(timezone.utc)
        if (now - last_expiry_run) >= timedelta(minutes=10):
            try:
                await expire_pending_bookings()
            except Exception as exc:
                logger.error("Error in expire_pending_bookings: %s", exc)
            last_expiry_run = datetime.now(timezone.utc)

        # blpop with 5-second timeout to allow periodic housekeeping
        raw = redis_client.blpop([QUEUE_NAME], timeout=5)
        if raw is None:
            continue  # timeout — loop for housekeeping check

        _, payload_str = raw
        try:
            payload = json.loads(payload_str)
            task_type: str = payload.get("type", "")
            task_data: dict = payload.get("data", {})
            logger.info("Processing task: %s", task_type)
            await _dispatch(task_type, task_data)
        except Exception as exc:
            logger.error("Failed to process payload '%s': %s", payload_str, exc)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(process_booking_queue())
