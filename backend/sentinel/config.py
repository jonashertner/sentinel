from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    who_eios_api_key: str = ""
    data_dir: str = "data"
    log_level: str = "INFO"
    mapbox_token: str = ""
    api_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    api_write_key: str = ""

    # Database — set store_backend="postgres" and database_url to use PostgreSQL
    store_backend: str = "file"  # "file" or "postgres"
    database_url: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel"

    # Source toggles
    enable_who_don: bool = True
    enable_who_eios: bool = True
    enable_promed: bool = True
    enable_ecdc: bool = True
    enable_woah: bool = True
    enable_beacon: bool = True
    enable_cidrap: bool = True

    model_config = {"env_prefix": "SENTINEL_"}


settings = Settings()
