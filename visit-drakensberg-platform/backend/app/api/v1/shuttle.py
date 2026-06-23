from uuid import UUID, uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import get_current_supplier
from app.models.user import User

router = APIRouter(prefix="/shuttle", tags=["shuttle"])

_vehicles: list[dict] = []


class VehicleCreate(BaseModel):
    make: str
    model: str
    year: Optional[int] = None
    registration: str
    capacity: int
    dot_permit_number: Optional[str] = None
    pli_policy_number: Optional[str] = None
    tourism_permit_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_pdp_number: Optional[str] = None


class VehicleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    registration: Optional[str] = None
    capacity: Optional[int] = None
    dot_permit_number: Optional[str] = None
    pli_policy_number: Optional[str] = None
    tourism_permit_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_pdp_number: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("/vehicles", status_code=status.HTTP_201_CREATED)
async def register_vehicle(
    payload: VehicleCreate,
    current_user: User = Depends(get_current_supplier),
):
    vehicle = {
        "id": str(uuid4()),
        "supplier_id": str(current_user.id),
        "make": payload.make,
        "model": payload.model,
        "year": payload.year,
        "registration": payload.registration,
        "capacity": payload.capacity,
        "dot_permit_number": payload.dot_permit_number,
        "pli_policy_number": payload.pli_policy_number,
        "tourism_permit_number": payload.tourism_permit_number,
        "driver_name": payload.driver_name,
        "driver_pdp_number": payload.driver_pdp_number,
        "is_verified": False,
        "is_active": True,
    }
    _vehicles.append(vehicle)
    return vehicle


@router.get("/vehicles")
async def list_my_vehicles(current_user: User = Depends(get_current_supplier)):
    return [v for v in _vehicles if v["supplier_id"] == str(current_user.id)]


@router.put("/vehicles/{vehicle_id}")
async def update_vehicle(
    vehicle_id: str,
    payload: VehicleUpdate,
    current_user: User = Depends(get_current_supplier),
):
    vehicle = next((v for v in _vehicles if v["id"] == vehicle_id), None)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if vehicle["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your vehicle")
    for field, value in payload.model_dump(exclude_none=True).items():
        vehicle[field] = value
    return vehicle


@router.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: str,
    current_user: User = Depends(get_current_supplier),
):
    global _vehicles
    vehicle = next((v for v in _vehicles if v["id"] == vehicle_id), None)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if vehicle["supplier_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your vehicle")
    _vehicles = [v for v in _vehicles if v["id"] != vehicle_id]
