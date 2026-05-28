from fastapi import APIRouter

from app.api.routes.settings import router as settings_router
from app.api.routes.speaking import router as speaking_router
from app.api.routes.vocabulary import router as vocabulary_router
from app.api.routes.writing import router as writing_router

api_router = APIRouter()
api_router.include_router(settings_router)
api_router.include_router(speaking_router)
api_router.include_router(vocabulary_router)
api_router.include_router(writing_router)
