import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, RotateCcw, Minus, Plus, Flame } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import { useVocabularyStore } from '../../store/useVocabularyStore'

export function VocabularyHub(): JSX.Element {
  const navigate = useNavigate()
  const {
    stats, loadStats,
    todaySummary, loadTodaySummary,
    vocabSettings, loadVocabSettings, updateVocabSettings,
    loading
  } = useVocabularyStore()

  const [dailyLimit, setDailyLimit] = useState(30)

  useEffect(() => {
    loadStats()
    loadTodaySummary()
    loadVocabSettings()
  }, [loadStats, loadTodaySummary, loadVocabSettings])

  useEffect(() => {
    if (vocabSettings) setDailyLimit(vocabSettings.daily_new_words_limit)
  }, [vocabSettings])

  const adjustLimit = useCallback((delta: number) => {
    const next = Math.max(5, Math.min(100, dailyLimit + delta))
    setDailyLimit(next)
    updateVocabSettings({ daily_new_words_limit: next })
  }, [dailyLimit, updateVocabSettings])

  const dueReview = todaySummary?.due_review ?? 0
  const todayLearned = todaySummary?.new_words_learned_today ?? 0
  const noDue = !loading && dueReview === 0

  return (
    <PageContainer>
      <h1 className="sr-only">Vocabulary Hub</h1>

      {/* Header */}
      <header className="mb-8 animate-fade-in">
        <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Vocabulary</h2>
        <p className="mt-1 text-sm text-[#636E72]">每日复习与新词学习</p>
      </header>

      {/* Dual entry cards */}
      <div className="grid gap-4 sm:grid-cols-2 animate-fade-in" style={{ animationDelay: '0.05s' }}>
        {/* Review card */}
        <GlassCard className="flex flex-col justify-between p-6 min-h-[200px] transition-all duration-300 hover:scale-[1.01] hover:shadow-xl" hover>
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E17055]/10">
                <RotateCcw className="text-[#E17055]" size={22} />
              </div>
              <div>
                <p className="text-xs text-[#636E72] uppercase tracking-wider font-medium">今日待复习</p>
              </div>
            </div>
            <p className="font-serif text-5xl font-semibold text-[#2D3436] mb-1">
              {loading ? '...' : dueReview}
            </p>
            <p className="text-sm text-[#636E72]">个单词等待复习</p>
          </div>
          <button
            onClick={() => navigate('/vocabulary/review')}
            disabled={noDue}
            className={`mt-5 w-full rounded-xl py-3 text-sm font-medium transition-all duration-200
              ${noDue
                ? 'bg-[#B2BEC3]/20 text-[#B2BEC3] cursor-not-allowed'
                : 'bg-[#E17055] text-white shadow-lg shadow-[#E17055]/20 hover:shadow-xl hover:shadow-[#E17055]/30 hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            {noDue ? '已全部复习 ✓' : '开始复习'}
          </button>
        </GlassCard>

        {/* New words card */}
        <GlassCard className="flex flex-col justify-between p-6 min-h-[200px] transition-all duration-300 hover:scale-[1.01] hover:shadow-xl" hover>
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00B894]/10">
                <BookOpen className="text-[#00B894]" size={22} />
              </div>
              <div>
                <p className="text-xs text-[#636E72] uppercase tracking-wider font-medium">今日新词</p>
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="font-serif text-5xl font-semibold text-[#2D3436]">{todayLearned}</span>
              <span className="text-lg text-[#636E72]">/ {dailyLimit}</span>
            </div>
            <p className="text-sm text-[#636E72]">
              {todayLearned >= dailyLimit ? '今日目标已完成' : `还可学习 ${Math.max(0, dailyLimit - todayLearned)} 个`}
            </p>
          </div>

          {/* Daily limit adjuster */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2 bg-white/40 rounded-lg px-2 py-1">
              <button
                onClick={() => adjustLimit(-5)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#636E72] hover:bg-white/60 hover:text-[#2D3436] transition-all active:scale-90"
              >
                <Minus size={14} />
              </button>
              <span className="text-sm font-semibold text-[#2D3436] w-8 text-center">{dailyLimit}</span>
              <button
                onClick={() => adjustLimit(5)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#636E72] hover:bg-white/60 hover:text-[#2D3436] transition-all active:scale-90"
              >
                <Plus size={14} />
              </button>
              <span className="text-[10px] text-[#B2BEC3]">/ 天</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/vocabulary/learn')}
            className="mt-3 w-full rounded-xl bg-[#00B894] py-3 text-sm font-medium text-white shadow-lg shadow-[#00B894]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#00B894]/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            学习新词
          </button>
        </GlassCard>
      </div>

      {/* Stats overview */}
      {stats && (
        <section className="mt-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h3 className="mb-4 text-sm font-medium text-[#636E72]">Overview</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <GlassCard className="p-4 text-center transition-all duration-200 hover:scale-[1.02]" hover>
              <p className="text-2xl font-semibold text-[#2D3436]">{stats.new_words}</p>
              <p className="text-xs text-[#636E72]">New</p>
            </GlassCard>
            <GlassCard className="p-4 text-center transition-all duration-200 hover:scale-[1.02]" hover>
              <p className="text-2xl font-semibold text-[#FDCB6E]">{stats.learning_words}</p>
              <p className="text-xs text-[#636E72]">Learning</p>
            </GlassCard>
            <GlassCard className="p-4 text-center transition-all duration-200 hover:scale-[1.02]" hover>
              <p className="text-2xl font-semibold text-[#00B894]">{stats.mastered_words}</p>
              <p className="text-xs text-[#636E72]">Mastered</p>
            </GlassCard>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-[#636E72]">
            <span>Total: <strong className="text-[#2D3436]">{stats.total_words}</strong> words</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Flame size={12} className="text-[#E17055]" />
              Streak: <strong className="text-[#E17055]">{stats.streak_days}</strong> days
            </span>
          </div>
        </section>
      )}

      <div className="h-16" />
    </PageContainer>
  )
}
