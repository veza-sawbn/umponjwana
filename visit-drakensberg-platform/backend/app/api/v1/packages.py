from uuid import UUID, uuid4
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import get_current_supplier
from app.models.user import User

router = APIRouter(prefix="/packages", tags=["packages"])

_packages: list[dict] = []


class PackageCreate(BaseModel):
    title: str
    description: Optional[str] = None
    price: float
    duration_days: Optional[int] = None
    includes: List[str] = []
    tour_start: Optional[date] = None
    tour_end: Optional[date] = None
    max_participants: Optional[int] = None


class PackageUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    duration_days: Optional[int] = None
    includes: Optional[List[str]] = None
    tour_start: Optional[date] = None
    tour_end: Optional[date] = None
    max_participants: Optional[int] = None
    is_published: Optional[bool] = None


class CollaboratorAdd(BaseModel):
    supplier_id: str


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_package(
    payload: PackageCreate,
    current_user: User = Depends(get_current_supplier),
):
    pkg = {
        "id": str(uuid4()),
        "title": payload.title,
        "description": payload.description,
        "price": payload.price,
        "duration_days": payload.duration_days,
        "includes": payload.includes,
        "tour_start": payload.tour_start.isoformat() if payload.tour_start else None,
        "tour_end": payload.tour_end.isoformat() if payload.tour_end else None,
        "max_participants": payload.max_participants,
        "is_published": False,
        "created_by": str(current_user.id),
        "collaborators": [],
        "images": [],
    }
    _packages.append(pkg)
    return pkg


@router.get("/")
async def list_packages():
    """Public — list published packages."""
    return [p for p in _packages if p["is_published"]]


@router.get("/mine")
async def list_my_packages(current_user: User = Depends(get_current_supplier)):
    return [
        p for p in _packages
        if p["created_by"] == str(current_user.id) or str(current_user.id) in p["collaborators"]
    ]


@router.put("/{package_id}")
async def update_package(
    package_id: str,
    payload: PackageUpdate,
    current_user: User = Depends(get_current_supplier),
):
    pkg = next((p for p in _packages if p["id"] == package_id), None)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    if pkg["created_by"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your package")
    updates = payload.model_dump(exclude_none=True)
    for field in ("tour_start", "tour_end"):
        if field in updates and updates[field]:
            updates[field] = updates[field].isoformat()
    pkg.update(updates)
    return pkg


@router.post("/{package_id}/collaborators")
async def add_collaborator(
    package_id: str,
    payload: CollaboratorAdd,
    current_user: User = Depends(get_current_supplier),
):
    pkg = next((p for p in _packages if p["id"] == package_id), None)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    if pkg["created_by"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your package")
    if payload.supplier_id not in pkg["collaborators"]:
        pkg["collaborators"].append(payload.supplier_id)
    return pkg


@router.delete("/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_package(
    package_id: str,
    current_user: User = Depends(get_current_supplier),
):
    global _packages
    pkg = next((p for p in _packages if p["id"] == package_id), None)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    if pkg["created_by"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your package")
    _packages = [p for p in _packages if p["id"] != package_id]
