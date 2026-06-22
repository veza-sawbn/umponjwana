from uuid import UUID, uuid4
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_supplier
from app.models.user import User
from app.models.supplier import Supplier
from app.models.listing import Listing

router = APIRouter(prefix="/discounts", tags=["discounts"])


class DiscountCreate(BaseModel):
    code: str
    type: str  # "percent" | "flat"
    value: float
    listing_id: Optional[UUID] = None  # None = all listings
    valid_until: Optional[date] = None
    max_uses: Optional[int] = None


class DiscountResponse(BaseModel):
    id: str
    code: str
    type: str
    value: float
    listing_id: Optional[str]
    valid_until: Optional[str]
    max_uses: Optional[int]
    uses: int
    supplier_id: str


class AvailabilityBlock(BaseModel):
    listing_id: UUID
    from_date: date
    to_date: date
    reason: Optional[str] = None


class AvailabilityBlockResponse(BaseModel):
    id: str
    listing_id: str
    from_date: str
    to_date: str
    reason: Optional[str]
    supplier_id: str


# In-memory stores (replace with DB tables in production)
_discounts: list[dict] = []
_availability_blocks: list[dict] = []


# ── Discounts ──────────────────────────────────────────────────────────────────


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_discount(
    payload: DiscountCreate,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    """Supplier creates a discount code."""
    # Validate listing ownership if listing_id provided
    if payload.listing_id:
        supplier_result = await db.execute(select(Supplier).where(Supplier.user_id == current_user.id))
        supplier = supplier_result.scalar_one_or_none()
        if not supplier:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")
        listing_result = await db.execute(
            select(Listing).where(Listing.id == payload.listing_id, Listing.supplier_id == supplier.id)
        )
        if not listing_result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Listing not yours")

    # Check code uniqueness
    if any(d["code"].upper() == payload.code.upper() for d in _discounts):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Discount code already exists")

    discount = {
        "id": str(uuid4()),
        "code": payload.code.upper(),
        "type": payload.type,
        "value": payload.value,
        "listing_id": str(payload.listing_id) if payload.listing_id else None,
        "valid_until": payload.valid_until.isoformat() if payload.valid_until else None,
        "max_uses": payload.max_uses,
        "uses": 0,
        "supplier_id": str(current_user.id),
    }
    _discounts.append(discount)
    return discount


@router.get("/")
async def list_discounts(
    current_user: User = Depends(get_current_supplier),
):
    """Supplier retrieves their discount codes."""
    return [d for d in _discounts if d["supplier_id"] == str(current_user.id)]


@router.delete("/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_discount(
    discount_id: str,
    current_user: User = Depends(get_current_supplier),
):
    global _discounts
    disc = next((d for d in _discounts if d["id"] == discount_id), None)
    if not disc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")
    if disc["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your discount")
    _discounts = [d for d in _discounts if d["id"] != discount_id]
    return None


@router.post("/validate")
async def validate_discount(code: str, listing_id: Optional[UUID] = None):
    """Public endpoint — guest checks if a code is valid before checkout."""
    disc = next((d for d in _discounts if d["code"] == code.upper()), None)
    if not disc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid discount code")

    if disc["valid_until"] and date.today() > date.fromisoformat(disc["valid_until"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Discount code has expired")

    if disc["max_uses"] and disc["uses"] >= disc["max_uses"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Discount code has reached its usage limit")

    if disc["listing_id"] and listing_id and str(listing_id) != disc["listing_id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Discount code is not valid for this listing")

    return {
        "valid": True,
        "code": disc["code"],
        "type": disc["type"],
        "value": disc["value"],
    }


# ── Availability blocks ────────────────────────────────────────────────────────


@router.post("/availability", status_code=status.HTTP_201_CREATED)
async def block_dates(
    payload: AvailabilityBlock,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    """Supplier blocks a date range to prevent bookings."""
    supplier_result = await db.execute(select(Supplier).where(Supplier.user_id == current_user.id))
    supplier = supplier_result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    listing_result = await db.execute(
        select(Listing).where(Listing.id == payload.listing_id, Listing.supplier_id == supplier.id)
    )
    if not listing_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Listing not yours")

    if payload.from_date >= payload.to_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="from_date must be before to_date")

    block = {
        "id": str(uuid4()),
        "listing_id": str(payload.listing_id),
        "from_date": payload.from_date.isoformat(),
        "to_date": payload.to_date.isoformat(),
        "reason": payload.reason,
        "supplier_id": str(current_user.id),
    }
    _availability_blocks.append(block)
    return block


@router.get("/availability")
async def list_blocks(
    current_user: User = Depends(get_current_supplier),
):
    return [b for b in _availability_blocks if b["supplier_id"] == str(current_user.id)]


@router.get("/availability/{listing_id}/public")
async def get_listing_blocked_dates(listing_id: UUID):
    """Public endpoint — guests can check blocked dates for a listing."""
    blocks = [b for b in _availability_blocks if b["listing_id"] == str(listing_id)]
    return [{"from": b["from_date"], "to": b["to_date"]} for b in blocks]


@router.delete("/availability/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(
    block_id: str,
    current_user: User = Depends(get_current_supplier),
):
    global _availability_blocks
    block = next((b for b in _availability_blocks if b["id"] == block_id), None)
    if not block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block not found")
    if block["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your block")
    _availability_blocks = [b for b in _availability_blocks if b["id"] != block_id]
    return None
