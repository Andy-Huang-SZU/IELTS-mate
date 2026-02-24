import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, RotateCcw, Minus, Plus, Award, TrendingUp, Layers, BarChart3,
  AlertTriangle, Bookmark, Star, ChevronRight, Pencil, X as XIcon, Check, Flame
} from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import { useVocabularyStore } from '../../store/useVocabularyStore'
import {
  WORD_ORDER_OPTIONS, type WordOrder,
  fetchLearningCurve,
  fetchMostWrongWords, type MostWrongWord,
  fetchBookmarkedWords, type VocabularyWord,
  toggleBookmark, updateWordNote,
} from '../../services/vocabulary'

/* ──── Learning Curve mini chart ──── */
function LearningCurveChart() {
  const [data, setData] = useState<{ dates: string[]; mastered: number[]; learning: number[] } | null>(null)

  useEffect(() => {
    fetchLearningCurve(14).then(r => setData(r.data)).catch(() => {})
  }, [])

  if (!data || data.dates.length === 0) return <p className="text-xs text-[#B2BEC3] py-4 text-center">暂无数据</p>

  const max = Math.max(...data.mastered, ...data.learning, 1)
  const h = 100
  const w = 280
  const points = data.dates.length
  const step = w / Math.max(points - 1, 1)

  const toPath = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (v / max) * h}`).join(' ')

  return (
    <div className="overflow-hidden">
      <svg viewBox={`-5 -5 ${w + 10} ${h + 25}`} className="w-full h-auto max-h-[120px]" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(r => (
          <line key={r} x1={0} y1={h - r * h} x2={w} y2={h - r * h} stroke="rgba(0,0,0,0.04)" strokeWidth={0.5} />
        ))}
        {/* Learning */}
        <path d={toPath(data.learning)} fill="none" stroke="#FDCB6E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
        {/* Mastered */}
        <path d={toPath(data.mastered)} fill="none" stroke="#00B894" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Labels */}
        {data.dates.filter((_, i) => i === 0 || i === points - 1).map((d, i) => (
          <text key={i} x={i === 0 ? 0 : w} y={h + 14} textAnchor={i === 0 ? 'start' : 'end'}
            className="text-[8px] fill-[#B2BEC3]">{d.slice(5)}</text>
        ))}
      </svg>
      <div className="flex gap-4 justify-center mt-1">
        <span className="flex items-center gap-1 text-[10px] text-[#636E72]">
          <span className="w-2.5 h-0.5 rounded bg-[#00B894] inline-block" /> Mastered
        </span>
        <span className="flex items-center gap-1 text-[10px] text-[#636E72]">
          <span className="w-2.5 h-0.5 rounded bg-[#FDCB6E] inline-block" /> Learning
        </span>
      </div>
    </div>
  )
}

/* ──── Vocabulary Distribution bar chart ──── */
function VocabDistributionChart({ stats }: { stats: { new_words: number; learning_words: number; mastered_words: number; total_words: number } | null }) {
  if (!stats || stats.total_words === 0) return <p className="text-xs text-[#B2BEC3] py-4 text-center">暂无数据</p>

  const bars = [
    { label: 'New', value: stats.new_words, color: '#74B9FF', bg: 'rgba(116,185,255,0.15)' },
    { label: 'Learning', value: stats.learning_words, color: '#FDCB6E', bg: 'rgba(253,203,110,0.15)' },
    { label: 'Mastered', value: stats.mastered_words, color: '#00B894', bg: 'rgba(0,184,148,0.15)' },
  ]

  const max = Math.max(...bars.map(b => b.value), 1)

  return (
    <div className="flex flex-col gap-3">
      {bars.map(bar => (
        <div key={bar.label} className="flex items-center gap-3">
          <span className="w-16 text-[10px] text-[#636E72] text-right shrink-0">{bar.label}</span>
          <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ backgroundColor: bar.bg }}>
            <div
              className="h-full rounded-lg transition-all duration-700 ease-out flex items-center justify-end pr-2"
              style={{
                width: `${Math.max((bar.value / max) * 100, 8)}%`,
                backgroundColor: bar.color,
              }}
            >
              <span className="text-[10px] font-bold text-white drop-shadow-sm">{bar.value}</span>
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-[9px] text-[#B2BEC3]">Total: {stats.total_words.toLocaleString()}</span>
        <span className="text-[9px] text-[#B2BEC3]">{stats.total_words > 0 ? ((stats.mastered_words / stats.total_words) * 100).toFixed(1) : 0}% mastered</span>
      </div>
    </div>
  )
}

/* ──── Most Wrong Words widget ──── */
function MostWrongWidget() {
  const [words, setWords] = useState<MostWrongWord[]>([])

  useEffect(() => {
    fetchMostWrongWords(8).then(r => setWords(r.data.words)).catch(() => {})
  }, [])

  if (words.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs text-[#B2BEC3]">还没有错误记录</p>
        <p className="text-[10px] text-[#DFE6E9] mt-1">开始学习后这里会显示你最常出错的词</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {words.map((w, idx) => (
        <div key={w.id} className="flex items-center gap-3 rounded-xl px-3 py-2 bg-white/30 hover:bg-white/50 transition-colors">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
            style={{
              backgroundColor: idx < 3 ? 'rgba(225,112,85,0.12)' : 'rgba(0,0,0,0.04)',
              color: idx < 3 ? '#E17055' : '#636E72'
            }}
          >
            {idx + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#2D3436] truncate">{w.word}</p>
            <p className="text-[10px] text-[#636E72] truncate">{w.translation}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <AlertTriangle size={10} className="text-[#E17055]" />
            <span className="text-[11px] font-semibold text-[#E17055]">{w.wrong_count}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ──── Bookmarked Words widget ──── */
function BookmarkWidget() {
  const [words, setWords] = useState<VocabularyWord[]>([])
  const [total, setTotal] = useState(0)
  const [editingNote, setEditingNote] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')

  const loadBookmarks = useCallback(() => {
    fetchBookmarkedWords(1, 8).then(r => {
      setWords(r.data.words)
      setTotal(r.data.total)
    }).catch(() => {})
  }, [])

  useEffect(() => { loadBookmarks() }, [loadBookmarks])

  const handleRemoveBookmark = async (wordId: number) => {
    await toggleBookmark(wordId, false)
    loadBookmarks()
  }

  const handleSaveNote = async (wordId: number) => {
    await updateWordNote(wordId, noteText)
    setEditingNote(null)
    loadBookmarks()
  }

  if (words.length === 0 && total === 0) {
    return (
      <div className="py-6 text-center">
        <Bookmark size={20} className="mx-auto text-[#DFE6E9] mb-2" />
        <p className="text-xs text-[#B2BEC3]">还没有收藏的单词</p>
        <p className="text-[10px] text-[#DFE6E9] mt-1">学习时按 N 收藏 + 写笔记</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {words.map(w => (
        <div key={w.id} className="rounded-xl px-3 py-2 bg-white/30 hover:bg-white/50 transition-colors">
          <div className="flex items-center gap-2">
            <Star size={12} className="text-[#FDCB6E] shrink-0" fill="#FDCB6E" />
            <span className="text-[12px] font-semibold text-[#2D3436] flex-1 truncate">{w.word}</span>
            <span className="text-[10px] text-[#636E72] truncate max-w-[100px]">{w.translation}</span>
            <button onClick={() => { setEditingNote(editingNote === w.id ? null : w.id); setNoteText(w.note || '') }}
              className="p-1 rounded hover:bg-white/60 transition-colors"
              title="编辑笔记">
              <Pencil size={10} className="text-[#B2BEC3]" />
            </button>
            <button onClick={() => handleRemoveBookmark(w.id)}
              className="p-1 rounded hover:bg-[#E17055]/10 transition-colors"
              title="取消收藏">
              <XIcon size={10} className="text-[#B2BEC3]" />
            </button>
          </div>
          {w.note && editingNote !== w.id && (
            <p className="text-[10px] text-[#636E72] mt-1 pl-5 italic">{w.note}</p>
          )}
          {editingNote === w.id && (
            <div className="flex items-center gap-1.5 mt-1.5 pl-5">
              <input
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="写笔记..."
                className="flex-1 text-[11px] rounded-lg bg-white/60 border border-white/40 px-2 py-1 outline-none focus:border-[#00B894]/40 text-[#2D3436]"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSaveNote(w.id) }}
              />
              <button onClick={() => handleSaveNote(w.id)}
                className="p-1 rounded bg-[#00B894]/10 hover:bg-[#00B894]/20 transition-colors">
                <Check size={10} className="text-[#00B894]" />
              </button>
            </div>
          )}
        </div>
      ))}
      {total > 8 && (
        <p className="text-center text-[10px] text-[#B2BEC3] pt-1">还有 {total - 8} 个收藏词</p>
      )}
    </div>
  )
}

/* ──── Main Hub ──── */
export function VocabularyHub(): JSX.Element {
  const navigate = useNavigate()
  const {
    stats, loadStats,
    todaySummary, loadTodaySummary,
    vocabSettings, loadVocabSettings, updateVocabSettings,
    loading
  } = useVocabularyStore()

  const [dailyLimit, setDailyLimit] = useState(30)
  const [wordOrder, setWordOrder] = useState<WordOrder>('random')

  useEffect(() => {
    loadStats()
    loadTodaySummary()
    loadVocabSettings()
  }, [loadStats, loadTodaySummary, loadVocabSettings])

  useEffect(() => {
    if (vocabSettings) {
      setDailyLimit(vocabSettings.daily_new_words_limit)
      if (vocabSettings.word_order) setWordOrder(vocabSettings.word_order as WordOrder)
    }
  }, [vocabSettings])

  const adjustLimit = useCallback((delta: number) => {
    const next = Math.max(5, Math.min(100, dailyLimit + delta))
    setDailyLimit(next)
    updateVocabSettings({ daily_new_words_limit: next, word_order: wordOrder })
  }, [dailyLimit, wordOrder, updateVocabSettings])

  const handleOrderChange = useCallback((order: WordOrder) => {
    setWordOrder(order)
    updateVocabSettings({ daily_new_words_limit: dailyLimit, word_order: order })
  }, [dailyLimit, updateVocabSettings])

  const dueReview = todaySummary?.due_review ?? 0
  const todayLearned = todaySummary?.new_words_learned_today ?? 0
  const noDue = !loading && dueReview === 0
  const learnProgress = dailyLimit > 0 ? Math.min((todayLearned / dailyLimit) * 100, 100) : 0

  return (
    <PageContainer>
      <h1 className="sr-only">Vocabulary Hub</h1>

      {/* Header */}
      <header className="mb-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Vocabulary</h2>
            <p className="mt-1 text-sm text-[#636E72]">系统化记忆，稳步提升词汇量</p>
          </div>
          {stats && (
            <div className="flex items-center gap-1.5 rounded-full bg-[#E17055]/8 px-3.5 py-1.5">
              <Flame size={14} className="text-[#E17055]" />
              <span className="text-xs font-semibold text-[#E17055]">{stats.streak_days} 天连续</span>
            </div>
          )}
        </div>
      </header>

      {/* ──── Action cards ──── */}
      <div className="grid gap-5 sm:grid-cols-2 animate-fade-in" style={{ animationDelay: '0.05s' }}>
        {/* Review card */}
        <GlassCard className="relative flex flex-col justify-between overflow-hidden p-6 min-h-[220px] transition-all duration-300 hover:scale-[1.008] hover:shadow-xl" hover>
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #E17055 0%, transparent 70%)' }} />
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E17055]/15 to-[#FDCB6E]/10 shadow-sm">
                <RotateCcw className="text-[#E17055]" size={20} />
              </div>
              <div>
                <p className="text-[11px] text-[#B2BEC3] uppercase tracking-widest font-medium">Review</p>
                <p className="text-xs text-[#636E72] mt-0.5">今日待复习</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-serif text-4xl font-semibold text-[#2D3436] tabular-nums">
                {loading ? '—' : dueReview}
              </span>
              <span className="text-sm text-[#B2BEC3] font-medium">词</span>
            </div>
            <p className="text-[12px] text-[#636E72]">
              {noDue ? '太棒了，今日复习已完成' : '温故而知新，复习到期词汇'}
            </p>
          </div>
          <button
            onClick={() => navigate('/vocabulary/review')}
            disabled={noDue}
            className={`mt-4 w-full rounded-2xl py-3 text-sm font-medium tracking-wide transition-all duration-200
              ${noDue
                ? 'bg-[#DFE6E9]/60 text-[#B2BEC3] cursor-not-allowed'
                : 'bg-gradient-to-r from-[#E17055] to-[#E17055]/90 text-white shadow-lg shadow-[#E17055]/20 hover:shadow-xl hover:shadow-[#E17055]/30 hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            {noDue ? '已全部复习 ✓' : '开始复习'}
          </button>
        </GlassCard>

        {/* New words card */}
        <GlassCard className="relative flex flex-col justify-between overflow-hidden p-6 min-h-[220px] transition-all duration-300 hover:scale-[1.008] hover:shadow-xl" hover>
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #00B894 0%, transparent 70%)' }} />
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00B894]/15 to-[#5EEAD4]/10 shadow-sm">
                <BookOpen className="text-[#00B894]" size={20} />
              </div>
              <div>
                <p className="text-[11px] text-[#B2BEC3] uppercase tracking-widest font-medium">Learn</p>
                <p className="text-xs text-[#636E72] mt-0.5">今日新词</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-serif text-4xl font-semibold text-[#2D3436] tabular-nums">{todayLearned}</span>
              <span className="text-lg text-[#B2BEC3] font-medium">/ {dailyLimit}</span>
            </div>
            <div className="h-1.5 w-full bg-[#DFE6E9]/50 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full bg-gradient-to-r from-[#00B894] to-[#5EEAD4] transition-all duration-700"
                style={{ width: `${learnProgress}%` }} />
            </div>
          </div>

          {/* Daily limit stepper */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl bg-white/50 backdrop-blur-sm px-2.5 py-1.5 border border-white/40">
              <button onClick={() => adjustLimit(-5)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-[#636E72] hover:bg-white/70 hover:text-[#2D3436] transition-all active:scale-90">
                <Minus size={12} />
              </button>
              <span className="text-xs font-semibold text-[#2D3436] w-7 text-center tabular-nums">{dailyLimit}</span>
              <button onClick={() => adjustLimit(5)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-[#636E72] hover:bg-white/70 hover:text-[#2D3436] transition-all active:scale-90">
                <Plus size={12} />
              </button>
              <span className="text-[9px] text-[#B2BEC3] ml-0.5">词/天</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/vocabulary/learn')}
            className="mt-3 w-full rounded-2xl bg-gradient-to-r from-[#00B894] to-[#00B894]/90 py-3 text-sm font-medium tracking-wide text-white shadow-lg shadow-[#00B894]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#00B894]/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            学习新词
          </button>
        </GlassCard>
      </div>

      {/* ──── Word order selector (inline tabs) ──── */}
      <section className="mt-6 animate-fade-in" style={{ animationDelay: '0.08s' }}>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest">排列顺序</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {WORD_ORDER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleOrderChange(opt.value)}
              className={`rounded-xl px-3.5 py-2 text-[11px] transition-all duration-200 border
                ${wordOrder === opt.value
                  ? 'bg-[#00B894]/10 border-[#00B894]/30 text-[#00B894] font-semibold shadow-sm'
                  : 'bg-white/40 border-white/40 text-[#636E72] hover:bg-white/60 hover:border-white/60'
                }`}
            >
              {opt.label}
              {opt.value === 'random' && (
                <span className="ml-1 text-[8px] text-[#B2BEC3] font-normal align-super">推荐</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ──── Stats overview ──── */}
      {stats && (
        <section className="mt-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h3 className="mb-4 flex items-center gap-2 text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest">
            <Layers size={12} /> Overview
          </h3>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {([
              { label: 'Total', value: stats.total_words, icon: Layers, color: '#636E72', bg: '#2D3436' },
              { label: 'New', value: stats.new_words, icon: BookOpen, color: '#74B9FF', bg: '#74B9FF' },
              { label: 'Learning', value: stats.learning_words, icon: TrendingUp, color: '#FDCB6E', bg: '#FDCB6E' },
              { label: 'Mastered', value: stats.mastered_words, icon: Award, color: '#00B894', bg: '#00B894' },
            ] as const).map(item => (
              <GlassCard key={item.label} className="p-4 transition-all duration-200 hover:scale-[1.015]" hover>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${item.bg}10` }}>
                    <item.icon size={14} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="font-serif text-lg font-semibold text-[#2D3436] tabular-nums">{item.value.toLocaleString()}</p>
                    <p className="text-[9px] text-[#B2BEC3] uppercase tracking-wider">{item.label}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          {stats.total_words > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[#636E72]">掌握进度</span>
                <span className="text-[11px] font-semibold text-[#2D3436]">
                  {((stats.mastered_words / stats.total_words) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full bg-[#DFE6E9]/40 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${(stats.mastered_words / stats.total_words) * 100}%`,
                    background: 'linear-gradient(90deg, #00B894 0%, #5EEAD4 50%, #FDCB6E 100%)',
                  }} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* ──── Charts & Data section ──── */}
      <section className="mt-8 animate-fade-in" style={{ animationDelay: '0.15s' }}>
        {/* Learning Curve + Vocab Distribution — side by side */}
        <div className="grid gap-5 sm:grid-cols-2 mb-5">
          <GlassCard className="p-5" hover>
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest">
                <TrendingUp size={12} className="text-[#00B894]" /> 学习趋势
              </h3>
              <span className="text-[10px] text-[#B2BEC3]">近 14 天</span>
            </div>
            <LearningCurveChart />
          </GlassCard>

          <GlassCard className="p-5" hover>
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest">
                <BarChart3 size={12} className="text-[#74B9FF]" /> 词汇分布
              </h3>
            </div>
            <VocabDistributionChart stats={stats} />
          </GlassCard>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Most Wrong Words */}
          <GlassCard className="p-5" hover>
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest">
                <AlertTriangle size={12} className="text-[#E17055]" /> 易错词排行
              </h3>
              <ChevronRight size={12} className="text-[#B2BEC3]" />
            </div>
            <MostWrongWidget />
          </GlassCard>

          {/* Bookmarked Words */}
          <GlassCard className="p-5" hover>
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest">
                <Star size={12} className="text-[#FDCB6E]" /> 收藏词本
              </h3>
              <ChevronRight size={12} className="text-[#B2BEC3]" />
            </div>
            <BookmarkWidget />
          </GlassCard>
        </div>
      </section>

      <div className="h-20" />
    </PageContainer>
  )
}
