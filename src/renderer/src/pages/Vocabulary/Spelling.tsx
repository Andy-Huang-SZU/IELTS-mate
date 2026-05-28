import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Bookmark, Pencil, Check, Eye, EyeOff } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import { useVocabularyStore } from '../../store/useVocabularyStore'
import {
  submitReview,
  toggleBookmark,
  updateWordNote,
  WORD_ORDER_OPTIONS,
  type VocabularyWord,
  type WordOrder,
} from '../../services/vocabulary'
import { SessionComplete } from './SessionComplete'

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ──── Letter feedback ──── */
function LetterFeedback({ typed, target }: { typed: string; target: string }) {
  const letters = target.split('')
  return (
    <div className="flex flex-wrap justify-center gap-1.5 mt-3">
      {letters.map((ch, i) => {
        const typedCh = typed[i] ?? ''
        const isCorrect = typedCh.toLowerCase() === ch.toLowerCase()
        const isTyped = typedCh !== ''
        return (
          <div
            key={i}
            className={`w-8 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-200
              ${!isTyped ? 'bg-[#DFE6E9]/30 text-[#B2BEC3] border-2 border-dashed border-[#DFE6E9]'
                : isCorrect ? 'bg-[#00B894]/10 text-[#00B894] border-2 border-[#00B894]/30'
                : 'bg-[#E17055]/10 text-[#E17055] border-2 border-[#E17055]/30'
              }`}
          >
            {isTyped ? typedCh : ''}
          </div>
        )
      })}
    </div>
  )
}

