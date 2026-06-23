from uuid import UUID, uuid4
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_supplier, get_current_user
from app.models.user import User

router = APIRouter(prefix="/guides", tags=["guides"])

_guides: list[dict] = []


class GuideCreate(BaseModel):
    full_name: str
    bio: Optional[str] = None
    languages: List[str] = []
    specialties: List[str] = []
    certificate_number: Optional[str] = None
    guide_number: Optional[str] = None
    photo_url: Optional[str] = None


class GuideUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    languages: Optional[List[str]] = None
    specialties: Optional[List[str]] = None
    certificate_number: Optional[str] = None
    guide_number: Optional[str] = None
    photo_url: Optional[str] = None


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_guide(
    payload: GuideCreate,
    current_user: User = Depends(get_current_supplier),
):
    guide = {
        "id": str(uuid4()),
        "supplier_id": str(current_user.id),
        "full_name": payload.full_name,
        "bio": payload.bio,
        "languages": payload.languages,
        "specialties": payload.specialties,
        "certificate_number": payload.certificate_number,
        "guide_number": payload.guide_number,
        "photo_url": payload.photo_url,
        "verification_status": "pending",
    }
    _guides.append(guide)
    return guide


@router.get("/")
async def list_my_guides(current_user: User = Depends(get_current_supplier)):
    return [g for g in _guides if g["supplier_id"] == str(current_user.id)]


@router.get("/public")
async def list_public_guides(supplier_id: UUID):
    return [
        g for g in _guides
        if g["supplier_id"] == str(supplier_id) and g["verification_status"] == "verified"
    ]


@router.put("/{guide_id}")
async def update_guide(
    guide_id: str,
    payload: GuideUpdate,
    current_user: User = Depends(get_current_supplier),
):
    guide = next((g for g in _guides if g["id"] == guide_id), None)
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    if guide["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your guide")
    for field, value in payload.model_dump(exclude_none=True).items():
        guide[field] = value
    return guide


@router.delete("/{guide_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guide(
    guide_id: str,
    current_user: User = Depends(get_current_supplier),
):
    global _guides
    guide = next((g for g in _guides if g["id"] == guide_id), None)
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    if guide["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your guide")
    _guides = [g for g in _guides if g["id"] != guide_id]


@router.put("/{guide_id}/verify")
async def verify_guide(
    guide_id: str,
    verified: bool,
    current_user: User = Depends(get_current_user),
):
    """Admin-only: verify or reject a guide."""
    if current_user.role not in ("admin",) and getattr(current_user, "is_admin", False) is False:
        raise HTTPException(status_code=403, detail="Admin only")
    guide = next((g for g in _guides if g["id"] == guide_id), None)
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    guide["verification_status"] = "verified" if verified else "rejected"
    return guide
