from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    deployment_env: str = "production"
    anthropic_api_key: str = ""
    who_eios_api_key: str = ""
    data_dir: str = "data"
    log_level: str = "INFO"
    mapbox_token: str = ""
    api_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    api_write_key: str = ""
    max_event_age_days: int = 30

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
    enable_nnsid: bool = False
    enable_sentinella: bool = False
    enable_bag_bulletin: bool = False
    enable_rasff: bool = False
    enable_wastewater: bool = False

    # Swiss source credentials
    nnsid_api_url: str = ""
    nnsid_api_key: str = ""
    sentinella_api_url: str = ""
    bag_bulletin_url: str = "https://www.bag.admin.ch/bag/de/home/krankheiten/infektionskrankheiten-bekaempfen/meldesysteme-infektionskrankheiten/meldepflichtige-ik/aktuelle-ausbrueche-und-epidemien.html"
    rasff_api_url: str = "https://webgate.ec.europa.eu/rasff-window/backend/public/notification"
    wastewater_api_url: str = ""

    model_config = {"env_prefix": "SENTINEL_"}


settings = Settings()
