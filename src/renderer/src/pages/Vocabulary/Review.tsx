import { useState } from 'react'
import { GlassCard, PageContainer } from '../../components/flux'

const MOCK_CARD = {
  word: 'ambiguity',
  phonetic: '/ˌæmbiˈɡjuːəti/',
  meaning: '歧义；含糊不清',
  example: 'The ambiguity of the law led to different interpretations.',
}

/**
 * 词汇复习页 - 文档：极简模式，中央玻璃闪卡，正面单词+音标，翻转释义+例句；底部 Again/Hard/Good/Easy
 */
export function VocabularyReview(): JSX.Element {
  const [flipped, setFlipped] = useState(false)

  return (
    <PageContainer className="flex min-h-[70vh] flex-col items-center justify-center">
      <h1 className="sr-only">Vocabulary Review</h1>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="w-full max-w-md animate-fade-in"
        style={{ animationDelay: '0.1s', perspective: 1000 }}
      >
        <GlassCard
          className="relative min-h-[280px] overflow-hidden p-8 transition-all duration-500 hover:scale-[1.02] [transform-style:preserve-3d]"
          hover
        >
          <div
            className="relative flex min-h-[240px] flex-col justify-center transition-transform duration-500 [transform-style:preserve-3d]"
            style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
          >
            <div className="[backface-visibility:hidden]">
              <p className="font-serif text-3xl font-semibold text-[#2D3436]">{MOCK_CARD.word}</p>
              <p className="mt-2 text-[#636E72]">{MOCK_CARD.phonetic}</p>
              <p className="mt-4 text-sm text-[#636E72]">点击翻转查看释义</p>
            </div>
            <div
              className="absolute inset-0 flex flex-col justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]"
            >
              <p className="text-lg font-medium text-[#2D3436]">{MOCK_CARD.meaning}</p>
              <p className="mt-3 text-sm italic text-[#636E72]">&quot;{MOCK_CARD.example}&quot;</p>
            </div>
          </div>
        </GlassCard>
      </button>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        {(['Again', 'Hard', 'Good', 'Easy'] as const).map((label) => (
          <button
            key={label}
            type="button"
            className="rounded-full bg-white/50 px-6 py-3 text-sm font-medium text-[#2D3436] shadow-lg backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/70 active:scale-95"
          >
            {label}
          </button>
        ))}
      </div>
    </PageContainer>
  )
}
