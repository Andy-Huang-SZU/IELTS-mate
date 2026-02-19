import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Volume2, Check, X } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import { useVocabularyStore } from '../../store/useVocabularyStore'
import { fetchDistractors, submitReview, type VocabularyWord } from '../../services/vocabulary'
import { SessionComplete } from './SessionComplete'

type Phase = 'round1' | 'round2' | 'retry'
type ChoiceState = 'idle' | 'correct' | 'wrong'
type Direction = 'en2zh' | 'zh2en'

interface QuizChoice { text: string; isCorrect: boolean }
interface RoundResult { direction: Direction; correct: boolean }

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const PHASE_LABELS: Record<Phase, { text: string; gradient: string }> = {
  round1: { text: '第一轮 · 初次认识', gradient: 'from-[#E17055]/10 to-[#FDCB6E]/10' },
  round2: { text: '第二轮 · 巩固记忆', gradient: 'from-[#00B894]/10 to-[#5EEAD4]/10' },
  retry: { text: '错词重考', gradient: 'from-[#A78BFA]/10 to-[#FDCB6E]/10' },
}

export function VocabularyLearn(): JSX.Element {
  const navigate = useNavigate()
  const { newWords, loading, error, loadNewWords } = useVocabularyStore()

  // Session state
  const [phase, setPhase] = useState<Phase>('round1')
  const [queue, setQueue] = useState<VocabularyWord[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [round1Results, setRound1Results] = useState<Map<number, RoundResult>>(new Map())
  const [wrongIds, setWrongIds] = useState<Set<number>>(new Set())
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionWrong, setSessionWrong] = useState(0)
  const [sessionDone, setSessionDone] = useState(false)
  const [sessionStartTime] = useState(Date.now())
  const [elapsedStr, setElapsedStr] = useState('0:00')
  const allWordsRef = useRef<VocabularyWord[]>([])

  // Quiz state
  const [choices, setChoices] = useState<QuizChoice[]>([])
  const [choiceState, setChoiceState] = useState<ChoiceState>('idle')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [direction, setDirection] = useState<Direction>('en2zh')
  const [showDetail, setShowDetail] = useState(false)

  const word = queue[queueIndex] ?? null
  const totalInPhase = queue.length
  const progressInPhase = totalInPhase > 0 ? Math.min(((queueIndex + (choiceState !== 'idle' ? 1 : 0)) / totalInPhase) * 100, 100) : 0

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - sessionStartTime) / 1000)
      setElapsedStr(`${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [sessionStartTime])

  // Load new words
  useEffect(() => { loadNewWords() }, [loadNewWords])

  // Initialize Round 1 when newWords load
  useEffect(() => {
    if (newWords.length > 0 && allWordsRef.current.length === 0) {
      allWordsRef.current = [...newWords]
      setQueue(shuffleArray([...newWords]))
      setPhase('round1')
      setQueueIndex(0)
    }
  }, [newWords])

  // Determine direction for current word
  useEffect(() => {
    if (!word) return
    if (phase === 'round1') {
      setDirection(Math.random() > 0.5 ? 'en2zh' : 'zh2en')
    } else if (phase === 'round2') {
      const r1 = round1Results.get(word.id)
      setDirection(r1?.direction === 'en2zh' ? 'zh2en' : 'en2zh')
    } else {
      setDirection(Math.random() > 0.5 ? 'en2zh' : 'zh2en')
    }
  }, [word, phase, round1Results])

  // Load choices when word/direction changes
  useEffect(() => {
    if (!word) return
    setChoiceState('idle')
    setSelectedIndex(null)
    setShowDetail(false)

    const mode = direction === 'en2zh' ? 'translation' : 'word'
    const loadChoices = async () => {
      const res = await fetchDistractors(word.id, 3, mode)
      const distractors = res.data.distractors
      const correctText = direction === 'en2zh' ? word.translation : word.word
      const all: QuizChoice[] = [
        { text: correctText, isCorrect: true },
        ...distractors.map((d) => ({ text: d, isCorrect: false })),
      ]
      setChoices(shuffleArray(all))
    }
    loadChoices()
  }, [word, direction])

  // Handle selection
  const handleSelect = useCallback(async (index: number) => {
    if (choiceState !== 'idle' || !word) return
    setSelectedIndex(index)
    const choice = choices[index]

    if (choice.isCorrect) {
      setChoiceState('correct')
      setSessionCorrect((c) => c + 1)
      await submitReview(word.id, 3)
    } else {
      setChoiceState('wrong')
      setSessionWrong((c) => c + 1)
      await submitReview(word.id, 0)
    }
  }, [choiceState, choices, word])

  // Advance to next
  const handleNext = useCallback(() => {
    if (choiceState === 'idle' || !word) return

    const isCorrect = choiceState === 'correct'

    if (phase === 'round1') {
      setRound1Results((prev) => {
        const next = new Map(prev)
        next.set(word.id, { direction, correct: isCorrect })
        return next
      })
      if (!isCorrect) setWrongIds((prev) => new Set(prev).add(word.id))
    } else if (phase === 'round2') {
      if (!isCorrect) setWrongIds((prev) => new Set(prev).add(word.id))
    } else {
      // retry phase
      if (isCorrect) {
        setWrongIds((prev) => { const n = new Set(prev); n.delete(word.id); return n })
      }
    }

    const nextIndex = queueIndex + 1
    if (nextIndex < queue.length) {
      setQueueIndex(nextIndex)
    } else {
      advancePhase()
    }

    setChoiceState('idle')
    setSelectedIndex(null)
    setShowDetail(false)
  }, [choiceState, word, phase, direction, queueIndex, queue])

  const advancePhase = useCallback(() => {
    if (phase === 'round1') {
      // Start Round 2 with all words
      setPhase('round2')
      setQueue(shuffleArray([...allWordsRef.current]))
      setQueueIndex(0)
    } else if (phase === 'round2') {
      // Check if there are wrong words
      // Need to read the latest wrongIds - use a timeout to ensure state is flushed
      setTimeout(() => {
        setWrongIds((currentWrong) => {
          if (currentWrong.size > 0) {
            const retryWords = allWordsRef.current.filter((w) => currentWrong.has(w.id))
            setPhase('retry')
            setQueue(shuffleArray(retryWords))
            setQueueIndex(0)
          } else {
            setSessionDone(true)
          }
          return currentWrong
        })
      }, 0)
    } else {
      // Retry phase complete, check again
      setTimeout(() => {
        setWrongIds((currentWrong) => {
          if (currentWrong.size > 0) {
            const retryWords = allWordsRef.current.filter((w) => currentWrong.has(w.id))
            setQueue(shuffleArray(retryWords))
            setQueueIndex(0)
          } else {
            setSessionDone(true)
          }
          return currentWrong
        })
      }, 0)
    }
  }, [phase])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (choiceState === 'idle') {
        const num = parseInt(e.key)
        if (num >= 1 && num <= choices.length) { e.preventDefault(); handleSelect(num - 1) }
      } else {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); handleNext() }
        if (e.key === 'e' || e.key === 'E') { e.preventDefault(); setShowDetail((d) => !d) }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [choiceState, choices, handleSelect, handleNext])

  const difficultyDots = useMemo(() => {
    if (!word) return []
    return Array.from({ length: 5 }, (_, i) => i < (word.difficulty || 3))
  }, [word])

  const phaseInfo = PHASE_LABELS[phase]

  // Session complete
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
          setRound1Results(new Map())
          setWrongIds(new Set())
          loadNewWords()
        }}
      />
    )
  }

  // No words
  if (!loading && newWords.length === 0) {
    return (
      <PageContainer className="flex min-h-[70vh] flex-col items-center justify-center">
        <GlassCard className="max-w-sm p-8 text-center animate-fade-in" hover>
          <h2 className="text-lg font-semibold text-[#2D3436]">今日新词已学完！</h2>
          <p className="mt-2 text-sm text-[#636E72]">已达到每日新词上限，明天再来学习新词吧。</p>
          <button
            onClick={() => navigate('/vocabulary')}
            className="mt-5 rounded-xl bg-white/50 px-6 py-2.5 text-sm font-medium text-[#2D3436] backdrop-blur transition-all hover:bg-white/70 active:scale-95"
          >
            返回
          </button>
        </GlassCard>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="flex min-h-[80vh] flex-col">
      <h1 className="sr-only">新词学习</h1>

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
            <span className="text-[11px] text-[#636E72]">新词学习</span>
            <span className="text-[11px] text-[#2D3436] font-semibold">
              {loading ? '...' : `${Math.min(queueIndex + 1, totalInPhase)} / ${totalInPhase}`}
            </span>
          </div>
          <div className="h-1.5 bg-[#CBD5E1]/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#E17055] to-[#FDCB6E] transition-all duration-500"
              style={{ width: `${progressInPhase}%` }}
            />
          </div>
        </div>
      </div>

      {/* Phase indicator */}
      <div className={`mx-auto mb-4 rounded-full bg-gradient-to-r ${phaseInfo.gradient} px-4 py-1.5 animate-fade-in`}>
        <span className="text-xs font-medium text-[#2D3436]">{phaseInfo.text}
          {phase === 'retry' && <span className="ml-1 text-[#E17055]">· 还有 {queue.length - queueIndex} 词</span>}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 animate-fade-in">{error}</div>
      )}

      {loading && !word && (
        <div className="flex-1 flex items-center justify-center text-sm text-[#636E72] animate-pulse">加载中...</div>
      )}

      {/* Quiz card */}
      {word && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-[540px] mx-auto w-full">
          {/* Word/Translation card */}
          <GlassCard className="w-full p-8 text-center mb-6 animate-fade-in relative" hover>
            {direction === 'en2zh' ? (
              <>
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
              </>
            ) : (
              <>
                {word.pos && (
                  <div className="inline-block mb-2 px-3 py-0.5 rounded-full bg-[#00B894]/10 text-[#00B894] text-[11px] font-semibold tracking-wider uppercase">
                    {word.pos}
                  </div>
                )}
                <h2 className="font-serif text-2xl font-semibold text-[#2D3436] leading-relaxed">{word.translation}</h2>
              </>
            )}
            <div className="flex justify-center gap-1 mt-3">
              {difficultyDots.map((active, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors" style={{ backgroundColor: active ? '#E17055' : 'rgba(203,213,225,0.4)' }} />
              ))}
            </div>

            {/* Detail panel after answer */}
            {showDetail && choiceState !== 'idle' && (
              <div className="mt-4 pt-4 border-t border-[#636E72]/10 text-left animate-fade-in">
                <p className="text-sm font-medium text-[#2D3436] mb-1">{word.word} — {word.translation}</p>
                {word.full_translation && word.full_translation !== word.translation && (
                  <p className="text-xs text-[#636E72] whitespace-pre-line leading-relaxed">{word.full_translation}</p>
                )}
                {word.definition && (
                  <p className="mt-2 text-xs text-[#636E72] italic whitespace-pre-line leading-relaxed">{word.definition}</p>
                )}
              </div>
            )}
          </GlassCard>

          {/* 4×1 choices */}
          <div className="w-full flex flex-col gap-2.5 mb-5 animate-fade-in" style={{ animationDelay: '0.05s' }}>
            {choices.map((choice, idx) => {
              let borderColor = 'transparent'
              let bgColor = 'rgba(255,255,255,0.5)'
              let numBg = 'rgba(225,112,85,0.08)'
              let icon = null as React.ReactNode

              if (choiceState !== 'idle') {
                if (choice.isCorrect) {
                  borderColor = '#00B894'
                  bgColor = 'rgba(0,184,148,0.08)'
                  numBg = 'rgba(0,184,148,0.15)'
                  icon = <Check size={16} className="text-[#00B894] animate-fade-in" />
                } else if (idx === selectedIndex && !choice.isCorrect) {
                  borderColor = '#E17055'
                  bgColor = 'rgba(225,112,85,0.06)'
                  numBg = 'rgba(225,112,85,0.15)'
                  icon = <X size={16} className="text-[#E17055] animate-shake" />
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  disabled={choiceState !== 'idle'}
                  className={`text-left rounded-2xl px-5 py-4 backdrop-blur-xl transition-all duration-200
                    ${choiceState === 'idle' ? 'hover:scale-[1.01] active:scale-[0.97] cursor-pointer' : 'cursor-default'}
                    ${choiceState !== 'idle' && idx === selectedIndex && !choices[idx].isCorrect ? 'animate-shake' : ''}
                  `}
                  style={{
                    backgroundColor: bgColor,
                    border: `2px solid ${borderColor}`,
                    boxShadow: '0 2px 12px -4px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.5)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold text-[#E17055] transition-colors"
                      style={{ backgroundColor: numBg }}
                    >
                      {idx + 1}
                    </div>
                    <span className="flex-1 text-[13px] text-[#2D3436] leading-snug">{choice.text}</span>
                    {icon}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Next button */}
          {choiceState !== 'idle' && (
            <div className="w-full flex items-center justify-between animate-fade-in mb-3">
              <button onClick={() => setShowDetail((d) => !d)} className="flex items-center gap-1.5 text-xs text-[#636E72] hover:text-[#2D3436] transition-colors">
                {showDetail ? '收起详情' : '查看详情'}
                <kbd className="ml-1 px-1.5 py-0.5 rounded bg-black/5 text-[10px] font-mono">E</kbd>
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 rounded-full bg-[#E17055] px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#E17055]/20 transition-all hover:shadow-xl hover:scale-[1.03] active:scale-95"
              >
                下一个
                <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono">↵</kbd>
              </button>
            </div>
          )}

          {/* Keyboard hints */}
          <div className="flex justify-center gap-5 mt-3 text-[10px] text-[#B2BEC3]">
            <span><kbd className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[9px]">1-4</kbd> 选择</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[9px]">Enter</kbd> 下一个</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[9px]">E</kbd> 详情</span>
          </div>

          {/* Bottom stats */}
          <div className="flex justify-center gap-6 mt-4 text-xs text-[#636E72]">
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
