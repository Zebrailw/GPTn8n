from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./data.db"
    local_password: str | None = None


settings = Settings()
