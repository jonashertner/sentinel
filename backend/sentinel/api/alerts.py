"""Alert rules CRUD and match history API."""

from fastapi import APIRouter, Depends, HTTPException

from sentinel.alerts.engine import load_matches, load_rules, save_rules
from sentinel.alerts.models import AlertMatch, AlertRule
from sentinel.api.deps import require_write_access
from sentinel.audit import log_audit

router = APIRouter()


@router.get("/rules", response_model=list[AlertRule])
async def list_rules():
    return load_rules()


@router.post("/rules", response_model=AlertRule, status_code=201)
async def create_rule(
    body: AlertRule,
    _auth: None = Depends(require_write_access),
):
    rules = load_rules()
    rules.append(body)
    save_rules(rules)
    log_audit("CREATE", "alert_rule", body.id, new_value=body.model_dump(mode="json"))
    return body


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: str,
    _auth: None = Depends(require_write_access),
):
    rules = load_rules()
    updated = [r for r in rules if r.id != rule_id]
    if len(updated) == len(rules):
        raise HTTPException(status_code=404, detail="Rule not found")
    save_rules(updated)
    log_audit("DELETE", "alert_rule", rule_id)


@router.get("/matches", response_model=list[AlertMatch])
async def list_matches(unread_only: bool = False):
    matches = load_matches()
    if unread_only:
        matches = [m for m in matches if not m.read]
    return sorted(matches, key=lambda m: m.matched_at, reverse=True)


@router.get("/matches/count")
async def unread_count():
    matches = load_matches()
    return {"unread": sum(1 for m in matches if not m.read)}
