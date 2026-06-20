from fastapi import FastAPI
from app.api.v1.auth import router as auth_router
from app.api.v1.products import router as products_router
from app.api.v1.sales import router as sales_router
from app.api.v1.vendors import router as vendors_router
from app.api.v1.customers import router as customers_router
from app.api.v1.boms import router as boms_router
from app.api.v1.manufacturing import router as manufacturing_router
from app.api.v1.recipes import router as recipes_router
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

origins = [
    "https://odooxkahe74-frontend.onrender.com",
    "http://localhost:5173",
    "https://localhost:5173",
    "http://localhost:8000",
    "https://localhost:8000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
    "https://odooxkahe74.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(products_router, prefix="/api/v1/products", tags=["products"])
app.include_router(sales_router, prefix="/api/v1/sales-orders", tags=["sales"])
app.include_router(vendors_router, prefix="/api/v1/vendors", tags=["vendors"])
app.include_router(customers_router, prefix="/api/v1/customers", tags=["customers"])
app.include_router(boms_router, prefix="/api/v1/boms", tags=["boms"])
app.include_router(manufacturing_router, prefix="/api/v1/manufacturing-orders", tags=["manufacturing"])
app.include_router(recipes_router, prefix="/api/v1/recipes", tags=["recipes"])

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}



