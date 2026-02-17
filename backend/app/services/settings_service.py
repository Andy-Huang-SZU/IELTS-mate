from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import Setting
from app.schemas.settings import SettingsPayload, SettingsUpdateRequest

SETTINGS_KEY = "app_settings_v1"


def mask_key(raw: str) -> str:
    if len(raw) < 8:
        return ""
    return f"{raw[:3]}***{raw[-3:]}"


def mask_payload(payload: SettingsPayload) -> SettingsPayload:
    masked = payload.model_copy(deep=True)
    masked.llm_api_key = mask_key(masked.llm_api_key)
    masked.stt_api_key = mask_key(masked.stt_api_key)
    masked.tts_api_key = mask_key(masked.tts_api_key)
    return masked


async def get_settings(session: AsyncSession) -> SettingsPayload:
    result = await session.execute(select(Setting).where(Setting.key == SETTINGS_KEY))
    row = result.scalar_one_or_none()
    if not row:
        return SettingsPayload()
    data = json.loads(row.value)
    return SettingsPayload(**data)


async def save_settings(session: AsyncSession, payload: SettingsPayload) -> SettingsPayload:
    result = await session.execute(select(Setting).where(Setting.key == SETTINGS_KEY))
    row = result.scalar_one_or_none()
    serialized = payload.model_dump_json()
    if row:
        row.value = serialized
    else:
        row = Setting(key=SETTINGS_KEY, value=serialized)
        session.add(row)

    await session.commit()
    return payload


async def patch_settings(session: AsyncSession, updates: SettingsUpdateRequest) -> SettingsPayload:
    current = await get_settings(session)
    patch_data = updates.model_dump(exclude_none=True)
    merged = current.model_copy(update=patch_data)
    return await save_settings(session, merged)
