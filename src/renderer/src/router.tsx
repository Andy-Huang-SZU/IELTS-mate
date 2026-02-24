import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { DashboardPage } from './pages/Dashboard'
import { SettingsPage } from './pages/Settings'
import { VocabularyHub, VocabularyReview, VocabularyLearn } from './pages/Vocabulary'
import { WritingHub, WritingEditor, WritingReport } from './pages/Writing'
import { SpeakingHub } from './pages/Speaking'
import { GlassCard, PageContainer } from './components/flux'

/** 未实现子页面的 Flux 风格占位 */
const PlaceholderPage = ({ title, subtitle = 'Coming soon...' }: { title: string; subtitle?: string }): JSX.Element => (
  <PageContainer>
    <div className="flex min-h-[50vh] items-center justify-center">
      <GlassCard className="max-w-md p-8 text-center" hover>
        <h1 className="font-serif text-2xl font-semibold text-[#2D3436]">{title}</h1>
        <p className="mt-2 text-[#636E72]">{subtitle}</p>
      </GlassCard>
    </div>
  </PageContainer>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'vocabulary', element: <VocabularyHub /> },
      { path: 'vocabulary/learn', element: <VocabularyLearn /> },
      { path: 'vocabulary/review', element: <VocabularyReview /> },
      { path: 'vocabulary/stats', element: <PlaceholderPage title="Vocabulary Stats" /> },
      { path: 'writing', element: <WritingHub /> },
      { path: 'writing/editor', element: <WritingEditor /> },
      { path: 'writing/report/:id', element: <WritingReport /> },
      { path: 'writing/history', element: <PlaceholderPage title="Writing History" /> },
      { path: 'speaking', element: <SpeakingHub /> },
      { path: 'speaking/chat', element: <PlaceholderPage title="Speaking Chat" subtitle="自由对话模式开发中" /> },
      { path: 'speaking/mock', element: <PlaceholderPage title="Speaking Mock" subtitle="模考模式开发中" /> },
      { path: 'speaking/history', element: <PlaceholderPage title="Speaking History" /> },
      { path: 'settings', element: <SettingsPage /> },
    ]
  }
])
