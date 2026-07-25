"""Test live server endpoints."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from starlette.testclient import TestClient
from app.main import app

engine = create_engine(settings.database_url_fixed)
Session = sessionmaker(bind=engine)
db = Session()

# Find user and their password
row = db.execute(
    text("SELECT email, password_hashed FROM users WHERE email = 'ali@gmail.com'")
).fetchone()
print(f"User: {row[0]}, hashed_pwd: {row[1][:20]}...")
db.close()

client = TestClient(app)

# Attempt login
resp = client.post("/auth/login", json={"email": "ali@gmail.com", "password": "12345678"})
print(f"Login: {resp.status_code}")
if resp.status_code != 200:
    resp = client.post("/auth/login", json={"email": "ali@gmail.com", "password": "123456"})
    print(f"Login (alt pwd): {resp.status_code}")
if resp.status_code != 200:
    resp = client.post("/auth/login", json={"email": "ali@gmail.com", "password": "password"})
    print(f"Login (alt2 pwd): {resp.status_code}")

if resp.status_code == 200:
    token = resp.json().get("access_token")
    print(f"Got token: {token[:30]}...")

    # Test my-permissions
    resp = client.get("/rbac/my-permissions", headers={"Authorization": f"Bearer {token}"})
    print(f"GET /rbac/my-permissions: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        perms = data.get("permissions", [])
        roles = data.get("roles", [])
        print(f"  permissions count: {len(perms)}")
        print(f"  roles: {roles}")
        print(f"  sample perms: {sorted(perms)[:5]}")
    else:
        print(f"  Error: {resp.text[:300]}")

    # Test routes
    for path in ["/dashboard/stats", "/crm/leads", "/finance/accounts",
                  "/properties", "/tenants", "/company/currency"]:
        resp = client.get(path, headers={"Authorization": f"Bearer {token}"})
        status = "OK" if resp.status_code < 400 else f"FAIL ({resp.status_code})"
        print(f"  GET {path}: {status}")
else:
    print(f"Could not login. Response: {resp.text[:300]}")
    # Try admin
    row2 = db.execute(text("SELECT email FROM users WHERE email LIKE '%admin%' LIMIT 1")).fetchone()
    if row2:
        print(f"Try admin: {row2[0]}")
