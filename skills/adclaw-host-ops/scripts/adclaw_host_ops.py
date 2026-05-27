#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT_ENV = Path("/root/.env")
OPERATOR_ENV = Path("/root/adclaw/CF/worker-adclaw/.env.operator")
DEFAULT_BASE_URL = "https://real.adclaw.app"
SECRET_KEY_RE = re.compile(
    r"(secret|token|bearer|password|api[_-]?key|authorization|webhook)",
    re.I,
)


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()
        if not name:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        values[name] = value
    return values


def load_env() -> None:
    for path in (ROOT_ENV, OPERATOR_ENV):
        for key, value in parse_env_file(path).items():
            os.environ.setdefault(key, value)
    if not os.environ.get("CLOUDFLARE_EMAIL") and os.environ.get("CLOUDFLARE_AUTH_EMAIL"):
        os.environ["CLOUDFLARE_EMAIL"] = os.environ["CLOUDFLARE_AUTH_EMAIL"]
    os.environ["ADCLAW_BASE_URL"] = os.environ.get("ADCLAW_HOST_OPS_BASE_URL") or DEFAULT_BASE_URL


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "[redacted]" if SECRET_KEY_RE.search(str(key)) else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def print_json(payload: Any) -> None:
    print(json.dumps(redact(payload), indent=2, ensure_ascii=False))


def fmt(value: Any, default: str = "-") -> str:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return "yes" if value else "no"
    return str(value)


def require_env(names: list[str]) -> None:
    missing = [name for name in names if not os.environ.get(name)]
    if missing:
        print("Missing required operator variables:", file=sys.stderr)
        for name in missing:
            print(f"- {name}", file=sys.stderr)
        print("\nExpected env files:", file=sys.stderr)
        print(f"- {ROOT_ENV}", file=sys.stderr)
        print(f"- {OPERATOR_ENV}", file=sys.stderr)
        raise SystemExit(2)


