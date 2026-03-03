from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import health, ingest, lorien, notes, search, tree
from app.core.config import settings
from app.core.db import db


@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.initialize()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(notes.router, prefix=settings.api_v1_prefix)
app.include_router(tree.router, prefix=settings.api_v1_prefix)
app.include_router(search.router, prefix=settings.api_v1_prefix)
app.include_router(ingest.router, prefix=settings.api_v1_prefix)
app.include_router(lorien.router, prefix=settings.api_v1_prefix)
