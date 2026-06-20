import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.pg_models import User, UserRole

pytestmark = pytest.mark.asyncio

async def test_signup_success(client: AsyncClient, db_session: AsyncSession):
    # Test registration of a new user
    signup_data = {
        "name": "Test User",
        "email": "testuser@example.com",
        "password": "securepassword123",
        "role": "SalesUser"
    }
    response = await client.post("/api/v1/auth/signup", json=signup_data)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["name"] == signup_data["name"]
    assert res_json["email"] == signup_data["email"]
    assert res_json["role"] == signup_data["role"]
    assert "id" in res_json
    assert "is_active" in res_json
    assert res_json["is_active"] is True

    # Verify database record
    result = await db_session.execute(select(User).where(User.email == signup_data["email"]))
    db_user = result.scalars().first()
    assert db_user is not None
    assert db_user.name == signup_data["name"]
    assert db_user.role == UserRole.SalesUser

async def test_signup_duplicate_email(client: AsyncClient):
    signup_data = {
        "name": "Duplicate User",
        "email": "duplicate@example.com",
        "password": "somepassword",
        "role": "StoreAdmin"
    }
    
    # First signup
    response = await client.post("/api/v1/auth/signup", json=signup_data)
    assert response.status_code == 201
    
    # Second signup with same email
    response2 = await client.post("/api/v1/auth/signup", json=signup_data)
    assert response2.status_code == 400
    assert response2.json()["detail"] == "Email already registered"

async def test_login_success(client: AsyncClient):
    signup_data = {
        "name": "Login User",
        "email": "loginuser@example.com",
        "password": "mysecretpassword",
        "role": "BusinessOwner"
    }
    await client.post("/api/v1/auth/signup", json=signup_data)

    # Attempt login (FastAPI OAuth2PasswordRequestForm uses form-data)
    login_data = {
        "username": signup_data["email"],
        "password": signup_data["password"]
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200
    res_json = response.json()
    assert "access_token" in res_json
    assert res_json["token_type"] == "bearer"

async def test_login_incorrect_password(client: AsyncClient):
    signup_data = {
        "name": "Wrong Pass User",
        "email": "wrongpass@example.com",
        "password": "correctpassword",
        "role": "SalesUser"
    }
    await client.post("/api/v1/auth/signup", json=signup_data)

    # Attempt login with wrong password
    login_data = {
        "username": signup_data["email"],
        "password": "wrongpassword"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"

async def test_login_non_existent_user(client: AsyncClient):
    # Attempt login for user who doesn't exist
    login_data = {
        "username": "nonexistent@example.com",
        "password": "password123"
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"

async def test_long_password_handling(client: AsyncClient):
    # Verify that a long password (> 72 characters) is handled without ValueError
    long_pwd = "a" * 100
    signup_data = {
        "name": "Long Password User",
        "email": "longpwd@example.com",
        "password": long_pwd,
        "role": "InventoryManager"
    }
    
    response = await client.post("/api/v1/auth/signup", json=signup_data)
    assert response.status_code == 201
    
    # Test login with the long password
    login_data = {
        "username": signup_data["email"],
        "password": long_pwd
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()
