"""Regression coverage for materials, quizzes, assignments, grading, notifications, and role boundaries."""
import os
import io
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
CREDS = {
    "admin": ("admin", "admin123"),
    "teacher": ("guru.budi", "password"),
    "student": ("siswa.budi", "password"),
}


@pytest.fixture(scope="module")
def api():
    session = requests.Session()
    tokens = {}
    for role, (username, password) in CREDS.items():
        response = session.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password})
        assert response.status_code == 200, response.text
        tokens[role] = response.json()["token"]
    return {role: {"Authorization": f"Bearer {token}"} for role, token in tokens.items()}


def test_material_upload_validation_and_student_download(api):
    title = f"TEST Material {uuid.uuid4()}"
    valid = api["teacher"]
    response = requests.post(
        f"{BASE_URL}/api/teacher/materials",
        headers=valid,
        data={"title": title, "description": "test", "status": "Published"},
        files={"file": ("lesson.pdf", b"PDF test content", "application/pdf")},
    )
    assert response.status_code == 200, response.text
    item = response.json()
    assert item["title"] == title and item["status"] == "Published"
    assert requests.post(
        f"{BASE_URL}/api/teacher/materials", headers=valid,
        data={"title": "TEST bad extension", "status": "Published"},
        files={"file": ("lesson.exe", b"bad", "application/octet-stream")},
    ).status_code == 400
    assert requests.post(
        f"{BASE_URL}/api/teacher/materials", headers=valid,
        data={"title": "TEST oversized", "status": "Published"},
        files={"file": ("large.pdf", io.BytesIO(b"x" * (10 * 1024 * 1024 + 1)), "application/pdf")},
    ).status_code == 400
    student_materials = requests.get(f"{BASE_URL}/api/materials", headers=api["student"])
    assert student_materials.status_code == 200
    assert any(x["id"] == item["id"] for x in student_materials.json())
    download = requests.get(f"{BASE_URL}/api/materials/{item['id']}/download", headers=api["student"])
    assert download.status_code == 200 and download.json()["filename"] == "lesson.pdf"
    file_response = requests.get(f"{BASE_URL}/api/materials/{item['id']}/file", headers=api["student"])
    assert file_response.status_code == 200 and file_response.content == b"PDF test content"


def test_quiz_creation_answer_key_protection_and_scoring(api):
    question = {"question": "2 + 2?", "options": ["3", "4", "5", "6"], "correct": "B"}
    response = requests.post(f"{BASE_URL}/api/teacher/quizzes", headers=api["teacher"], json={"title": f"TEST Quiz {uuid.uuid4()}", "questions": [question]})
    assert response.status_code == 200 and "questions" not in response.json()
    quiz_id = response.json()["id"]
    dashboard = requests.get(f"{BASE_URL}/api/dashboard", headers=api["student"])
    assert dashboard.status_code == 200
    quiz = next(x for x in dashboard.json()["quizzes"] if x["id"] == quiz_id)
    assert "correct" not in quiz["questions"][0]
    result = requests.post(f"{BASE_URL}/api/quizzes/{quiz_id}/submit", headers=api["student"], json={"answers": ["B"]})
    assert result.status_code == 200 and result.json()["score"] == 100 and result.json()["completion"] == "Completed"


def test_assignment_submission_grading_final_score_and_notifications(api):
    response = requests.post(
        f"{BASE_URL}/api/teacher/assignments", headers=api["teacher"],
        data={"title": f"TEST Assignment {uuid.uuid4()}", "description": "test", "deadline": "30 Sep 2026"},
    )
    assert response.status_code == 200, response.text
    assignment_id = response.json()["id"]
    submission = requests.post(
        f"{BASE_URL}/api/assignments/{assignment_id}/submit", headers=api["student"],
        files={"file": ("answer.docx", b"answer", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert submission.status_code == 200 and submission.json()["status"] == "Submitted"
    submission_id = submission.json()["id"]
    listed = requests.get(f"{BASE_URL}/api/teacher/submissions", headers=api["teacher"])
    assert listed.status_code == 200 and any(x["id"] == submission_id for x in listed.json())
    graded = requests.patch(f"{BASE_URL}/api/teacher/submissions/{submission_id}", headers=api["teacher"], json={"score": 80, "feedback": "Good work"})
    # The student completed the prior one-question quiz at 100, so 60/40 weighting is 92.
    assert graded.status_code == 200 and graded.json()["final_score"] == 92 and graded.json()["feedback"] == "Good work"
    notifications = requests.get(f"{BASE_URL}/api/notifications", headers=api["student"])
    assert notifications.status_code == 200 and any(x["kind"] == "grade" for x in notifications.json())


def test_feature_role_boundaries(api):
    checks = [
        requests.get(f"{BASE_URL}/api/teacher/submissions", headers=api["student"]),
        requests.post(f"{BASE_URL}/api/teacher/quizzes", headers=api["student"], json={"title": "x", "questions": []}),
        requests.post(f"{BASE_URL}/api/quizzes/not-a-quiz/submit", headers=api["teacher"], json={"answers": []}),
        requests.post(f"{BASE_URL}/api/assignments/not-an-assignment/submit", headers=api["teacher"], files={"file": ("x.pdf", b"x", "application/pdf")}),
        requests.get(f"{BASE_URL}/api/admin/classes", headers=api["teacher"]),
    ]
    assert all(response.status_code == 403 for response in checks), [(r.status_code, r.text) for r in checks]