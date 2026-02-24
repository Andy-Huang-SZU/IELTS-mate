import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Volume2, X, HelpCircle, Check, RotateCcw, Bookmark, Pencil } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import { useVocabularyStore } from '../../store/useVocabularyStore'
import { submitReview, toggleBookmark, updateWordNote } from '../../services/vocabulary'
import { SessionComplete } from './SessionComplete'

const BATCH_SIZE = 20

export function VocabularyReview(): JSX.Element {
  const navigate = useNavigate()
  const { words, currentIndex, totalDue, loading, error, loadReviewWords, resetProgress } = useVocabularyStore()
  const [resetting, setResetting] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionWrong, setSessionWrong] = useState(0)
  const [sessionStartTime] = useState(Date.now())
  const [elapsedStr, setElapsedStr] = useState('0:00')
  const [answered, setAnswered] = useState(false)
  const [localIndex, setLocalIndex] = useState(0)

  // Bookmark & note
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')

  const word = localIndex < words.length ? words[localIndex] : null
  const progress = words.length > 0 ? Math.min(((localIndex + (answered ? 1 : 0)) / words.length) * 100, 100) : 0

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - sessionStartTime) / 1000)
      setElapsedStr(`${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [sessionStartTime])

  // Load words
  useEffect(() => { loadReviewWords(BATCH_SIZE) }, [loadReviewWords])

  // Reset flip on word change
  useEffect(() => {
    setFlipped(false)
    setAnswered(false)
    setShowNoteInput(false)
    if (word) {
      setIsBookmarked(word.bookmarked ?? false)
      setNoteText(word.note ?? '')
    }
  }, [localIndex, word])

  const difficultyDots = useMemo(() => {
    if (!word) return []
    return Array.from({ length: 5 }, (_, i) => i < (word.difficulty || 3))
  }, [word])

  const handleFlip = useCallback(() => {
    if (!answered) setFlipped(true)
  }, [answered])

  const handleRate = useCallback(async (quality: 0 | 2 | 3) => {
    if (!word || answered) return
    setAnswered(true)

    if (quality === 3) setSessionCorrect((c) => c + 1)
    else if (quality === 0) setSessionWrong((c) => c + 1)

    await submitReview(word.id, quality as 0 | 2 | 3 | 5)

    // Auto advance after a short delay
    setTimeout(() => {
      setLocalIndex((i) => i + 1)
    }, 400)
  }, [word, answered])

  // Bookmark toggle
  const handleToggleBookmark = useCallback(async () => {
    if (!word) return
    const next = !isBookmarked
    setIsBookmarked(next)
    await toggleBookmark(word.id, next)
    if (next) setShowNoteInput(true)
  }, [word, isBookmarked])

  // Save note
  const handleSaveNote = useCallback(async () => {
    if (!word) return
    await updateWordNote(word.id, noteText)
    setShowNoteInput(false)
  }, [word, noteText])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (!flipped && !answered) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
      } else if (flipped && !answered) {
        if (e.key === '1') { e.preventDefault(); handleRate(0) }
        if (e.key === '2') { e.preventDefault(); handleRate(2) }
        if (e.key === '3') { e.preventDefault(); handleRate(3) }
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); handleToggleBookmark() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flipped, answered, handleFlip, handleRate, handleToggleBookmark])

  const handleReset = useCallback(async () => {
    if (!window.confirm('重置所有词汇进度？所有单词将回到"新词"状态。')) return
    setResetting(true)
    await resetProgress()
    setResetting(false)
    setSessionCorrect(0)
    setSessionWrong(0)
    setLocalIndex(0)
    await loadReviewWords(BATCH_SIZE)
  }, [resetProgress, loadReviewWords])

  // Session complete
  const sessionDone = !loading && !word && words.length > 0
  if (sessionDone) {
    return (
      <SessionComplete
        mode="review"
        correctCount={sessionCorrect}
        wrongCount={sessionWrong}
        elapsedStr={elapsedStr}
        onContinueReview={() => {
          setSessionCorrect(0)
          setSessionWrong(0)
          setLocalIndex(0)
          loadReviewWords(BATCH_SIZE)
        }}
        onLearnNew={() => navigate('/vocabulary/learn')}
      />
    )
  }

  return (
    <PageContainer className="flex min-h-[80vh] flex-col">
      <h1 className="sr-only">词汇复习</h1>

      {/* Top bar */}
      <div className="mb-5 flex items-center gap-4 animate-fade-in">
        <button
          onClick={() => navigate('/vocabulary')}
          className="flex items-center gap-1.5 text-sm text-[#636E72] transition-colors hover:text-[#2D3436]"
        >
          <ArrowLeft size={16} /> 返回
        </button>
        <div className="flex-1 max-w-[400px] mx-auto">
          <div className="flex justify-between mb-1">
            <span className="text-[11px] text-[#636E72]">复习</span>
            <span className="text-[11px] text-[#2D3436] font-semibold">
              {loading ? '...' : `${Math.min(localIndex + 1, words.length)} / ${words.length}`}
            </span>
          </div>
          <div className="h-1.5 bg-[#CBD5E1]/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#E17055] to-[#FDCB6E] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-[10px] text-red-500 transition-colors hover:bg-red-100 shrink-0"
        >
          <RotateCcw size={10} />
          {resetting ? '...' : 'Reset'}
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 animate-fade-in">{error}</div>}

      {loading && !word && (
        <div className="flex-1 flex items-center justify-center text-sm text-[#636E72] animate-pulse">加载中...</div>
      )}

      {!loading && words.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <GlassCard className="max-w-sm p-8 text-center animate-fade-in" hover>
            <h2 className="text-lg font-semibold text-[#2D3436]">没有待复习的单词！</h2>
            <p className="mt-2 text-sm text-[#636E72]">所有单词都已复习完毕，可以去学习新词。</p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => navigate('/vocabulary/learn')}
                className="rounded-xl bg-[#00B894] px-5 py-2.5 text-sm font-medium text-white transition-all hover:scale-[1.02] active:scale-95"
              >
                学习新词
              </button>
              <button
                onClick={() => navigate('/vocabulary')}
                className="rounded-xl bg-white/50 px-5 py-2.5 text-sm font-medium text-[#2D3436] backdrop-blur transition-all hover:bg-white/70"
              >
                返回
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Card area */}
      {word && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-[540px] mx-auto w-full">
          {/* 3D flip card */}
          <div className="perspective-1000 w-full mb-6" onClick={!flipped ? handleFlip : undefined}>
            <div
              className={`preserve-3d relative w-full transition-transform duration-500 ease-in-out cursor-pointer ${flipped ? 'rotate-y-180' : ''}`}
              style={{ minHeight: '260px' }}
            >
              {/* Front */}
              <GlassCard className="backface-hidden absolute inset-0 p-8 text-center flex flex-col items-center justify-center" hover>
                {word.pos && (
                  <div className="inline-block mb-2 px-3 py-0.5 rounded-full bg-[#E17055]/10 text-[#E17055] text-[11px] font-semibold tracking-wider uppercase">
                    {word.pos}
                  </div>
                )}
                <h2 className="font-serif text-4xl font-semibold text-[#2D3436] leading-tight">{word.word}</h2>
                {word.phonetic && (
                  <p className="mt-2 text-[15px] text-[#636E72] tracking-wide flex items-center justify-center gap-2">
                    {word.phonetic}
                    <Volume2 size={14} className="text-[#B2BEC3] cursor-pointer hover:text-[#E17055] transition-colors" />
                  </p>
                )}
                <div className="flex justify-center gap-1 mt-3">
                  {difficultyDots.map((active, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? '#E17055' : 'rgba(203,213,225,0.4)' }} />
                  ))}
                </div>
                {!flipped && (
                  <p className="mt-5 text-xs text-[#B2BEC3] animate-pulse">点击翻转查看释义</p>
                )}
              </GlassCard>

              {/* Back */}
              <GlassCard className="backface-hidden rotate-y-180 absolute inset-0 p-8 text-center flex flex-col items-center justify-center" hover>
                <h3 className="font-serif text-2xl font-semibold text-[#2D3436] mb-3">{word.word}</h3>
                <div className="w-12 h-px bg-[#E17055]/30 mb-3" />
                <p className="text-base font-medium text-[#2D3436] mb-2">{word.translation}</p>
                {word.full_translation && word.full_translation !== word.translation && (
                  <p className="text-sm text-[#636E72] whitespace-pre-line leading-relaxed mb-2">{word.full_translation}</p>
                )}
                {word.definition && (
                  <p className="text-xs text-[#636E72] italic whitespace-pre-line leading-relaxed mt-1">{word.definition}</p>
                )}
              </GlassCard>
            </div>
          </div>

          {/* Self-assessment buttons */}
          {flipped && !answered && (
            <div className="w-full grid grid-cols-3 gap-3 animate-fade-in mb-4">
              <button
                onClick={() => handleRate(0)}
                className="flex flex-col items-center gap-1.5 rounded-2xl py-4 bg-[#E17055]/8 border-2 border-transparent transition-all duration-200 hover:border-[#E17055]/30 hover:scale-[1.03] hover:shadow-lg active:scale-[0.97]"
              >
                <X size={20} className="text-[#E17055]" />
                <span className="text-sm font-medium text-[#E17055]">忘记了</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/5 text-[9px] font-mono text-[#B2BEC3]">1</kbd>
              </button>
              <button
                onClick={() => handleRate(2)}
                className="flex flex-col items-center gap-1.5 rounded-2xl py-4 bg-[#FDCB6E]/8 border-2 border-transparent transition-all duration-200 hover:border-[#FDCB6E]/30 hover:scale-[1.03] hover:shadow-lg active:scale-[0.97]"
              >
                <HelpCircle size={20} className="text-[#F39C12]" />
                <span className="text-sm font-medium text-[#F39C12]">模糊</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/5 text-[9px] font-mono text-[#B2BEC3]">2</kbd>
              </button>
              <button
                onClick={() => handleRate(3)}
                className="flex flex-col items-center gap-1.5 rounded-2xl py-4 bg-[#00B894]/8 border-2 border-transparent transition-all duration-200 hover:border-[#00B894]/30 hover:scale-[1.03] hover:shadow-lg active:scale-[0.97]"
              >
                <Check size={20} className="text-[#00B894]" />
                <span className="text-sm font-medium text-[#00B894]">认识</span>
                <kbd className="px-1.5 py-0.5 rounded bg-black/5 text-[9px] font-mono text-[#B2BEC3]">3</kbd>
              </button>
            </div>
          )}

          {/* Bookmark & Note — shown when card is flipped */}
          {flipped && (
            <div className="w-full animate-fade-in mb-2">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={handleToggleBookmark}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] transition-all border
                    ${isBookmarked
                      ? 'bg-[#FDCB6E]/10 border-[#FDCB6E]/30 text-[#E17055]'
                      : 'bg-white/40 border-white/30 text-[#636E72] hover:bg-white/60'
                    }`}
                >
                  <Bookmark size={12} fill={isBookmarked ? '#FDCB6E' : 'none'} />
                  {isBookmarked ? '已收藏' : '收藏'}
                  <kbd className="ml-1 px-1 py-0.5 rounded bg-black/5 text-[9px] font-mono">N</kbd>
                </button>
                {isBookmarked && !showNoteInput && noteText && (
                  <button onClick={() => setShowNoteInput(true)}
                    className="flex items-center gap-1 text-[10px] text-[#636E72] hover:text-[#2D3436] transition-colors">
                    <Pencil size={10} /> 编辑笔记
                  </button>
                )}
              </div>
              {showNoteInput && (
                <div className="flex items-center gap-2 mb-2 animate-fade-in">
                  <input
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="写笔记..."
                    className="flex-1 text-[11px] rounded-xl bg-white/50 border border-white/40 px-3 py-2 outline-none focus:border-[#00B894]/40 text-[#2D3436] backdrop-blur"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNote() }}
                  />
                  <button onClick={handleSaveNote}
                    className="rounded-xl bg-[#00B894]/10 px-3 py-2 text-[11px] text-[#00B894] font-medium hover:bg-[#00B894]/20 transition-colors">
                    保存
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Keyboard hints */}
          <div className="flex justify-center gap-4 mt-3 text-[10px] text-[#B2BEC3]">
            <span><kbd className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[9px]">Space</kbd> 翻转</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[9px]">1</kbd> 忘记</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[9px]">2</kbd> 模糊</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[9px]">3</kbd> 认识</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[9px]">N</kbd> 收藏</span>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-6 mt-4 text-xs text-[#636E72]">
            <span>✓ <strong className="text-[#00B894]">{sessionCorrect}</strong> 认识</span>
            <span>✗ <strong className="text-[#E17055]">{sessionWrong}</strong> 忘记</span>
            <span>⏱ <strong className="text-[#2D3436]">{elapsedStr}</strong></span>
          </div>
        </div>
      )}

      <div className="h-16" />
    </PageContainer>
  )
}
