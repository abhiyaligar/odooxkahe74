from sqlalchemy.ext.asyncio import AsyncSession
from app.models.pg_models import AuditLog, User
from uuid import UUID

async def log_action(
    db: AsyncSession,
    user: User | None,
    module: str,
    record_type: str,
    record_id: str,
    action: str,
    field_changed: str | None = None,
    old_val: str | None = None,
    new_val: str | None = None
):
    audit_log = AuditLog(
        user_id=user.id if user else None,
        user_name=user.name if user else "System",
        module=module,
        record_type=record_type,
        record_id=str(record_id),
        action=action,
        field_changed=field_changed,
        old_value=str(old_val) if old_val is not None else None,
        new_value=str(new_val) if new_val is not None else None
    )
    db.add(audit_log)
    await db.flush()
