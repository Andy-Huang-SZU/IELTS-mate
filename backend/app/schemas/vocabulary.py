from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class VocabularyItem(BaseModel):
    id: int
    word: str
    phonetic: str
    definition: str
    example: str
    interval: int
    repetition: int
    ease_factor: float
    status: str
    next_review: date | None

    model_config = ConfigDict(from_attributes=True)


class VocabularyReviewListData(BaseModel):
    total_due: int
    words: list[VocabularyItem]


class VocabularyReviewListResponse(BaseModel):
    success: bool = True
    data: VocabularyReviewListData
    message: str = "ok"


class VocabularyReviewRequest(BaseModel):
    quality: int = Field(description="0=Again, 2=Hard, 3=Good, 5=Easy")


class VocabularyReviewResultData(BaseModel):
    word_id: int
    new_interval: int
    new_repetition: int
    new_ease_factor: float
    next_review: date
    status: str


class VocabularyReviewResultResponse(BaseModel):
    success: bool = True
    data: VocabularyReviewResultData
    message: str = "ok"


class VocabularyStatsData(BaseModel):
    total_words: int
    new_words: int
    learning_words: int
    mastered_words: int
    due_today: int
    streak_days: int


class VocabularyStatsResponse(BaseModel):
    success: bool = True
    data: VocabularyStatsData
    message: str = "ok"


class HeatmapPoint(BaseModel):
    date: date
    count: int


class VocabularyHeatmapData(BaseModel):
    year: int
    data: list[HeatmapPoint]


class VocabularyHeatmapResponse(BaseModel):
    success: bool = True
    data: VocabularyHeatmapData
    message: str = "ok"


class VocabularyLearningCurveData(BaseModel):
    dates: list[date]
    mastered: list[int]
    learning: list[int]


class VocabularyLearningCurveResponse(BaseModel):
    success: bool = True
    data: VocabularyLearningCurveData
    message: str = "ok"


class VocabularySearchData(BaseModel):
    total: int
    page: int
    page_size: int
    words: list[VocabularyItem]


class VocabularySearchResponse(BaseModel):
    success: bool = True
    data: VocabularySearchData
    message: str = "ok"
