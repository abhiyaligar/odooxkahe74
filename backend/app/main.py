from fastapi import FastAPI
from app.core.database import engine
from app.models.models import Base
from app.api.v1.auth import router as auth_router
from app.api.v1.products import router as products_router
from app.api.v1.sales import router as sales_router
from app.core.config import settings

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(products_router, prefix="/api/v1/products", tags=["products"])
app.include_router(sales_router, prefix="/api/v1/sales-orders", tags=["sales"])

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}

from app.api import endpoints
app.include_router(endpoints.router, prefix="/api")
