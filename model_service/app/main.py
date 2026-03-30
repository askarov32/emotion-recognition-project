from fastapi import FastAPI
from app.routes.inference import router as inference_router

app = FastAPI(
    title="Model Service",
    docs_url=None,       # Отключение Swagger
    redoc_url=None,      # Отключение ReDoc
    openapi_url=None     # Отключение OpenAPI схемы
)

app.include_router(inference_router)


@app.get("/health")
async def health():
    return {"status": "ok"}