export function VocabularySpelling(): JSX.Element {
  const navigate = useNavigate()
  const { newWords, loading, error, loadNewWords, vocabSettings, loadVocabSettings } = useVocabularyStore()

  const [currentOrder, setCurrentOrder] = useState<WordOrder>('random')
  const [showOrderMenu, setShowOrderMenu] = useState(false)
  const orderInitialized = useRef(false)

  const [queue, setQueue] = useState<VocabularyWord[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionWrong, setSessionWrong] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)
  const [sessionStartTime] = useState(Date.now())
  const [elapsedStr, setElapsedStr] = useState('0:00')
  const allWordsRef = useRef<VocabularyWord[]>([])

  const [input, setInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const word = queue[queueIndex] ?? null
  const totalInPhase = queue.length
  const progress = totalInPhase > 0 ? Math.min(((queueIndex + (submitted ? 1 : 0)) / totalInPhase) * 100, 100) : 0

  const isCorrect = useMemo(() => {
    if (!word || !submitted) return false
    return input.trim().toLowerCase() === word.word.toLowerCase()
  }, [input, word, submitted])

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - sessionStartTime) / 1000)
      setElapsedStr(`${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [sessionStartTime])

  // Load settings then words
  useEffect(() => { loadVocabSettings() }, [loadVocabSettings])
  useEffect(() => {
    if (vocabSettings && !orderInitialized.current) {
      const order = (vocabSettings.word_order as WordOrder) || 'random'
      setCurrentOrder(order)
      orderInitialized.current = true
      loadNewWords(30, order)
    }
  }, [vocabSettings, loadNewWords])

  const handleOrderSwitch = useCallback((order: WordOrder) => {
    setCurrentOrder(order)
    setShowOrderMenu(false)
    allWordsRef.current = []
    setQueueIndex(0)
    setSessionCorrect(0)
    setSessionWrong(0)
    setSessionDone(false)
    setInput('')
    setSubmitted(false)
    loadNewWords(30, order)
  }, [loadNewWords])

  useEffect(() => {
    if (newWords.length > 0 && allWordsRef.current.length === 0) {
      allWordsRef.current = [...newWords]
      setQueue(shuffleArray([...newWords]))
      setQueueIndex(0)
    }
  }, [newWords])

  // Focus input on new word
  useEffect(() => {
    if (word && !submitted) {
      setInput('')
      setShowAnswer(false)
      setIsBookmarked(word.bookmarked ?? false)
      setNoteText(word.note ?? '')
      setShowNoteInput(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [word, submitted])

  const handleSubmit = useCallback(async () => {
    if (!word || submitted) return
    setSubmitted(true)
    const correct = input.trim().toLowerCase() === word.word.toLowerCase()
    if (correct) {
      setSessionCorrect(c => c + 1)
      await submitReview(word.id, 5, 'spelling')
    } else {
      setSessionWrong(c => c + 1)
      await submitReview(word.id, 0, 'spelling')
    }
  }, [word, input, submitted])

  const handleNext = useCallback(() => {
    if (!submitted) return
    const nextIndex = queueIndex + 1
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex)
      setSubmitted(false)
      setInput('')
      setShowAnswer(false)
    } else {
      setSessionDone(true)
    }
  }, [submitted, queueIndex, queue])

  const handleSkip = useCallback(async () => {
    if (!word || submitted) return
    setSubmitted(true)
    setSessionWrong(c => c + 1)
    await submitReview(word.id, 0, 'spelling')
  }, [word, submitted])

  const handleToggleBookmark = useCallback(async () => {
    if (!word) return
    const next = !isBookmarked
    setIsBookmarked(next)
    await toggleBookmark(word.id, next)
    if (next) setShowNoteInput(true)
  }, [word, isBookmarked])

  const handleSaveNote = useCallback(async () => {
    if (!word) return
    await updateWordNote(word.id, noteText)
    setShowNoteInput(false)
  }, [word, noteText])

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA') return
      if (e.key === 'Enter' && !submitted && input.trim()) {
        e.preventDefault()
        handleSubmit()
      } else if (submitted && (e.key === ' ' || e.key === 'ArrowRight')) {
        if (tag !== 'INPUT') { e.preventDefault(); handleNext() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [submitted, input, handleSubmit, handleNext])

  if (sessionDone) {
    return (
      <SessionComplete
        mode="learn"
        correctCount={sessionCorrect}
        wrongCount={sessionWrong}
        elapsedStr={elapsedStr}
        onContinueReview={() => navigate('/vocabulary/review')}
        onLearnNew={() => {
          allWordsRef.current = []
          setSessionDone(false)
          setSessionCorrect(0)
          setSessionWrong(0)
          setSubmitted(false)
          setInput('')
          loadNewWords(30, currentOrder)
        }}
      />
    )
  }

  if (!loading && newWords.length === 0 && !error) {
    return (
      <PageContainer className="flex min-h-[70vh] flex-col items-center justify-center">
        <GlassCard className="max-w-sm p-8 text-center animate-fade-in" hover>
          <h2 className="text-lg font-semibold text-[#2D3436]">You've completed today's new words!</h2>
          <p className="mt-2 text-sm text-[#636E72]">No new words available for spelling practice.</p>
          <button onClick={() => navigate('/vocabulary')}
            className="mt-5 rounded-xl bg-white/50 px-6 py-2.5 text-sm font-medium text-[#2D3436] backdrop-blur transition-all hover:bg-white/70 active:scale-95">
            Back
          </button>
        </GlassCard>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="flex min-h-[80vh] flex-col">
      <h1 className="sr-only">Spelling Practice</h1>

      {/* Top bar */}
      <div className="mb-5 flex items-center gap-4 animate-fade-in">
        <button onClick={() => navigate('/vocabulary')}
          className="flex items-center gap-1.5 text-sm text-[#636E72] transition-colors hover:text-[#2D3436]">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="relative">
          <button onClick={() => setShowOrderMenu(v => !v)}
            className="flex items-center gap-1 rounded-lg bg-white/40 px-2.5 py-1.5 text-[11px] text-[#636E72] backdrop-blur hover:bg-white/60 transition-all">
            {WORD_ORDER_OPTIONS.find(o => o.value === currentOrder)?.label ?? 'Random'}
            <ChevronDown size={10} className={`transition-transform ${showOrderMenu ? 'rotate-180' : ''}`} />
          </button>
          {showOrderMenu && (
            <div className="absolute z-30 mt-1 left-0 min-w-[160px] rounded-xl bg-white/95 backdrop-blur-xl shadow-lg border border-white/40 overflow-hidden animate-fade-in">
              {WORD_ORDER_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => handleOrderSwitch(opt.value)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#74B9FF]/5
                    ${currentOrder === opt.value ? 'bg-[#74B9FF]/10 text-[#74B9FF] font-semibold' : 'text-[#2D3436]'}`}>
                  <span>{opt.label}</span>
                  <span className="block text-[10px] text-[#B2BEC3]">{opt.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 max-w-[400px] mx-auto">
          <div className="flex justify-between mb-1">
            <span className="text-[11px] text-[#636E72]">Spelling Practice</span>
            <span className="text-[11px] text-[#2D3436] font-semibold">
              {loading ? '...' : `${Math.min(queueIndex + 1, totalInPhase)} / ${totalInPhase}`}
            </span>
          </div>
          <div className="h-1.5 bg-[#CBD5E1]/30 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#74B9FF] to-[#74B9FF]/70 transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {loading && !word && (
        <div className="flex-1 flex items-center justify-center text-sm text-[#636E72] animate-pulse">Loading...</div>
      )}

      {word && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-[540px] mx-auto w-full">
          {/* Prompt card */}
          <GlassCard className="w-full p-8 text-center mb-6 animate-fade-in relative" hover>
            <div className="inline-block mb-3 px-3 py-0.5 rounded-full bg-[#74B9FF]/10 text-[#74B9FF] text-[11px] font-semibold tracking-wider uppercase">
              Spelling
            </div>
            {word.pos && (
              <p className="text-[10px] text-[#B2BEC3] uppercase tracking-wider mb-2">{word.pos}</p>
            )}
            <h2 className="font-serif text-xl font-semibold text-[#2D3436] leading-relaxed mb-2">
              {word.translation}
            </h2>
            {word.definition && (
              <p className="text-[12px] text-[#636E72] italic leading-relaxed">{word.definition}</p>
            )}

            {/* Hint: show word length */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-[10px] text-[#B2BEC3]">{word.word.length} letters</span>
              {!submitted && (
                <button onClick={() => setShowAnswer(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-[#B2BEC3] hover:text-[#636E72] transition-colors">
                  {showAnswer ? <EyeOff size={10} /> : <Eye size={10} />}
                  {showAnswer ? 'Hide answer' : 'Peek answer'}
                </button>
              )}
            </div>
            {showAnswer && !submitted && (
              <p className="mt-2 text-sm text-[#E17055]/60 font-mono tracking-widest animate-fade-in">{word.word}</p>
            )}

            {/* Letter feedback after submit */}
            {submitted && <LetterFeedback typed={input} target={word.word} />}
          </GlassCard>

          {/* Input area */}
          <div className="w-full mb-5 animate-fade-in" style={{ animationDelay: '0.05s' }}>
            <div className={`relative rounded-2xl transition-all duration-200 ${
              submitted
                ? isCorrect
                  ? 'ring-2 ring-[#00B894]/40'
                  : 'ring-2 ring-[#E17055]/40'
                : 'ring-1 ring-white/30 focus-within:ring-2 focus-within:ring-[#74B9FF]/40'
            }`}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => !submitted && setInput(e.target.value)}
                disabled={submitted}
                placeholder="Type the spelling..."
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-2xl bg-white/50 backdrop-blur-xl px-5 py-4 text-center text-lg font-mono tracking-widest text-[#2D3436] placeholder:text-[#B2BEC3] outline-none disabled:opacity-70 border-0 shadow-none"
              />
            </div>

            {/* Result message */}
            {submitted && (
              <div className={`mt-3 text-center animate-fade-in ${isCorrect ? 'text-[#00B894]' : 'text-[#E17055]'}`}>
                <p className="text-sm font-semibold">{isCorrect ? '✓ Correct spelling!' : '✗ Incorrect spelling'}</p>
                {!isCorrect && (
                  <p className="text-xs mt-1">
                    Correct answer:<span className="font-mono font-bold tracking-wider">{word.word}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="w-full animate-fade-in" style={{ animationDelay: '0.08s' }}>
            {!submitted ? (
              <div className="flex gap-3">
                <button onClick={handleSkip}
                  className="flex-1 rounded-2xl bg-white/40 backdrop-blur py-3 text-sm font-medium text-[#636E72] transition-all hover:bg-white/60 active:scale-[0.98]">
                  Skip
                </button>
                <button onClick={handleSubmit} disabled={!input.trim()}
                  className="flex-[2] rounded-2xl bg-gradient-to-r from-[#74B9FF] to-[#74B9FF]/90 py-3 text-sm font-medium text-white shadow-lg shadow-[#74B9FF]/20 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                  Submit
                  <kbd className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">Enter</kbd>
                </button>
              </div>
            ) : (
              <div>
                {/* Bookmark row */}
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={handleToggleBookmark}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] transition-all border
                      ${isBookmarked
                        ? 'bg-[#FDCB6E]/10 border-[#FDCB6E]/30 text-[#E17055]'
                        : 'bg-white/40 border-white/30 text-[#636E72] hover:bg-white/60'}`}>
                    <Bookmark size={12} fill={isBookmarked ? '#FDCB6E' : 'none'} />
                    {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                  </button>
                  {isBookmarked && !showNoteInput && noteText && (
                    <button onClick={() => setShowNoteInput(true)}
                      className="flex items-center gap-1 text-[10px] text-[#636E72] hover:text-[#2D3436] transition-colors">
                      <Pencil size={10} /> Edit note
                    </button>
                  )}
                </div>
                {showNoteInput && (
                  <div className="flex items-center gap-2 mb-3 animate-fade-in">
                    <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write a note..."
                      className="flex-1 text-[11px] rounded-xl bg-white/50 border border-white/40 px-3 py-2 outline-none focus:border-[#00B894]/40 text-[#2D3436] backdrop-blur"
                      autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveNote() }} />
                    <button onClick={handleSaveNote}
                      className="rounded-xl bg-[#00B894]/10 px-3 py-2 text-[11px] text-[#00B894] font-medium hover:bg-[#00B894]/20 transition-colors">
                      Save
                    </button>
                  </div>
                )}
                <button onClick={handleNext}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#74B9FF] to-[#74B9FF]/90 py-3 text-sm font-medium text-white shadow-lg shadow-[#74B9FF]/20 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
                  Next
                  <kbd className="ml-2 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">Space</kbd>
                </button>
              </div>
            )}
          </div>

          {/* Bottom stats */}
          <div className="flex justify-center gap-6 mt-5 text-xs text-[#636E72]">
            <span>✓ <strong className="text-[#00B894]">{sessionCorrect}</strong></span>
            <span>✗ <strong className="text-[#E17055]">{sessionWrong}</strong></span>
            <span>⏱ <strong className="text-[#2D3436]">{elapsedStr}</strong></span>
          </div>
        </div>
      )}

      <div className="h-16" />
    </PageContainer>
  )
}
