from fastapi import FastAPI
from app.routes.inference import router as inference_router
from app.services.predictor import _load_model

app = FastAPI(
    title="Model Service",
    docs_url=None,       # Отключение Swagger
    redoc_url=None,      # Отключение ReDoc
    openapi_url=None     # Отключение OpenAPI схемы
)

@app.on_event("startup")
async def startup_event():
    _load_model()
    print("[model_service] Модель успешно загружена при старте")

app.include_router(inference_router)


@app.get("/health")
async def health():
    return {"status": "ok"}