from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Optional
from datetime import datetime
from uuid import UUID

from app.db.session import get_db
from app.models.pg_models import AuditLog, User, UserRole
from app.schemas.audit_log import AuditLogPagedResponse, AuditLogStats, AuditLogResponse
from app.api.dependencies import get_current_user, RoleChecker

router = APIRouter(dependencies=[Depends(get_current_user)])

admin_checker = RoleChecker([UserRole.SuperAdmin, UserRole.StoreAdmin])

@router.get("/", response_model=AuditLogPagedResponse, dependencies=[Depends(admin_checker)])
async def get_audit_logs(
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    user_name: Optional[str] = None,
    module: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    # 1. Base query for filtering
    base_query = select(AuditLog)

    if from_date:
        base_query = base_query.where(AuditLog.performed_at >= from_date)
    if to_date:
        base_query = base_query.where(AuditLog.performed_at <= to_date)
    if user_name and user_name != "All Users":
        base_query = base_query.where(AuditLog.user_name == user_name)
    if module and module != "All Modules":
        base_query = base_query.where(AuditLog.module == module)
    if action and action != "All Actions":
        base_query = base_query.where(AuditLog.action == action)

    # 2. Get stats counts
    # We query the total matching logs
    total_subq = base_query.subquery()
    count_query = select(func.count()).select_from(total_subq)
    total_res = await db.execute(count_query)
    total_count = total_res.scalar() or 0

    # Total Creates matching filters
    create_subq = base_query.where(AuditLog.action == "Create").subquery()
    create_query = select(func.count()).select_from(create_subq)
    create_res = await db.execute(create_query)
    create_count = create_res.scalar() or 0

    # Total Updates matching filters
    update_subq = base_query.where(AuditLog.action.in_([
        "Update", "Confirm", "Deliver", "Receive", "Start", "Complete", "Void"
    ])).subquery()
    update_query = select(func.count()).select_from(update_subq)
    update_res = await db.execute(update_query)
    update_count = update_res.scalar() or 0

    # Total Deletes matching filters
    delete_subq = base_query.where(AuditLog.action.in_(["Delete", "Cancel"])).subquery()
    delete_query = select(func.count()).select_from(delete_subq)
    delete_res = await db.execute(delete_query)
    delete_count = delete_res.scalar() or 0

    # 3. Get paged logs
    paged_query = base_query.order_by(AuditLog.performed_at.desc()).offset(skip).limit(limit)
    logs_res = await db.execute(paged_query)
    logs = logs_res.scalars().all()

    return {
        "total_count": total_count,
        "stats": {
            "total": total_count,
            "created": create_count,
            "updated": update_count,
            "deleted": delete_count
        },
        "logs": logs
    }
