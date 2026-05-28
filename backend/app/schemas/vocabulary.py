from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class VocabularyItem(BaseModel):
    id: int
    word: str
    phonetic: str
    definition: str
    translation: str
    full_translation: str = ""
    pos: str = ""
    example: str
    interval: int
    repetition: int
    ease_factor: float
    status: str
    difficulty: int = 3
    next_review: date | None
    bookmarked: bool = False
    note: str = ""
    wrong_count: int = 0

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
    mode: str = Field(default="review", description="review | learn_quiz | spelling | dictation")


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


# ---- New schemas for vocabulary learning upgrade ----


class TodaySummaryData(BaseModel):
    due_review: int
    new_words_learned_today: int
    daily_new_words_limit: int
    new_words_remaining: int
    total_new_words: int


class TodaySummaryResponse(BaseModel):
    success: bool = True
    data: TodaySummaryData
    message: str = "ok"


class NewWordsListData(BaseModel):
    words: list[VocabularyItem]
    today_learned: int
    daily_limit: int
    order: str = "random"


class NewWordsListResponse(BaseModel):
    success: bool = True
    data: NewWordsListData
    message: str = "ok"


class VocabSettingsData(BaseModel):
    daily_new_words_limit: int = 30
    word_order: str = "random"  # random | ielts_core | difficulty_asc | difficulty_desc | alphabetical


class VocabSettingsResponse(BaseModel):
    success: bool = True
    data: VocabSettingsData
    message: str = "ok"


class DistractorWordsData(BaseModel):
    distractors: list[str]


class DistractorWordsResponse(BaseModel):
    success: bool = True
    data: DistractorWordsData
    message: str = "ok"


# ---- Bookmark / Note / Most-wrong schemas ----


class BookmarkRequest(BaseModel):
    bookmarked: bool


class NoteRequest(BaseModel):
    note: str


class BookmarkedWordsData(BaseModel):
    total: int
    words: list[VocabularyItem]


class BookmarkedWordsResponse(BaseModel):
    success: bool = True
    data: BookmarkedWordsData
    message: str = "ok"


class MostWrongWord(BaseModel):
    id: int
    word: str
    translation: str
    phonetic: str = ""
    pos: str = ""
    wrong_count: int
    difficulty: int = 3
    status: str = "new"
    bookmarked: bool = False
    note: str = ""

    model_config = ConfigDict(from_attributes=True)


class MostWrongWordsData(BaseModel):
    words: list[MostWrongWord]


class MostWrongWordsResponse(BaseModel):
    success: bool = True
    data: MostWrongWordsData
    message: str = "ok"


# ---- Activity Trend schemas (for Stats page) ----


class ActivityTrendPoint(BaseModel):
    date: date
    total: int
    review: int = 0
    learn_quiz: int = 0
    spelling: int = 0
    dictation: int = 0


class ActivityTrendData(BaseModel):
    days: int
    data: list[ActivityTrendPoint]


class ActivityTrendResponse(BaseModel):
    success: bool = True
    data: ActivityTrendData
    message: str = "ok"
