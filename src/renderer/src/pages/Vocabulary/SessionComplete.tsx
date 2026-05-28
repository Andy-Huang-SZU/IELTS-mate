import { useNavigate } from 'react-router-dom'
import { CheckCircle2, RotateCcw, BookOpen, ArrowLeft } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'

interface SessionCompleteProps {
  mode: 'learn' | 'review'
  correctCount: number
  wrongCount: number
  elapsedStr: string
  onContinueReview?: () => void
  onLearnNew?: () => void
}

export function SessionComplete({
  mode,
  correctCount,
  wrongCount,
  elapsedStr,
  onContinueReview,
  onLearnNew,
}: SessionCompleteProps): JSX.Element {
  const navigate = useNavigate()
  const total = correctCount + wrongCount
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0

  return (
    <PageContainer className="flex min-h-[70vh] flex-col items-center justify-center">
      <GlassCard className="max-w-md w-full p-8 text-center animate-fade-in" hover>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#00B894]/10 animate-bounce-in">
          <CheckCircle2 className="text-[#00B894]" size={36} />
        </div>

        <h2 className="text-xl font-semibold text-[#2D3436]">
          {mode === 'learn' ? 'New-word session complete!' : 'Review session complete!'}
        </h2>
        <p className="mt-2 text-sm text-[#636E72]">
          This round: {total} words, time {elapsedStr}
        </p>

        {/* Stats */}
        <div className="mt-5 flex justify-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#00B894]">{correctCount}</p>
            <p className="text-xs text-[#636E72]">Correct</p>
          </div>
          <div className="h-10 w-px bg-[#636E72]/10" />
          <div className="text-center">
            <p className="text-2xl font-bold text-[#E17055]">{wrongCount}</p>
            <p className="text-xs text-[#636E72]">Wrong</p>
          </div>
          <div className="h-10 w-px bg-[#636E72]/10" />
          <div className="text-center">
            <p className="text-2xl font-bold text-[#2D3436]">{accuracy}%</p>
            <p className="text-xs text-[#636E72]">Accuracy</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-7 flex flex-col gap-2.5">
          {onContinueReview && (
            <button
              onClick={onContinueReview}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E17055] py-3 text-sm font-medium text-white shadow-lg shadow-[#E17055]/20 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <RotateCcw size={16} />
              Continue Review
            </button>
          )}
          {onLearnNew && (
            <button
              onClick={onLearnNew}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00B894] py-3 text-sm font-medium text-white shadow-lg shadow-[#00B894]/20 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <BookOpen size={16} />
              Learn New Words
            </button>
          )}
          <button
            onClick={() => navigate('/vocabulary')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/50 py-3 text-sm font-medium text-[#2D3436] backdrop-blur transition-all duration-200 hover:bg-white/70 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </GlassCard>
    </PageContainer>
  )
}
