from __future__ import annotations

from collections.abc import Callable

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from .runtime import execute_workflow

scheduler = BackgroundScheduler()


def reschedule_cron(
    session_factory: Callable[[], Session],
    workflows: list[dict],
) -> None:
    scheduler.remove_all_jobs()
    for workflow in workflows:
        if not workflow["active"]:
            continue
        for node in workflow["nodes"]:
            if node["type"] != "cronTrigger":
                continue
            cron_expr = node.get("data", {}).get("params", {}).get("cronExpression")
            if not cron_expr:
                continue

            def _run_workflow(wf=workflow):
                with session_factory() as db:
                    execute_workflow(db, wf, [])

            scheduler.add_job(_run_workflow, CronTrigger.from_crontab(cron_expr))

    if not scheduler.running:
        scheduler.start()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown()
