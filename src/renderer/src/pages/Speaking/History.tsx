import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Coffee, Loader2, UserCircle } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import {
  fetchSpeakingSessions,
  type SessionListItem,
} from '../../services/speaking'

const MODE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'chat', label: 'Free Chat' },
  { value: 'mock_test', label: 'Mock Test' },
] as const

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString()
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`
}

export function SpeakingHistory(): JSX.Element {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modeFilter, setModeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    setPage(1)
  }, [modeFilter])

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchSpeakingSessions(modeFilter, page, pageSize)
      .then((res) => {
        setSessions(res.data.sessions)
        setTotal(res.data.total)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [modeFilter, page])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <PageContainer>
      <h1 className="sr-only">Speaking History</h1>

      {/* Header */}
      <header className="mb-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate('/speaking')}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/50 backdrop-blur-sm border border-white/40 transition-all hover:bg-white/70 hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={18} className="text-[#2D3436]" />
          </button>
          <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Speaking History</h2>
        </div>
        <p className="ml-12 text-sm text-[#636E72]">Review your past speaking sessions and reports</p>
      </header>

      {/* Mode filter pills */}
      <div className="mb-5 flex gap-2 animate-fade-in" style={{ animationDelay: '0.03s' }}>
        {MODE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setModeFilter(filter.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              modeFilter === filter.value
                ? 'bg-[#A78BFA] text-white shadow-sm'
                : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
            }`}
          >
            {filter.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#B2BEC3] self-center">
          {total} session{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Session list */}
      <div className="animate-fade-in" style={{ animationDelay: '0.06s' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#B2BEC3]" />
          </div>
        ) : error ? (
          <GlassCard className="p-6 text-center" hover>
            <p className="text-sm text-[#E17055]">{error}</p>
            <button
              onClick={() => setPage(1)}
              className="mt-2 text-xs text-[#636E72] underline"
            >
              Retry
            </button>
          </GlassCard>
        ) : sessions.length === 0 ? (
          <GlassCard className="flex flex-col items-center gap-3 py-16 text-center" hover>
            <Clock size={32} className="text-[#B2BEC3]" />
            <p className="text-sm text-[#636E72]">No speaking sessions yet</p>
            <p className="text-xs text-[#B2BEC3]">Start a Free Chat or Mock Test to get started</p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Link
                key={session.id}
                to={`/speaking/report/${session.id}`}
              >
                <GlassCard
                  className="flex items-center gap-4 px-5 py-4 transition-all hover:scale-[1.005] hover:shadow-lg cursor-pointer"
                  hover
                >
                  {/* Mode icon */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      session.mode === 'chat'
                        ? 'bg-[#E6E6FA]/80'
                        : 'bg-[#CAE9E0]/70'
                    }`}
                  >
                    {session.mode === 'chat' ? (
                      <Coffee size={20} className="text-[#2D3436]" strokeWidth={1.5} />
                    ) : (
                      <UserCircle size={20} className="text-[#2D3436]" strokeWidth={1.5} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#636E72]">
                        {session.mode === 'chat' ? 'Free Chat' : 'Mock Test'}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                        session.status === 'completed'
                          ? 'bg-[#00B894]/10 text-[#00B894]'
                          : 'bg-[#FDCB6E]/10 text-[#FDCB6E]'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#2D3436] truncate">
                      {session.topic_summary || 'Speaking session'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-[#B2BEC3]">
                      <span>{formatDate(session.created_at)}</span>
                      {session.duration_seconds > 0 && (
                        <>
                          <span>·</span>
                          <span>{formatDuration(session.duration_seconds)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Score badge (mock test only) */}
                  {session.overall_score != null && session.overall_score > 0 && (
                    <div className="shrink-0 flex flex-col items-center">
                      <span className="text-lg font-bold text-[#A78BFA]">
                        {session.overall_score.toFixed(1)}
                      </span>
                      <span className="text-[9px] text-[#B2BEC3]">Band</span>
                    </div>
                  )}
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: '0.09s' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-xl border border-[#636E72]/10 px-4 py-2 text-xs text-[#636E72] transition-all hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-xs text-[#636E72]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-xl border border-[#636E72]/10 px-4 py-2 text-xs text-[#636E72] transition-all hover:bg-white/50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      <div className="h-20" />
    </PageContainer>
  )
}
