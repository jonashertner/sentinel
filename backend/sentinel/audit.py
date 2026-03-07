"""Lightweight audit logging for mutation endpoints.

Logs to a JSONL file (data/audit.jsonl) when using the file backend.
When store_backend="postgres", logs to the audit_log table via PostgresStore.
"""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path

from sentinel.config import settings

logger = logging.getLogger(__name__)

_AUDIT_FILE: Path | None = None


def _get_audit_path() -> Path:
    global _AUDIT_FILE
    if _AUDIT_FILE is None:
        _AUDIT_FILE = Path(settings.data_dir) / "audit.jsonl"
        _AUDIT_FILE.parent.mkdir(parents=True, exist_ok=True)
    return _AUDIT_FILE


def log_audit(
    action: str,
    entity_type: str,
    entity_id: str,
    old_value: dict | None = None,
    new_value: dict | None = None,
) -> None:
    """Append an audit entry (file-based, synchronous)."""
    entry = {
        "timestamp": datetime.now(UTC).isoformat(),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
    }
    if old_value is not None:
        entry["old_value"] = old_value
    if new_value is not None:
        entry["new_value"] = new_value

    try:
        with open(_get_audit_path(), "a") as f:
            f.write(json.dumps(entry, default=str) + "\n")
    except Exception:
        logger.exception("Failed to write audit log entry")
