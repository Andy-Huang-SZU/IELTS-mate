import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'

/** Mock: 今日待复习数量、最近学习的词 */
const MOCK_REVIEW_COUNT = 42
const MOCK_RECENT_WORDS = [
  { word: 'ambiguity', pos: 'n.', meaning: '歧义；含糊' },
  { word: 'infrastructure', pos: 'n.', meaning: '基础设施' },
  { word: 'sustainable', pos: 'adj.', meaning: '可持续的' },
  { word: 'controversial', pos: 'adj.', meaning: '有争议的' },
  { word: 'phenomenon', pos: 'n.', meaning: '现象' },
]

/**
 * 词汇中心 - 文档：巨大 "Review Now" 玻璃卡 + 底部瀑布流最近单词
 */
export function VocabularyHub(): JSX.Element {
  return (
    <PageContainer>
      <h1 className="sr-only">Vocabulary Hub</h1>
      <header className="mb-8 animate-fade-in">
        <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Vocabulary</h2>
        <p className="mt-1 text-sm text-[#636E72]">复习与词库</p>
      </header>

      <Link to="/vocabulary/review" className="block animate-fade-in" style={{ animationDelay: '0.05s' }}>
        <GlassCard className="flex min-h-[160px] items-center justify-between p-8 transition-all hover:scale-[1.01] hover:shadow-xl" hover>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFD6A5]/60">
              <BookOpen className="text-[#E17055]" size={28} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm text-[#636E72]">今日待复习</p>
              <p className="font-serif text-4xl font-semibold text-[#2D3436]">{MOCK_REVIEW_COUNT}</p>
              <p className="text-sm text-[#636E72]">个单词</p>
            </div>
          </div>
          <span className="rounded-xl bg-[#E17055] px-5 py-2.5 text-sm font-medium text-white">Review Now</span>
        </GlassCard>
      </Link>

      <section className="mt-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <h3 className="mb-4 text-sm font-medium text-[#636E72]">最近学习</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_RECENT_WORDS.map((item, i) => (
            <GlassCard key={item.word} className="p-4 transition-all hover:scale-[1.02]" hover>
              <p className="font-medium text-[#2D3436]">{item.word}</p>
              <p className="mt-0.5 text-xs text-[#636E72]">{item.pos} {item.meaning}</p>
            </GlassCard>
          ))}
        </div>
      </section>
    </PageContainer>
  )
}
