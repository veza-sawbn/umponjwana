from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import get_current_supplier, get_current_admin
from app.models.user import User, UserRole
from app.models.guide import Guide
from app.models.notification import Notification, NotificationType

router = APIRouter(prefix="/guides", tags=["guides"])


class GuideCreate(BaseModel):
    full_name: str
    bio: Optional[str] = None
    languages: List[str] = Field(default_factory=list)
    specialties: List[str] = Field(default_factory=list)
    certificate_number: Optional[str] = None
    guide_number: Optional[str] = None
    certificate_url: Optional[str] = None
    photo_url: Optional[str] = None


class GuideUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    languages: Optional[List[str]] = None
    specialties: Optional[List[str]] = None
    certificate_number: Optional[str] = None
    guide_number: Optional[str] = None
    certificate_url: Optional[str] = None
    photo_url: Optional[str] = None


def serialize_guide(guide: Guide) -> dict:
    return {
        "id": str(guide.id),
        "supplier_id": str(guide.supplier_id),
        "full_name": guide.full_name,
        "bio": guide.bio,
        "languages": guide.languages or [],
        "specialties": guide.specialties or [],
        "certificate_number": guide.certificate_number,
        "guide_number": guide.guide_number,
        "certificate_url": guide.certificate_url,
        "photo_url": guide.photo_url,
        "verification_status": guide.verification_status,
    }


async def notify_admins_of_pending_guide(db: AsyncSession, guide: Guide, supplier: User) -> None:
    result = await db.execute(select(User).where(User.role == UserRole.admin, User.is_active == True))
    admins = result.scalars().all()
    for admin in admins:
        db.add(Notification(
            user_id=admin.id,
            title="New guide pending approval",
            body=f"{guide.full_name} was submitted by {supplier.full_name} and needs admin review.",
            type=NotificationType.system.value,
            data={"guide_id": str(guide.id), "supplier_id": str(supplier.id), "action": "review_guide"},
        ))


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_guide(
    payload: GuideCreate,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    guide = Guide(
        supplier_id=current_user.id,
        full_name=payload.full_name,
        bio=payload.bio,
        languages=payload.languages,
        specialties=payload.specialties,
        certificate_number=payload.certificate_number,
        guide_number=payload.guide_number,
        certificate_url=payload.certificate_url,
        photo_url=payload.photo_url,
        verification_status="pending",
    )
    db.add(guide)
    await db.flush()
    await notify_admins_of_pending_guide(db, guide, current_user)
    await db.refresh(guide)
    return serialize_guide(guide)


@router.get("/")
async def list_my_guides(
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Guide).where(Guide.supplier_id == current_user.id))
    return [serialize_guide(g) for g in result.scalars().all()]


@router.get("/public")
async def list_public_guides(supplier_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Guide).where(Guide.supplier_id == supplier_id, Guide.verification_status == "verified"))
    return [serialize_guide(g) for g in result.scalars().all()]


@router.get("/admin")
async def admin_list_guides(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Guide).order_by(Guide.full_name.asc())
    if status_filter:
        query = query.where(Guide.verification_status == status_filter)
    result = await db.execute(query)
    return [serialize_guide(g) for g in result.scalars().all()]


@router.put("/{guide_id}")
async def update_guide(
    guide_id: UUID,
    payload: GuideUpdate,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Guide).where(Guide.id == guide_id))
    guide = result.scalar_one_or_none()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    if guide.supplier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your guide")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(guide, field, value)
    guide.verification_status = "pending"
    await db.flush()
    await notify_admins_of_pending_guide(db, guide, current_user)
    await db.refresh(guide)
    return serialize_guide(guide)


@router.delete("/{guide_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guide(
    guide_id: UUID,
    current_user: User = Depends(get_current_supplier),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Guide).where(Guide.id == guide_id))
    guide = result.scalar_one_or_none()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    if guide.supplier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your guide")
    await db.delete(guide)


@router.put("/{guide_id}/verify")
async def verify_guide(
    guide_id: UUID,
    verified: bool,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Guide).where(Guide.id == guide_id))
    guide = result.scalar_one_or_none()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    guide.verification_status = "verified" if verified else "rejected"
    db.add(Notification(
        user_id=guide.supplier_id,
        title="Guide approval updated",
        body=f"{guide.full_name} was {guide.verification_status} by the admin team.",
        type=NotificationType.system.value,
        data={"guide_id": str(guide.id), "status": guide.verification_status},
    ))
    await db.flush()
    await db.refresh(guide)
    return serialize_guide(guide)
