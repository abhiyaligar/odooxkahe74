import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.pg_models import Vendor, Customer, VendorCategory, CustomerCategory, PaymentTerms

pytestmark = pytest.mark.asyncio

# --- Vendor API Tests ---

async def test_create_vendor_success(client: AsyncClient, db_session: AsyncSession):
    vendor_data = {
        "name": "Wood Supplier Ltd",
        "email": "wood@supplier.com",
        "phone": "555-9000",
        "category": "RawMaterials",
        "payment_terms": "Net30"
    }
    response = await client.post("/api/v1/vendors/", json=vendor_data)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["name"] == vendor_data["name"]
    assert res_json["email"] == vendor_data["email"]
    assert res_json["category"] == "RawMaterials"
    assert res_json["payment_terms"] == "Net30"
    assert res_json["outstanding_payable"] == 0.0
    assert "id" in res_json

    # Verify db record
    result = await db_session.execute(select(Vendor).where(Vendor.id == uuid.UUID(res_json["id"])))
    db_vendor = result.scalars().first()
    assert db_vendor is not None
    assert db_vendor.category == VendorCategory.RawMaterials
    assert db_vendor.payment_terms == PaymentTerms.Net30

async def test_create_vendor_invalid_category(client: AsyncClient):
    vendor_data = {
        "name": "Invalid Category Vendor",
        "category": "NonExistentCategory"
    }
    response = await client.post("/api/v1/vendors/", json=vendor_data)
    # FastAPI returns 422 Unprocessable Entity for invalid enum values in request bodies
    assert response.status_code == 422

async def test_get_vendor_success(client: AsyncClient, db_session: AsyncSession):
    vendor = Vendor(
        id=uuid.uuid4(),
        name="Logistics Pro",
        category=VendorCategory.Logistics,
        payment_terms=PaymentTerms.Manual
    )
    db_session.add(vendor)
    await db_session.commit()

    response = await client.get(f"/api/v1/vendors/{vendor.id}")
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["name"] == "Logistics Pro"
    assert res_json["category"] == "Logistics"
    assert res_json["payment_terms"] == "Manual"

