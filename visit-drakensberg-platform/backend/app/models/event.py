from sqlalchemy import Column, String, Float, Integer, ForeignKey, Text, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import uuid
from app.core.database import Base


class Event(Base):
    __tablename__ = "events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    event_type = Column(String, default="event")  # event | special
    location = Column(String)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime)
    ticket_price = Column(Float, nullable=False)
    total_tickets = Column(Integer)
    tickets_sold = Column(Integer, default=0)
    images = Column(ARRAY(String), default=[])
    is_published = Column(Boolean, default=True)
