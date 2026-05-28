import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Flame, TrendingUp, BookOpen, Award, Layers } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import {
  fetchVocabularyStats,
  fetchActivityTrend,
  fetchMostWrongWords,
  type VocabularyStats,
  type ActivityTrendPoint,
  type MostWrongWord,
} from '../../services/vocabulary'

function ActivityTrendChart({ data }: { data: ActivityTrendPoint[] }) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-xs text-[#B2BEC3]">No trend data yet</p>
  }

  const maxTotal = Math.max(...data.map(point => point.total), 1)

  return (
    <div>
      <div className="flex h-[108px] items-end gap-1">
        {data.map((point, index) => {
          const height = (point.total / maxTotal) * 100
          const reviewH = point.total > 0 ? (point.review / point.total) * height : 0
          const quizH = point.total > 0 ? (point.learn_quiz / point.total) * height : 0
          const spellingH = point.total > 0 ? (point.spelling / point.total) * height : 0
          const dictationH = point.total > 0 ? (point.dictation / point.total) * height : 0

          return (
            <div
              key={index}
              className="group relative flex h-full flex-1 cursor-default flex-col justify-end overflow-hidden rounded-t-sm transition-all duration-300 hover:opacity-85"
              title={`${point.date}: ${point.total} event${point.total === 1 ? '' : 's'}`}
            >
              <div className="flex flex-col justify-end" style={{ height: `${Math.max(height, point.total > 0 ? 4 : 0)}%` }}>
                {dictationH > 0 && <div className="bg-[#A78BFA]" style={{ height: `${dictationH}%`, minHeight: 2 }} />}
                {spellingH > 0 && <div className="bg-[#74B9FF]" style={{ height: `${spellingH}%`, minHeight: 2 }} />}
                {quizH > 0 && <div className="bg-[#FDCB6E]" style={{ height: `${quizH}%`, minHeight: 2 }} />}
                {reviewH > 0 && <div className="bg-[#00B894]" style={{ height: `${reviewH}%`, minHeight: 2 }} />}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-1 flex">
        {data.map((point, index) => (
          <div key={index} className="flex-1 text-center">
            {(index === 0 || index === data.length - 1 || index === Math.floor(data.length / 2)) && (
              <span className="text-[9px] text-[#B2BEC3]">{point.date.slice(5)}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {[
          { label: 'Review', color: '#00B894' },
          { label: 'Quiz', color: '#FDCB6E' },
          { label: 'Spelling', color: '#74B9FF' },
          { label: 'Dictation', color: '#A78BFA' },
        ].map(item => (
          <span key={item.label} className="flex items-center gap-1 text-[10px] text-[#636E72]">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function statusBadge(status: string): string {
  if (status === 'mastered') return 'bg-[#00B894]/12 text-[#00A383]'
  if (status === 'learning') return 'bg-[#FDCB6E]/18 text-[#B7860B]'
  return 'bg-[#74B9FF]/14 text-[#3B82F6]'
}

export function VocabularyStats(): JSX.Element {
  const navigate = useNavigate()

  const [stats, setStats] = useState<VocabularyStats | null>(null)
  const [trendData, setTrendData] = useState<ActivityTrendPoint[]>([])
  const [trendDays, setTrendDays] = useState(14)
  const [mostWrong, setMostWrong] = useState<MostWrongWord[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [st, tr, mw] = await Promise.all([
      fetchVocabularyStats().catch(() => ({ data: null })),
      fetchActivityTrend(trendDays).catch(() => ({ data: { data: [] } })),
      fetchMostWrongWords(12).catch(() => ({ data: { words: [] } })),
    ])

    setStats(st.data as VocabularyStats | null)
    setTrendData((tr.data as { data: ActivityTrendPoint[] }).data ?? [])
    setMostWrong((mw.data as { words: MostWrongWord[] }).words ?? [])
    setLoading(false)
  }, [trendDays])

  useEffect(() => {
    loadData()
  }, [loadData])

  const masteredPct = useMemo(() => {
    if (!stats || stats.total_words <= 0) return '0'
    return ((stats.mastered_words / stats.total_words) * 100).toFixed(1)
  }, [stats])

  return (
    <PageContainer className="animate-fade-in">
      <h1 className="sr-only">Vocabulary Statistics</h1>

      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate('/vocabulary')}
          className="flex items-center gap-1.5 text-sm text-[#636E72] transition-colors hover:text-[#2D3436]"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex-1">
          <h2 className="font-serif text-xl font-semibold text-[#2D3436]">Learning Statistics</h2>
          <p className="text-xs text-[#636E72]">Focus on your streak and high-error words</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <GlassCard className="p-4 text-center" hover>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E17055]/10">
            <Flame size={20} className="text-[#E17055]" />
          </div>
          <p className="font-serif text-2xl font-bold tabular-nums text-[#2D3436]">{stats?.streak_days ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-[#636E72]">Current streak (days)</p>
        </GlassCard>

        <GlassCard className="p-4 text-center" hover>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00B894]/10">
            <Award size={20} className="text-[#00B894]" />
          </div>
          <p className="font-serif text-2xl font-bold tabular-nums text-[#2D3436]">{stats?.mastered_words ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-[#636E72]">Mastered ({masteredPct}%)</p>
        </GlassCard>

        <GlassCard className="p-4 text-center" hover>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FDCB6E]/10">
            <TrendingUp size={20} className="text-[#F39C12]" />
          </div>
          <p className="font-serif text-2xl font-bold tabular-nums text-[#2D3436]">{stats?.learning_words ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-[#636E72]">Learning</p>
        </GlassCard>

        <GlassCard className="p-4 text-center" hover>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#74B9FF]/10">
            <Layers size={20} className="text-[#74B9FF]" />
          </div>
          <p className="font-serif text-2xl font-bold tabular-nums text-[#2D3436]">{stats?.due_today ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-[#636E72]">Due today</p>
        </GlassCard>
      </div>

      <GlassCard className="mb-6 p-5" hover>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-[#B2BEC3]">
            <TrendingUp size={12} className="text-[#E17055]" /> Most Frequently Incorrect Words
          </h3>
          <span className="text-[10px] text-[#B2BEC3]">Top {mostWrong.length || 12}</span>
        </div>

        {loading ? (
          <div className="animate-pulse py-8 text-center text-sm text-[#B2BEC3]">Loading mistakes...</div>
        ) : mostWrong.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#DFE6E9] bg-white/35 px-4 py-8 text-center text-sm text-[#B2BEC3]">
            No wrong-answer records yet. Great start — keep going.
          </div>
        ) : (
          <div className="space-y-2">
            {mostWrong.map((word, index) => (
              <div
                key={word.id}
                className="flex items-center gap-3 rounded-xl border border-[#F0F3F4] bg-white/45 px-3 py-2.5 transition-all hover:bg-white/70"
              >
                <div className="w-6 text-center text-xs font-semibold tabular-nums text-[#B2BEC3]">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#2D3436]">{word.word}</div>
                  <div className="truncate text-xs text-[#8A9BA8]">{word.translation || '—'}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(word.status)}`}>
                  {word.status}
                </span>
                <span className="rounded-full bg-[#E17055]/10 px-2 py-0.5 text-[10px] font-semibold text-[#D35446] tabular-nums">
                  {word.wrong_count} wrong
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="mb-6 p-5" hover>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-[#B2BEC3]">
            <TrendingUp size={12} className="text-[#FDCB6E]" /> Activity Trend
          </h3>
          <div className="flex gap-1">
            {[7, 14, 30].map(day => (
              <button
                key={day}
                onClick={() => setTrendDays(day)}
                className={`rounded-lg px-2.5 py-1 text-[10px] transition-all ${
                  trendDays === day ? 'bg-[#00B894]/10 font-semibold text-[#00B894]' : 'text-[#B2BEC3] hover:bg-white/50'
                }`}
              >
                {day}d
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse py-8 text-center text-sm text-[#B2BEC3]">Loading trend...</div>
        ) : (
          <ActivityTrendChart data={trendData} />
        )}
      </GlassCard>

      {stats && stats.total_words > 0 && (
        <GlassCard className="mb-6 p-5" hover>
          <h3 className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-[#B2BEC3]">
            <BookOpen size={12} className="text-[#74B9FF]" /> Vocabulary Overview
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Mastered', value: stats.mastered_words, total: stats.total_words, color: '#00B894' },
              { label: 'Learning', value: stats.learning_words, total: stats.total_words, color: '#FDCB6E' },
              { label: 'New', value: stats.new_words, total: stats.total_words, color: '#74B9FF' },
            ].map(bar => (
              <div key={bar.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] text-[#636E72]">{bar.label}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-[#2D3436]">
                    {bar.value.toLocaleString()} <span className="font-normal text-[#B2BEC3]">/ {bar.total.toLocaleString()}</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#DFE6E9]/30">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(bar.value / bar.total) * 100}%`,
                      backgroundColor: bar.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="h-20" />
    </PageContainer>
  )
}
