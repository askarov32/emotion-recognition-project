from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_service_url: str = "http://model_service:8001"


settings = Settings()