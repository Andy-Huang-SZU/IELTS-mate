import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { HomePage } from './pages/Home'
import { SettingsPage } from './pages/Settings'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: 'settings',
        element: <SettingsPage />
      }
    ]
  }
])
