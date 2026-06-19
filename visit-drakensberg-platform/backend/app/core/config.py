from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_JWT_SECRET: str
    REDIS_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RESEND_API_KEY: str
    FROM_EMAIL: str
    FRONTEND_URL: str
    BACKEND_URL: str
    ENVIRONMENT: str = "production"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
