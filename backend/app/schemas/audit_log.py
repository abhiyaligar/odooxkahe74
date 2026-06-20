from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Optional

class AuditLogResponse(BaseModel):
    id: UUID
    performed_at: datetime
    user_id: Optional[UUID] = None
    user_name: str
    module: str
    record_type: str
    record_id: str
    action: str
    field_changed: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AuditLogStats(BaseModel):
    total: int
    created: int
    updated: int
    deleted: int

class AuditLogPagedResponse(BaseModel):
    total_count: int
    stats: AuditLogStats
    logs: List[AuditLogResponse]
