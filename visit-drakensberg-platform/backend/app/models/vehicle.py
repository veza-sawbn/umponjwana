from sqlalchemy import Column, String, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    make = Column(String, nullable=False)
    model = Column(String, nullable=False)
    year = Column(Integer)
    registration = Column(String, nullable=False)
    capacity = Column(Integer, nullable=False)
    dot_permit_number = Column(String)
    dot_permit_url = Column(String)
    pli_policy_number = Column(String)
    pli_policy_url = Column(String)
    tourism_permit_number = Column(String)
    tourism_permit_url = Column(String)
    driver_name = Column(String)
    driver_pdp_number = Column(String)
    driver_pdp_url = Column(String)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
