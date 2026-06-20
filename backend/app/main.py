from fastapi import FastAPI

app = FastAPI(title="Oddo API", version="1.0.0")

@app.get("/")
def read_root():
    return {"message": "Welcome to Oddo API"}
