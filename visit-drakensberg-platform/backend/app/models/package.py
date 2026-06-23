from sqlalchemy import Column, String, Float, Integer, ForeignKey, Text, Date, Boolean
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import uuid
from app.core.database import Base


class Package(Base):
    __tablename__ = "packages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    duration_days = Column(Integer)
    includes = Column(ARRAY(String), default=[])
    images = Column(ARRAY(String), default=[])
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    collaborators = Column(ARRAY(String), default=[])
    tour_start = Column(Date)
    tour_end = Column(Date)
    max_participants = Column(Integer)
    is_published = Column(Boolean, default=False)
