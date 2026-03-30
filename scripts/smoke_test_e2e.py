#!/usr/bin/env python3
import argparse
import datetime
import json
import sys
import urllib.request
from pathlib import Path
from urllib.error import HTTPError


def req(base: str, method: str, path: str, data=None):
    url = base + path
    payload = None
    headers = {"Content-Type": "application/json"}
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
    request = urllib.request.Request(url, data=payload, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body) if body else None
    except HTTPError as err:
        body = err.read().decode("utf-8")
        return err.code, json.loads(body) if body else None


def find_port_from_log() -> str:
    log_path = Path.home() / "Library/Application Support/attendance-system/logs/app.log"
    if not log_path.exists():
        return ""
    text = log_path.read_text(encoding="utf-8")
    marker = "Server started"
    port = ""
    for line in text.splitlines():
        if marker in line and "http://127.0.0.1:" in line:
            port = line.rsplit("http://127.0.0.1:", 1)[-1].split('"', 1)[0].split('}', 1)[0]
    return "".join(ch for ch in port if ch.isdigit())


def main():
    parser = argparse.ArgumentParser(description="Run attendance app E2E smoke test")
    parser.add_argument("--port", type=int, default=0, help="Backend port. If omitted, read from app.log")
    parser.add_argument("--output", default="", help="Optional output json file path")
    args = parser.parse_args()

    port = args.port or int(find_port_from_log() or 0)
    if not port:
        print("Could not determine backend port. Please pass --port.")
        return 2

    base = f"http://127.0.0.1:{port}"
    now = datetime.datetime.now()
    today = now.strftime("%Y-%m-%d")
    year = now.year
    month = now.month
    worker_name = f"SmokeWorker_{now.strftime('%H%M%S')}"

    result = {
        "base": base,
        "runAt": now.isoformat(),
        "inputs": {
            "today": today,
            "year": year,
            "month": month,
            "workerName": worker_name,
        },
        "steps": [],
    }

    def record(step: str, ok: bool, detail):
        result["steps"].append({"step": step, "ok": ok, "detail": detail})

    code, data = req(base, "POST", "/api/auth/login", {"username": "admin", "password": "admin123"})
    ok = code == 200 and isinstance(data, dict) and data.get("success") is True
    record("login", ok, {"status": code, "response": data})
    if not ok:
        finalize(result, args.output)
        return 2

    worker_payload = {
        "name": worker_name,
        "phone": "13900001234",
        "workerType": "smoke",
        "skillLevel": "senior",
        "dailyWage": 300,
        "overtimeWage": 50,
        "joinDate": today,
        "status": "active",
        "notes": "smoke test record",
    }
    code, data = req(base, "POST", "/api/workers", worker_payload)
    worker_id = data.get("id") if isinstance(data, dict) else None
    ok = code == 200 and bool(worker_id)
    record("create_worker", ok, {"status": code, "workerId": worker_id, "response": data})
    if not ok:
        finalize(result, args.output)
        return 3

    attendance_payload = {
        "workerId": worker_id,
        "date": today,
        "clockInTime": "08:00",
        "clockOutTime": "18:00",
        "status": "present",
        "overtimeHours": 2,
        "notes": "smoke test attendance",
    }
    code, data = req(base, "POST", "/api/attendance", attendance_payload)
    attendance_id = data.get("id") if isinstance(data, dict) else None
    ok = code == 200 and bool(attendance_id)
    record("create_attendance", ok, {"status": code, "attendanceId": attendance_id, "response": data})
    if not ok:
        finalize(result, args.output)
        return 4

    code, data = req(base, "GET", f"/api/salary/calculate?year={year}&month={month}")
    entry = None
    if isinstance(data, list):
        for item in data:
            if item.get("workerId") == worker_id:
                entry = item
                break
    expected_total = 300 + 2 * 50
    ok = code == 200 and entry is not None and int(entry.get("totalSalary", -1)) == expected_total
    record("salary_calculate", ok, {"status": code, "expectedTotal": expected_total, "entry": entry})
    if not ok:
        finalize(result, args.output)
        return 5

    payment_payload = {
        "workerId": worker_id,
        "workerName": worker_name,
        "paymentDate": today,
        "amount": 200,
        "remarks": "smoke test payment",
        "paymentMethod": "cash",
        "paymentPeriod": f"{year}-{month:02d}",
    }
    code, data = req(base, "POST", "/api/salary/payments", payment_payload)
    payment_id = data.get("id") if isinstance(data, dict) else None
    ok = code == 200 and bool(payment_id)
    record("create_salary_payment", ok, {"status": code, "paymentId": payment_id, "response": data})
    if not ok:
        finalize(result, args.output)
        return 6

    code, data = req(base, "GET", f"/api/salary/payments/worker/{worker_id}?startDate={today}&endDate={today}")
    matched = isinstance(data, list) and any(item.get("id") == payment_id for item in data)
    ok = code == 200 and matched
    record("verify_payment_query", ok, {"status": code, "matched": matched, "recordsCount": len(data) if isinstance(data, list) else None})

    result["summary"] = {
        "passed": all(step["ok"] for step in result["steps"]),
        "totalSteps": len(result["steps"]),
        "passedSteps": sum(1 for step in result["steps"] if step["ok"]),
    }
    result["artifacts"] = {
        "workerId": worker_id,
        "attendanceId": attendance_id,
        "paymentId": payment_id,
    }

    finalize(result, args.output)
    return 0 if result["summary"]["passed"] else 1


def finalize(result, output_path):
    text = json.dumps(result, ensure_ascii=False, indent=2)
    print(text)
    if output_path:
        Path(output_path).write_text(text + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
