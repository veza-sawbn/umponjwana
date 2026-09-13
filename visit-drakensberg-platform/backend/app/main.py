import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.api.v1 import (
    auth,
    users,
    suppliers,
    listings,
    bookings,
    payments,
    reviews,
    notifications,
    admin,
    messages,
    discounts,
    rooms,
    guides,
    packages,
    events,
    shuttle,
    admin_content,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Visit Drakensberg API starting up (environment=%s)", settings.ENVIRONMENT
    )
    yield
    logger.info("Visit Drakensberg API shutting down")


# The interactive docs publish the complete API surface — every admin route,
# every schema, every parameter — and they were served unconditionally in
# production (audit finding M4). They are a development tool, so they are
# enabled only outside production now. Set ENVIRONMENT to anything but
# "production" (or run locally) to get them back.
_DOCS_ENABLED = settings.ENVIRONMENT.lower() != "production"

app = FastAPI(
    title="Visit Drakensberg API",
    version="1.0.0",
    description="Backend API for the Visit Drakensberg tourism platform",
    docs_url="/docs" if _DOCS_ENABLED else None,
    redoc_url="/redoc" if _DOCS_ENABLED else None,
    openapi_url="/openapi.json" if _DOCS_ENABLED else None,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(suppliers.router, prefix=API_PREFIX)
app.include_router(listings.router, prefix=API_PREFIX)
app.include_router(bookings.router, prefix=API_PREFIX)
app.include_router(payments.router, prefix=API_PREFIX)
app.include_router(reviews.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(messages.router, prefix=API_PREFIX)
app.include_router(discounts.router, prefix=API_PREFIX)
app.include_router(rooms.router, prefix=API_PREFIX)
app.include_router(guides.router, prefix=API_PREFIX)
app.include_router(packages.router, prefix=API_PREFIX)
app.include_router(events.router, prefix=API_PREFIX)
app.include_router(shuttle.router, prefix=API_PREFIX)
app.include_router(admin_content.router, prefix=API_PREFIX)


# ---------------------------------------------------------------------------
# Root routes
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "service": "visit-drakensberg-api"}


@app.get("/", include_in_schema=False)
async def root():
    # Without the docs to redirect to in production, say so rather than
    # bouncing the caller to a 404.
    if not _DOCS_ENABLED:
        return {"service": "visit-drakensberg-api", "status": "ok"}
    return RedirectResponse(url="/docs")