async def test_get_vendor_not_found(client: AsyncClient):
    random_id = uuid.uuid4()
    response = await client.get(f"/api/v1/vendors/{random_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Vendor not found"

async def test_list_vendors(client: AsyncClient, db_session: AsyncSession):
    v1 = Vendor(name="Supplier A", category=VendorCategory.RawMaterials)
    v2 = Vendor(name="Supplier B", category=VendorCategory.Services)
    db_session.add_all([v1, v2])
    await db_session.commit()

    response = await client.get("/api/v1/vendors/")
    assert response.status_code == 200
    res_json = response.json()
    assert len(res_json) >= 2
    names = [v["name"] for v in res_json]
    assert "Supplier A" in names
    assert "Supplier B" in names

async def test_update_vendor_success(client: AsyncClient, db_session: AsyncSession):
    vendor = Vendor(
        id=uuid.uuid4(),
        name="Initial Supplier",
        category=VendorCategory.RawMaterials,
        payment_terms=PaymentTerms.PrePaid
    )
    db_session.add(vendor)
    await db_session.commit()

    update_data = {
        "name": "Updated Supplier Ltd",
        "category": "FinishedGoods",
        "payment_terms": "Net30"
    }
    response = await client.put(f"/api/v1/vendors/{vendor.id}", json=update_data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["name"] == "Updated Supplier Ltd"
    assert res_json["category"] == "FinishedGoods"
    assert res_json["payment_terms"] == "Net30"

async def test_delete_vendor_success(client: AsyncClient, db_session: AsyncSession):
    vendor = Vendor(
        id=uuid.uuid4(),
        name="To Be Deleted Vendor",
        category=VendorCategory.Services
    )
    db_session.add(vendor)
    await db_session.commit()

    response = await client.delete(f"/api/v1/vendors/{vendor.id}")
    assert response.status_code == 204

    # Verify lookups fail
    check_res = await client.get(f"/api/v1/vendors/{vendor.id}")
    assert check_res.status_code == 404

# --- Customer API Tests ---

async def test_create_customer_success(client: AsyncClient, db_session: AsyncSession):
    customer_data = {
        "name": "Global Corp",
        "email": "purchasing@globalcorp.com",
        "phone": "555-4321",
        "category": "Corporate"
    }
    response = await client.post("/api/v1/customers/", json=customer_data)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["name"] == customer_data["name"]
    assert res_json["email"] == customer_data["email"]
    assert res_json["category"] == "Corporate"
    assert "id" in res_json

    # Verify db record
    result = await db_session.execute(select(Customer).where(Customer.id == uuid.UUID(res_json["id"])))
    db_customer = result.scalars().first()
    assert db_customer is not None
    assert db_customer.category == CustomerCategory.Corporate

async def test_create_customer_invalid_category(client: AsyncClient):
    customer_data = {
        "name": "Invalid Customer",
        "category": "UnknownCategory"
    }
    response = await client.post("/api/v1/customers/", json=customer_data)
    assert response.status_code == 422

async def test_get_customer_success(client: AsyncClient, db_session: AsyncSession):
    customer = Customer(
        id=uuid.uuid4(),
        name="John Doe",
        category=CustomerCategory.Retail
    )
    db_session.add(customer)
    await db_session.commit()

    response = await client.get(f"/api/v1/customers/{customer.id}")
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["name"] == "John Doe"
    assert res_json["category"] == "Retail"

async def test_list_customers(client: AsyncClient, db_session: AsyncSession):
    c1 = Customer(name="Customer A", category=CustomerCategory.Wholesale)
    c2 = Customer(name="Customer B", category=CustomerCategory.Distributor)
    db_session.add_all([c1, c2])
    await db_session.commit()

    response = await client.get("/api/v1/customers/")
    assert response.status_code == 200
    res_json = response.json()
    assert len(res_json) >= 2
    names = [c["name"] for c in res_json]
    assert "Customer A" in names
    assert "Customer B" in names

async def test_update_customer_success(client: AsyncClient, db_session: AsyncSession):
    customer = Customer(
        id=uuid.uuid4(),
        name="Original Customer",
        category=CustomerCategory.Retail
    )
    db_session.add(customer)
    await db_session.commit()

    update_data = {
        "name": "Updated Customer",
        "category": "Wholesale"
    }
    response = await client.put(f"/api/v1/customers/{customer.id}", json=update_data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["name"] == "Updated Customer"
    assert res_json["category"] == "Wholesale"

async def test_delete_customer_success(client: AsyncClient, db_session: AsyncSession):
    customer = Customer(
        id=uuid.uuid4(),
        name="To Be Deleted Customer",
        category=CustomerCategory.Retail
    )
    db_session.add(customer)
    await db_session.commit()

    response = await client.delete(f"/api/v1/customers/{customer.id}")
    assert response.status_code == 204

    # Verify lookups fail
    check_res = await client.get(f"/api/v1/customers/{customer.id}")
    assert check_res.status_code == 404

async def test_list_raw_material_vendors(client: AsyncClient, db_session: AsyncSession):
    v1 = Vendor(name="Supplier RM", category=VendorCategory.RawMaterials)
    v2 = Vendor(name="Supplier SRV", category=VendorCategory.Services)
    db_session.add_all([v1, v2])
    await db_session.commit()

    response = await client.get("/api/v1/vendors/raw-materials")
    assert response.status_code == 200
    res_json = response.json()
    names = [v["name"] for v in res_json]
    assert "Supplier RM" in names
    assert "Supplier SRV" not in names

async def test_list_service_vendors(client: AsyncClient, db_session: AsyncSession):
    v1 = Vendor(name="Supplier RM 2", category=VendorCategory.RawMaterials)
    v2 = Vendor(name="Supplier SRV 2", category=VendorCategory.Services)
    db_session.add_all([v1, v2])
    await db_session.commit()

    response = await client.get("/api/v1/vendors/services")
    assert response.status_code == 200
    res_json = response.json()
    names = [v["name"] for v in res_json]
    assert "Supplier SRV 2" in names
    assert "Supplier RM 2" not in names

async def test_list_retail_customers(client: AsyncClient, db_session: AsyncSession):
    c1 = Customer(name="Retail Customer", category=CustomerCategory.Retail)
    c2 = Customer(name="Wholesale Customer", category=CustomerCategory.Wholesale)
    db_session.add_all([c1, c2])
    await db_session.commit()

    response = await client.get("/api/v1/customers/retail")
    assert response.status_code == 200
    res_json = response.json()
    names = [c["name"] for c in res_json]
    assert "Retail Customer" in names
    assert "Wholesale Customer" not in names

async def test_list_wholesale_customers(client: AsyncClient, db_session: AsyncSession):
    c1 = Customer(name="Retail Customer 2", category=CustomerCategory.Retail)
    c2 = Customer(name="Wholesale Customer 2", category=CustomerCategory.Wholesale)
    db_session.add_all([c1, c2])
    await db_session.commit()

    response = await client.get("/api/v1/customers/wholesale")
    assert response.status_code == 200
    res_json = response.json()
    names = [c["name"] for c in res_json]
    assert "Wholesale Customer 2" in names
    assert "Retail Customer 2" not in names

