from __future__ import annotations

import time

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
from app.services.stt import create_stt_client
from app.services.tts import create_tts_client

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
    if request.service_type == "llm":
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

    if request.service_type == "stt":
        start = time.time()
        try:
            client = create_stt_client(
                provider=request.provider,
                api_key=request.api_key,
                base_url=request.base_url,
                model=request.model,
            )
            # Test by sending a tiny silent audio to check if the API key and endpoint are valid
            # We use a minimal WAV header for a 0.1s silent clip
            silent_wav = _generate_silent_wav(sample_rate=16000, duration_ms=100)
            await client.transcribe(audio_data=silent_wav, format="wav")
            latency_ms = int((time.time() - start) * 1000)
            return TestConnectionResponse(
                success=True,
                data=TestConnectionData(
                    connected=True,
                    latency_ms=latency_ms,
                    model_info=request.model,
                    message="STT connection successful",
                ),
                message="ok",
            )
        except Exception as e:
            latency_ms = int((time.time() - start) * 1000)
            return TestConnectionResponse(
                success=True,
                data=TestConnectionData(
                    connected=False,
                    latency_ms=latency_ms,
                    model_info=request.model,
                    message=f"STT connection failed: {str(e)[:200]}",
                ),
                message="ok",
            )

    if request.service_type == "tts":
        start = time.time()
        try:
            client = create_tts_client(
                provider=request.provider,
                api_key=request.api_key,
                base_url=request.base_url,
                model=request.model,
            )
            result = await client.synthesize(text="Hello", voice="alloy")
            latency_ms = int((time.time() - start) * 1000)
            connected = result.audio_data is not None and len(result.audio_data) > 0
            return TestConnectionResponse(
                success=True,
                data=TestConnectionData(
                    connected=connected,
                    latency_ms=latency_ms,
                    model_info=request.model,
                    message="TTS connection successful" if connected else "TTS returned empty audio",
                ),
                message="ok",
            )
        except Exception as e:
            latency_ms = int((time.time() - start) * 1000)
            return TestConnectionResponse(
                success=True,
                data=TestConnectionData(
                    connected=False,
                    latency_ms=latency_ms,
                    model_info=request.model,
                    message=f"TTS connection failed: {str(e)[:200]}",
                ),
                message="ok",
            )

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


def _generate_silent_wav(sample_rate: int = 16000, duration_ms: int = 100) -> bytes:
    """Generate a minimal silent WAV file for STT connection testing."""
    import struct
    num_samples = int(sample_rate * duration_ms / 1000)
    data_size = num_samples * 2  # 16-bit mono
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,
        b'WAVE',
        b'fmt ',
        16,      # chunk size
        1,       # PCM format
        1,       # mono
        sample_rate,
        sample_rate * 2,  # byte rate
        2,       # block align
        16,      # bits per sample
        b'data',
        data_size,
    )
    return header + b'\x00' * data_size


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
