from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    data_dir: str = "data"
    log_level: str = "INFO"
    mapbox_token: str = ""

    # Source toggles
    enable_who_don: bool = True
    enable_who_eios: bool = True
    enable_promed: bool = True
    enable_ecdc: bool = True
    enable_woah: bool = True

    model_config = {"env_prefix": "SENTINEL_"}


settings = Settings()
