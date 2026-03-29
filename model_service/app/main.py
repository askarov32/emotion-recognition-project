from fastapi import FastAPI
from app.routes.inference import router as inference_router

app = FastAPI(title="Model Service")

app.include_router(inference_router)


@app.get("/health")
async def health():
    return {"status": "ok"}