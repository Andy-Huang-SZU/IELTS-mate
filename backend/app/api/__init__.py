from fastapi import APIRouter

from app.api.routes.settings import router as settings_router
from app.api.routes.vocabulary import router as vocabulary_router

api_router = APIRouter()
api_router.include_router(settings_router)
api_router.include_router(vocabulary_router)
