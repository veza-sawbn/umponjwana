from datetime import datetime
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    body: str
    type: str
    is_read: bool
    data: Optional[dict[str, Any]]
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationUpdate(BaseModel):
    is_read: bool
