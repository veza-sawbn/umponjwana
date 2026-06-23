from sqlalchemy import Column, String, Integer, Float, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import uuid
from app.core.database import Base


class Room(Base):
    __tablename__ = "rooms"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    listing_id = Column(UUID(as_uuid=True), ForeignKey("listings.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    max_guests = Column(Integer, default=2)
    price_per_night = Column(Float, nullable=False)
    amenities = Column(ARRAY(String), default=[])
    is_available = Column(Boolean, default=True)
    images = Column(ARRAY(String), default=[])
