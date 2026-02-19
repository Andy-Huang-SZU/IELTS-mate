from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.schemas.settings import (
    SettingsPayload,
    SettingsResponse,
    SettingsUpdateRequest,
    TestConnectionData,
    TestConnectionRequest,
    TestConnectionResponse,
)
from app.schemas.vocabulary import VocabSettingsData, VocabSettingsResponse
from app.services.settings_service import get_settings, mask_payload, patch_settings, get_vocab_settings, save_vocab_settings
from app.services.llm.factory import create_llm_client

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_all_settings(session: AsyncSession = Depends(get_db_session)) -> SettingsResponse:
    payload = await get_settings(session)
    return SettingsResponse(success=True, data=mask_payload(payload))


@router.put("", response_model=SettingsResponse)
async def update_settings(
    request: SettingsUpdateRequest, session: AsyncSession = Depends(get_db_session)
) -> SettingsResponse:
    payload = await patch_settings(session, request)
    return SettingsResponse(success=True, data=mask_payload(payload))


@router.post("/test-connection", response_model=TestConnectionResponse)
async def test_connection(request: TestConnectionRequest) -> TestConnectionResponse:
    if request.service_type != "llm":
        return TestConnectionResponse(
            success=True,
            data=TestConnectionData(
                connected=False,
                latency_ms=0,
                model_info=request.model,
                message=f"Unsupported service_type: {request.service_type}",
            ),
            message="ok",
        )

    payload = SettingsPayload(
        llm_provider=request.provider,
        llm_api_key=request.api_key,
        llm_base_url=request.base_url,
        llm_model=request.model,
    )
    client = create_llm_client(payload=payload)
    result = await client.test_connection()
    return TestConnectionResponse(
        success=True,
        data=TestConnectionData(
            connected=result.connected,
            latency_ms=result.latency_ms,
            model_info=result.model_info,
            message=result.message or "ok",
        ),
        message="ok",
    )


@router.get("/vocabulary", response_model=VocabSettingsResponse)
async def get_vocabulary_settings(session: AsyncSession = Depends(get_db_session)) -> VocabSettingsResponse:
    data = await get_vocab_settings(session)
    return VocabSettingsResponse(data=data)


@router.put("/vocabulary", response_model=VocabSettingsResponse)
async def update_vocabulary_settings(
    request: VocabSettingsData, session: AsyncSession = Depends(get_db_session)
) -> VocabSettingsResponse:
    data = await save_vocab_settings(session, request)
    return VocabSettingsResponse(data=data)
