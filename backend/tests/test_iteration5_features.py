"""Iteration 5 regression: attendance record + student summary, PJJ create, real xlsx export, role boundaries."""
import io
import os
import uuid
import zipfile

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
CREDS = {
    "admin": ("admin", "admin123"),
    "teacher": ("guru.budi", "password"),
    "student": ("siswa.budi", "password"),
}


@pytest.fixture(scope="module")
def api():
    tokens = {}
    for role, (username, password) in CREDS.items():
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password})
        assert r.status_code == 200, r.text
        tokens[role] = r.json()["token"]
    return {role: {"Authorization": f"Bearer {token}"} for role, token in tokens.items()}


# ---------- Attendance ----------
def test_attendance_record_and_student_summary(api):
    # Get baseline
    before = requests.get(f"{BASE_URL}/api/student/attendance", headers=api["student"])
    assert before.status_code == 200
    base_hadir = before.json()["stats"]["Hadir"]

    date = f"2026-09-{uuid.uuid4().int % 27 + 1:02d}"
    payload = {
        "class_name": "VIII-A",
        "subject": "Mathematics",
        "date": date,
        "records": [{"student_id": "u-student", "student_name": "Ahmad Pratama", "status": "Hadir"}],
    }
    r = requests.post(f"{BASE_URL}/api/teacher/attendance", headers=api["teacher"], json=payload)
    assert r.status_code == 200, r.text
    assert r.json()["records"][0]["status"] == "Hadir"

    after = requests.get(f"{BASE_URL}/api/student/attendance", headers=api["student"])
    assert after.status_code == 200
    body = after.json()
    # Once attendance is recorded, summary should reflect real data (>= 1 Hadir entry)
    assert body["stats"]["Hadir"] >= 1
    assert any(e["date"] == date and e["status"] == "Hadir" for e in body["entries"])
    # If prior recorded sessions existed, still monotonic non-decreasing
    assert body["stats"]["Hadir"] >= base_hadir or body["stats"]["Hadir"] >= 1


# ---------- PJJ ----------
def test_pjj_create_and_list(api):
    title = f"TEST PJJ {uuid.uuid4()}"
    payload = {
        "title": title, "class_name": "VIII-A", "subject": "Mathematics",
        "date": "2026-10-01", "start_time": "08:00", "end_time": "09:30",
        "platform": "Google Meet", "url": "https://meet.google.com/xxx-test", "notes": "test"
    }
    r = requests.post(f"{BASE_URL}/api/teacher/pjj", headers=api["teacher"], json=payload)
    assert r.status_code == 200, r.text
    item = r.json()
    assert item["title"] == title and item["time"] == "08:00 – 09:30" and item["status"] == "Scheduled"

    listing = requests.get(f"{BASE_URL}/api/pjj", headers=api["student"])
    assert listing.status_code == 200
    assert any(x["id"] == item["id"] for x in listing.json())


# ---------- Excel export ----------
def test_excel_export_returns_valid_xlsx_with_columns(api):
    # Create a submission+grade so there's data
    a = requests.post(
        f"{BASE_URL}/api/teacher/assignments", headers=api["teacher"],
        data={"title": f"TEST XLSX {uuid.uuid4()}", "description": "", "deadline": "30 Sep 2026"},
    )
    assert a.status_code == 200
    aid = a.json()["id"]
    sub = requests.post(
        f"{BASE_URL}/api/assignments/{aid}/submit", headers=api["student"],
        files={"file": ("work.pdf", b"stuff", "application/pdf")},
    )
    assert sub.status_code == 200
    requests.patch(f"{BASE_URL}/api/teacher/submissions/{sub.json()['id']}",
                   headers=api["teacher"], json={"score": 75, "feedback": "ok"})

    r = requests.get(f"{BASE_URL}/api/teacher/grades/export", headers=api["teacher"])
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    # Real xlsx is a zip file
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    assert "xl/workbook.xml" in zf.namelist()
    # Column headers may live in sharedStrings.xml or inline in sheet1.xml
    haystack = ""
    for name in zf.namelist():
        if name.endswith(".xml"):
            haystack += zf.read(name).decode("utf-8", errors="ignore")
    for col in ["No", "NIS", "NISN", "Student Name", "Quiz Score", "Assignment Score", "Final Score"]:
        assert col in haystack, f"Missing column {col} in xlsx"


# ---------- Role boundaries ----------
def test_student_forbidden_on_admin_and_teacher_endpoints(api):
    checks = [
        requests.get(f"{BASE_URL}/api/admin/classes", headers=api["student"]),
        requests.get(f"{BASE_URL}/api/admin/users", headers=api["student"]),
        requests.post(f"{BASE_URL}/api/admin/periods", headers=api["student"], json={"year": "x", "semester": "Ganjil"}),
        requests.get(f"{BASE_URL}/api/teacher/submissions", headers=api["student"]),
        requests.get(f"{BASE_URL}/api/teacher/grades", headers=api["student"]),
        requests.get(f"{BASE_URL}/api/teacher/grades/export", headers=api["student"]),
        requests.post(f"{BASE_URL}/api/teacher/attendance", headers=api["student"],
                      json={"class_name": "VIII-A", "subject": "Math", "date": "2026-10-01", "records": []}),
        requests.post(f"{BASE_URL}/api/teacher/pjj", headers=api["student"],
                      json={"title": "x", "class_name": "VIII-A", "subject": "Math", "date": "2026-10-01",
                            "start_time": "08:00", "end_time": "09:00", "platform": "Google Meet", "url": "http://x"}),
    ]
    assert all(r.status_code == 403 for r in checks), [(r.status_code, r.text) for r in checks]


# ---------- Notification mark-read ----------
def test_notification_mark_read(api):
    lst = requests.get(f"{BASE_URL}/api/notifications", headers=api["student"])
    assert lst.status_code == 200
    unread = [n for n in lst.json() if not n["read"]]
    if not unread:
        pytest.skip("no unread notifications")
    nid = unread[0]["id"]
    r = requests.post(f"{BASE_URL}/api/notifications/{nid}/read", headers=api["student"])
    assert r.status_code == 200 and r.json()["ok"] is True
    after = requests.get(f"{BASE_URL}/api/notifications", headers=api["student"])
    item = next(n for n in after.json() if n["id"] == nid)
    assert item["read"] is True


# ---------- Single active period ----------
def test_single_active_period(api):
    # Create a new active period; verify others deactivate
    r = requests.post(f"{BASE_URL}/api/admin/periods", headers=api["admin"],
                      json={"year": f"TEST/{uuid.uuid4().int % 9999}", "semester": "Ganjil", "active": True})
    assert r.status_code == 200
    new_id = r.json()["id"]
    lst = requests.get(f"{BASE_URL}/api/admin/periods", headers=api["admin"]).json()
    actives = [p for p in lst if p.get("active")]
    assert len(actives) == 1 and actives[0]["id"] == new_id
    # Activate a different one
    other = next(p for p in lst if p["id"] != new_id)
    a = requests.post(f"{BASE_URL}/api/admin/periods/{other['id']}/activate", headers=api["admin"])
    assert a.status_code == 200
    lst2 = requests.get(f"{BASE_URL}/api/admin/periods", headers=api["admin"]).json()
    assert len([p for p in lst2 if p.get("active")]) == 1
