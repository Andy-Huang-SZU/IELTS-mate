import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { DashboardPage } from './pages/Dashboard'
import { SettingsPage } from './pages/Settings'
import {
  VocabularyHub,
  VocabularyReview,
  VocabularyLearn,
  VocabularyStats,
  VocabularySpelling,
  VocabularyDictation,
} from './pages/Vocabulary'
import { WritingHub, WritingEditor, WritingHistory, WritingReport } from './pages/Writing'
import { SpeakingHub, ChatMode, MockTest, SpeakingHistory, SpeakingReport } from './pages/Speaking'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'vocabulary', element: <VocabularyHub /> },
      { path: 'vocabulary/learn', element: <VocabularyLearn /> },
      { path: 'vocabulary/review', element: <VocabularyReview /> },
      { path: 'vocabulary/stats', element: <VocabularyStats /> },
      { path: 'vocabulary/spelling', element: <VocabularySpelling /> },
      { path: 'vocabulary/dictation', element: <VocabularyDictation /> },
      { path: 'writing', element: <WritingHub /> },
      { path: 'writing/editor', element: <WritingEditor /> },
      { path: 'writing/report/:id', element: <WritingReport /> },
      { path: 'writing/history', element: <WritingHistory /> },
      { path: 'speaking', element: <SpeakingHub /> },
      { path: 'speaking/chat', element: <ChatMode /> },
      { path: 'speaking/mock', element: <MockTest /> },
      { path: 'speaking/history', element: <SpeakingHistory /> },
      { path: 'speaking/report/:id', element: <SpeakingReport /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
