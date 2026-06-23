from sqlalchemy import Column, String, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import uuid
from app.core.database import Base


class Guide(Base):
    __tablename__ = "guides"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    full_name = Column(String, nullable=False)
    bio = Column(Text)
    languages = Column(ARRAY(String), default=[])
    specialties = Column(ARRAY(String), default=[])
    certificate_number = Column(String)
    guide_number = Column(String)
    certificate_url = Column(String)
    verification_status = Column(String, default="pending")  # pending | verified | rejected
    photo_url = Column(String)