def base_url() -> str:
    return os.environ.get("ADCLAW_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def parse_json_payload(payload: str) -> Any:
    try:
        return json.loads(payload)
    except Exception:
        return {"raw": payload[:2000]}


def request_json(
    method: str,
    path: str,
    body: dict[str, Any] | None = None,
    admin: bool = False,
) -> tuple[int, Any]:
    data = None
    headers = {
        "Accept": "application/json",
        "User-Agent": "adclaw-host-ops/1.0",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if admin:
        require_env(["ADCLAW_ADMIN_BEARER"])
        headers["Authorization"] = f"Bearer {os.environ['ADCLAW_ADMIN_BEARER']}"
    req = urllib.request.Request(
        f"{base_url()}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            payload = response.read().decode("utf-8", errors="replace")
            return response.status, parse_json_payload(payload)
    except urllib.error.HTTPError as error:
        payload = error.read().decode("utf-8", errors="replace")
        return error.code, parse_json_payload(payload)


def status_counts(metrics: dict[str, Any]) -> list[tuple[str, Any]]:
    return [
        (str(row.get("status")), row.get("count"))
        for row in metrics.get("sandbox_status_counts", [])
        if isinstance(row, dict)
    ]


def alert_status(alert: dict[str, Any]) -> str:
    metric = alert.get("metric")
    evidence = alert.get("evidence") if isinstance(alert.get("evidence"), dict) else {}
    latest = evidence.get("latest_payload")
    if metric == "lifecycle_failures" and isinstance(latest, dict):
        if evidence.get("event") == "reconcile_idle_timeout" and latest.get("ok") is True:
            return "self_healed"
    if metric == "stuck_runtime":
        return "needs_check"
    return "review"


def recent_reconcile_self_healed(user_payload: dict[str, Any]) -> bool:
    status = (
        user_payload.get("customer_status", {})
        if isinstance(user_payload.get("customer_status"), dict)
        else {}
    )
    if status.get("status") != "sleeping":
        return False
    for event in user_payload.get("recent_audit_events", []) or []:
        if not isinstance(event, dict) or event.get("event") != "reconcile_idle_timeout":
            continue
        payload = event.get("payload_json")
        try:
            parsed = json.loads(payload) if isinstance(payload, str) else payload
        except Exception:
            parsed = {}
        if isinstance(parsed, dict) and parsed.get("ok") is True:
            return True
    return False


def recommendation_for_user(payload: dict[str, Any]) -> str:
    customer = payload.get("customer_status") if isinstance(payload.get("customer_status"), dict) else {}
    entitlement = payload.get("entitlement") if isinstance(payload.get("entitlement"), dict) else {}
    status = customer.get("status")
    runtime_mode = customer.get("runtime_mode") or entitlement.get("runtime_mode")
    if recent_reconcile_self_healed(payload):
        return "No action. Runtime alert self-healed via nightly reconcile."
    if status == "running" and runtime_mode == "keep_warm":
        return "No sleep recommended. Runtime is keep-warm; verify add-on only if unexpected."
    if status == "running" and runtime_mode == "auto_sleep":
        return "Run: adclaw-host-ops reconcile --dry-run"
    if status == "sleeping":
        return "No runtime action."
    if status in ("failed", "suspended"):
        return "Follow failure/suspension runbook before waking."
    return "Inspect recent audit events and operator alerts."


def command_doctor(args: argparse.Namespace) -> None:
    load_env()
    checks = [
        "ADCLAW_ADMIN_BEARER",
        "CLOUDFLARE_API_KEY",
        "CLOUDFLARE_EMAIL",
        "ADCLAW_BASE_URL",
    ]
    print("AdClaw Host Ops env")
    print(f"root_env: {ROOT_ENV} ({'exists' if ROOT_ENV.exists() else 'missing'})")
    print(f"operator_env: {OPERATOR_ENV} ({'exists' if OPERATOR_ENV.exists() else 'missing'})")
    if OPERATOR_ENV.is_symlink():
        print(f"operator_env_target: {OPERATOR_ENV.resolve()}")
    for name in checks:
        print(f"{name}: {'present' if os.environ.get(name) else 'missing'}")


def command_summary(args: argparse.Namespace) -> None:
    load_env()
    health_status, health = request_json("GET", "/health")
    version_status, version = request_json("GET", "/version")
    metrics_status, metrics = request_json("GET", "/api/admin/metrics", admin=True)
    alerts_status, alerts_payload = request_json("GET", "/api/admin/operator-alerts", admin=True)
    if args.json:
        print_json(
            {
                "health_status": health_status,
                "health": health,
                "version_status": version_status,
                "version": version,
                "metrics_status": metrics_status,
                "metrics": metrics,
                "alerts_status": alerts_status,
                "alerts": alerts_payload,
            },
        )
        return

    print("AdClaw Host Ops")
    print(f"health: {health_status} ok={fmt(health.get('ok') if isinstance(health, dict) else None)}")
    if isinstance(version, dict):
        print(
            "version: "
            f"adclaw={fmt(version.get('adclaw_package_version'))} "
            f"image={fmt(version.get('container_image_tag'))} "
            f"worker={fmt(version.get('worker'))}",
        )
    if isinstance(metrics, dict):
        print("\nSandboxes")
        print(f"active: {fmt(metrics.get('active_sandboxes'))}")
        for status, count in status_counts(metrics):
            print(f"{status}: {count}")
        cost = metrics.get("cost_dashboard") if isinstance(metrics.get("cost_dashboard"), dict) else {}
        print("\nCost risk")
        print(f"24h estimated runtime: ${fmt(cost.get('estimated_runtime_usd'), '0')}")
        top = cost.get("top_users") if isinstance(cost.get("top_users"), list) else []
        for row in top[:5]:
            if not isinstance(row, dict):
                continue
            minutes = int((row.get("active_seconds") or 0) / 60)
            print(
                f"- user={fmt(row.get('user_id'))} active={minutes}m "
                f"cost=${fmt(row.get('estimated_runtime_usd'), '0')} "
                f"starts={fmt(row.get('starts'), '0')} wakeups={fmt(row.get('wakeups'), '0')}",
            )
    alerts = (
        alerts_payload.get("operator_alerts", {}).get("alerts", [])
        if isinstance(alerts_payload, dict)
        else []
    )
    print("\nAlerts")
    if not alerts:
        print("none")
    for alert in alerts:
        if not isinstance(alert, dict):
            continue
        evidence = alert.get("evidence") if isinstance(alert.get("evidence"), dict) else {}
        print(
            f"- {alert_status(alert)} metric={fmt(alert.get('metric'))} "
            f"severity={fmt(alert.get('severity'))} user={fmt(evidence.get('user_id'))} "
            f"sandbox={fmt(evidence.get('sandbox_id'))} summary={fmt(alert.get('summary'))}",
        )
    print("\nNext safe command: adclaw-host-ops reconcile --dry-run")


def command_alerts(args: argparse.Namespace) -> None:
    load_env()
    status, payload = request_json("GET", "/api/admin/operator-alerts", admin=True)
    if args.json:
        print_json({"status": status, "payload": payload})
        return
    print(f"operator_alerts_status: {status}")
    alerts = (
        payload.get("operator_alerts", {}).get("alerts", [])
        if isinstance(payload, dict)
        else []
    )
    if not alerts:
        print("No active operator alerts.")
        return
    for alert in alerts:
        if not isinstance(alert, dict):
            continue
        evidence = alert.get("evidence") if isinstance(alert.get("evidence"), dict) else {}
        print(
            f"{alert_status(alert)} | {fmt(alert.get('severity'))} | "
            f"{fmt(alert.get('metric'))} | user={fmt(evidence.get('user_id'))} | "
            f"sandbox={fmt(evidence.get('sandbox_id'))}",
        )
        latest = evidence.get("latest_payload")
        if isinstance(latest, dict):
            print(
                f"  latest={fmt(evidence.get('latest_created_at'))} "
                f"ok={fmt(latest.get('ok'))} status={fmt(latest.get('response_status'))}",
            )
        print(f"  {fmt(alert.get('summary'))}")


def command_user(args: argparse.Namespace) -> None:
    load_env()
    status, payload = request_json("GET", f"/api/admin/users/{args.user_id}", admin=True)
    if args.json:
        print_json({"status": status, "payload": payload})
        return
    print(f"inspect_status: {status}")
    if not isinstance(payload, dict):
        print_json(payload)
        return
    customer = payload.get("customer_status") if isinstance(payload.get("customer_status"), dict) else {}
    entitlement = payload.get("entitlement") if isinstance(payload.get("entitlement"), dict) else {}
    sandbox = payload.get("sandbox") if isinstance(payload.get("sandbox"), dict) else {}
    print(f"User {fmt(payload.get('user_id') or args.user_id)}")
    print(
        f"customer_status: {fmt(customer.get('status'))} "
        f"runtime={fmt(customer.get('runtime_mode'))} tier={fmt(customer.get('tier'))}",
    )
    print(
        f"entitlement: {fmt(entitlement.get('status'))} "
        f"{fmt(entitlement.get('tier'))} runtime={fmt(entitlement.get('runtime_mode'))}",
    )
    if sandbox:
        print(
            f"sandbox: {fmt(sandbox.get('status'))} {fmt(sandbox.get('sandbox_id'))} "
            f"backup={fmt(sandbox.get('last_backup_id'))}",
        )
    print("recent_audit:")
    for event in (payload.get("recent_audit_events") or [])[:6]:
        if not isinstance(event, dict):
            continue
        detail = ""
        raw_payload = event.get("payload_json")
        try:
            parsed = json.loads(raw_payload) if isinstance(raw_payload, str) else raw_payload
        except Exception:
            parsed = {}
        if isinstance(parsed, dict):
            if "ok" in parsed:
                detail += f" ok={fmt(parsed.get('ok'))}"
            if "reason" in parsed:
                detail += f" reason={fmt(parsed.get('reason'))}"
            if "source" in parsed:
                detail += f" source={fmt(parsed.get('source'))}"
        print(f"- {fmt(event.get('created_at'))} {fmt(event.get('event'))}{detail}")
    print(f"recommendation: {recommendation_for_user(payload)}")


def command_reconcile(args: argparse.Namespace) -> None:
    load_env()
    body = {"confirm": "reconcile-runtime", "limit": args.limit} if args.confirm else {"limit": args.limit}
    status, payload = request_json("POST", "/api/admin/reconcile", body=body, admin=True)
    if args.json:
        print_json({"status": status, "payload": payload})
        return
    print(f"reconcile_status: {status}")
    if not isinstance(payload, dict):
        print_json(payload)
        return
    print(f"dry_run: {fmt(payload.get('dry_run'))}")
    if payload.get("confirm_required"):
        print(f"confirm_required: {payload.get('confirm_required')}")
    candidates = payload.get("candidates") if isinstance(payload.get("candidates"), list) else []
    results = payload.get("results") if isinstance(payload.get("results"), list) else []
    rows = candidates or results
    print(f"count: {len(rows)}")
    for row in rows:
        if not isinstance(row, dict):
            continue
        print(
            f"- user={fmt(row.get('user_id'))} sandbox={fmt(row.get('sandbox_id'))} "
            f"status={fmt(row.get('status'))} reason={fmt(row.get('reason'))} "
            f"stale_since={fmt(row.get('stale_since'))} ok={fmt(row.get('ok'))}",
        )
    if not args.confirm:
        print("To mutate: adclaw-host-ops reconcile --confirm")


def command_sleep(args: argparse.Namespace) -> None:
    load_env()
    if not args.confirm:
        print("Refusing to sleep without --confirm.", file=sys.stderr)
        print(f"First inspect: adclaw-host-ops user {args.user_id}", file=sys.stderr)
        raise SystemExit(2)
    status, payload = request_json("POST", f"/api/admin/users/{args.user_id}/sleep", admin=True)
    if args.json:
        print_json({"status": status, "payload": payload})
        return
    print(f"sleep_status: {status}")
    print_json(payload)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="adclaw-host-ops",
        description="Safe AdClaw Host operator inspection and guarded actions.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    doctor = sub.add_parser("doctor", help="Check env files and required variables")
    doctor.set_defaults(func=command_doctor)

    summary = sub.add_parser("summary", help="Show production health, status, alerts, and spend risk")
    summary.add_argument("--json", action="store_true")
    summary.set_defaults(func=command_summary)

    alerts = sub.add_parser("alerts", help="Show operator alerts")
    alerts.add_argument("--json", action="store_true")
    alerts.set_defaults(func=command_alerts)

    user = sub.add_parser("user", help="Inspect one user without starting runtime")
    user.add_argument("user_id")
    user.add_argument("--json", action="store_true")
    user.set_defaults(func=command_user)

    reconcile = sub.add_parser("reconcile", help="Runtime reconcile dry-run or confirmed repair")
    mode = reconcile.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--confirm", action="store_true")
    reconcile.add_argument("--limit", type=int, default=25)
    reconcile.add_argument("--json", action="store_true")
    reconcile.set_defaults(func=command_reconcile)

    sleep = sub.add_parser("sleep", help="Admin sleep one user; requires --confirm")
    sleep.add_argument("user_id")
    sleep.add_argument("--confirm", action="store_true")
    sleep.add_argument("--json", action="store_true")
    sleep.set_defaults(func=command_sleep)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
