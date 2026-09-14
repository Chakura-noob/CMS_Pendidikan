"""Regression coverage for authentication, role dashboards, and admin records."""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

CREDS = {
    "admin": ("admin", "admin123"),
    "teacher": ("guru.budi", "password"),
    "student": ("siswa.budi", "password"),
}


@pytest.fixture(scope="module")
def client():
    return requests.Session()


@pytest.fixture(scope="module")
def tokens(client):
    result = {}
    for role, (username, password) in CREDS.items():
        response = client.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password})
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["user"]["role"] == role
        result[role] = payload["token"]
    return result


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_login_invalid_credentials(client):
    response = client.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert response.status_code == 401
    assert "incorrect" in response.json()["detail"].lower()


@pytest.mark.parametrize("role", ["admin", "teacher", "student"])
def test_dashboard_by_role(client, tokens, role):
    response = client.get(f"{BASE_URL}/api/dashboard", headers=auth(tokens[role]))
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["user"]["role"] == role
    assert data["period"]["active"] is True
    if role == "admin":
        assert data["counts"]["teachers"] >= 1
    elif role == "teacher":
        assert len(data["assignments"]) >= 1
    else:
        assert data["attendance"][0]["label"] == "Hadir"
        assert any(task["title"] == "Algebra Practice Set" for task in data["tasks"])


def test_role_boundaries(client, tokens):
    response = client.get(f"{BASE_URL}/api/admin/classes", headers=auth(tokens["teacher"]))
    assert response.status_code == 403
    response = client.post(f"{BASE_URL}/api/admin/classes", headers=auth(tokens["student"]), json={"name": "Should Not Exist"})
    assert response.status_code == 403
    response = client.get(f"{BASE_URL}/api/dashboard")
    assert response.status_code == 401


def test_admin_create_and_list_subject(client, tokens):
    name = "TEST_Linear Algebra"
    response = client.post(f"{BASE_URL}/api/admin/subjects", headers=auth(tokens["admin"]), json={"name": name, "detail": "TEST_ subject"})
    assert response.status_code == 200, response.text
    created = response.json()
    assert created["name"] == name and isinstance(created["id"], str)
    listed = client.get(f"{BASE_URL}/api/admin/subjects", headers=auth(tokens["admin"]))
    assert listed.status_code == 200
    assert any(item["id"] == created["id"] and item["name"] == name for item in listed.json())