"""Celery app. The Node outbox worker publishes `spaceborn.analyze_cad_file` tasks to the `cad` queue on Redis."""

import json
import logging
import os
import re
import socket

import psycopg
from botocore.exceptions import BotoCoreError, ClientError
from celery import Celery
from celery.exceptions import SoftTimeLimitExceeded

from . import settings, storage
from .analysis import MESH_FORMATS, RejectedFile, UnsupportedFormat, analyze, estimate

log = logging.getLogger("cad-worker")
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)
WORKER = f"{socket.gethostname()}:{os.getpid()}"

app = Celery("spaceborn-cad", broker=settings.REDIS_URL)
app.conf.update(
    task_default_queue=settings.QUEUE,
    task_ignore_result=True,
    # Acknowledge only after the task finished, and give the message back if the worker dies mid-task.
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=240,
    task_time_limit=300,
    accept_content=["json"],
    task_serializer="json",
    broker_connection_retry_on_startup=True,
    # Redis redelivers unacknowledged tasks after this long; longer than the hard time limit.
    broker_transport_options={"visibility_timeout": 900},
    worker_hijack_root_logger=False,
)

JOB_QUERY = """
  select f.storage_key, f.file_name, j.kind::text, j.material, j.quantity, l.max_x_mm, l.max_y_mm, l.max_z_mm
    from fab_files f
    join fab_jobs j on j.id = f.job_id
    join service_listings l on l.id = j.listing_id
   where f.id = %s
"""

UPSERT = """
  insert into fab_file_analysis (file_id, status, metrics, estimate, error, worker, analyzed_at)
  values (%s, %s, %s, %s, %s, %s, now())
  on conflict (file_id) do update set
    status = excluded.status, metrics = excluded.metrics, estimate = excluded.estimate,
    error = excluded.error, worker = excluded.worker, analyzed_at = now()
"""


def _save(conn: psycopg.Connection, file_id: str, status: str, metrics=None, est=None, error: str | None = None) -> None:
    conn.execute(UPSERT, (file_id, status, json.dumps(metrics) if metrics else None, json.dumps(est) if est else None, error, WORKER))
    conn.commit()


@app.task(
    name="spaceborn.analyze_cad_file",
    autoretry_for=(psycopg.OperationalError, BotoCoreError),
    retry_backoff=5,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=6,
)
def analyze_cad_file(file_id: str) -> str:
    if not isinstance(file_id, str) or not UUID_RE.match(file_id):
        log.warning("ignoring task with invalid file id")
        return "invalid"
    with psycopg.connect(**settings.db_params()) as conn:
        row = conn.execute(JOB_QUERY, (file_id,)).fetchone()
        if not row:
            return "missing"
        key, name, kind, material, quantity, mx, my, mz = row
        ext = os.path.splitext(name)[1].lower()
        if ext not in MESH_FORMATS:
            _save(conn, file_id, "unsupported")
            return "unsupported"
        try:
            data = storage.read(key)
            metrics = analyze(data, ext, (mx, my, mz))
            est = estimate(metrics, kind, material, quantity)
        except UnsupportedFormat:
            _save(conn, file_id, "unsupported")
            return "unsupported"
        except (RejectedFile, storage.TooLarge, SoftTimeLimitExceeded, MemoryError) as err:
            _save(conn, file_id, "failed", error=f"{type(err).__name__}: {err}"[:500])
            return "failed"
        except ClientError as err:
            # A missing object will not appear on retry; other S3 errors (throttling) should retry.
            if err.response.get("Error", {}).get("Code") in ("NoSuchKey", "404", "AccessDenied"):
                _save(conn, file_id, "failed", error=f"storage: {err.response['Error']['Code']}")
                return "failed"
            raise
        except FileNotFoundError:
            _save(conn, file_id, "failed", error="storage: file not found")
            return "failed"
        except (psycopg.OperationalError, BotoCoreError):
            raise
        except Exception as err:
            log.exception("analysis of %s failed", file_id)
            _save(conn, file_id, "failed", error=f"internal: {type(err).__name__}")
            return "failed"
        _save(conn, file_id, "done", metrics.to_dict(), est)
        log.info("analysed %s: %s", file_id, est)
        return "done"
