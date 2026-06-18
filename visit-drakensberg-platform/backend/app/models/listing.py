import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Boolean, Numeric, DateTime, ForeignKey, func, Text, Float, Integer, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


class ListingCategory(str, enum.Enum):
    stay = "stay"
    activity = "activity"
    hike = "hike"
    shuttle = "shuttle"
    package = "package"


class UnitType(str, enum.Enum):
    per_night = "per_night"
    per_person = "per_person"
    per_group = "per_group"


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[ListingCategory] = mapped_column(
        SAEnum(ListingCategory, name="listing_category"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_per_unit: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    unit_type: Mapped[UnitType] = mapped_column(
        SAEnum(UnitType, name="unit_type"), nullable=False
    )
    max_guests: Mapped[int] = mapped_column(Integer, nullable=False)
    amenities: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    images: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rating_avg: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
