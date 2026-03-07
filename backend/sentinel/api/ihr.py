"""IHR notification workflow API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from sentinel.api.deps import require_write_access
from sentinel.audit import log_audit
from sentinel.ihr.models import Annex2Assessment, IHRNotification, IHRStatus
from sentinel.ihr.workflow import (
    get_dashboard_summary,
    load_notifications,
    save_notifications,
    start_assessment,
    update_assessment,
)

router = APIRouter()


class AssessRequest(BaseModel):
    event_ids: list[str]
    assessor: str


class AssessmentUpdate(BaseModel):
    assessment: Annex2Assessment


class StatusUpdate(BaseModel):
    status: IHRStatus
    who_reference: str = ""
    who_response: str = ""
    note: str = ""


@router.get("/dashboard")
async def dashboard():
    return get_dashboard_summary()


@router.get("/notifications", response_model=list[IHRNotification])
async def list_notifications():
    return load_notifications()


@router.post("/assess", response_model=IHRNotification, status_code=201)
async def assess(
    body: AssessRequest,
    _auth: None = Depends(require_write_access),
):
    notification = start_assessment(body.event_ids, body.assessor)
    log_audit(
        "CREATE", "ihr_notification", notification.id,
        new_value=notification.model_dump(mode="json"),
    )
    return notification


@router.patch(
    "/notifications/{notification_id}/assessment",
    response_model=IHRNotification,
)
async def update_annex2(
    notification_id: str,
    body: AssessmentUpdate,
    _auth: None = Depends(require_write_access),
):
    try:
        notification = update_assessment(notification_id, body.assessment)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    log_audit(
        "UPDATE", "ihr_notification", notification_id,
        new_value={"assessment": body.assessment.model_dump(mode="json")},
    )
    return notification


@router.patch(
    "/notifications/{notification_id}/status",
    response_model=IHRNotification,
)
async def update_status(
    notification_id: str,
    body: StatusUpdate,
    _auth: None = Depends(require_write_access),
):
    notifications = load_notifications()
    for n in notifications:
        if n.id == notification_id:
            n.status = body.status
            if body.who_reference:
                n.who_reference = body.who_reference
            if body.who_response:
                n.who_response = body.who_response
            if body.note:
                n.notes.append(body.note)
            save_notifications(notifications)
            log_audit("UPDATE", "ihr_notification", notification_id,
                      new_value={"status": body.status})
            return n
    raise HTTPException(status_code=404, detail="Notification not found")
