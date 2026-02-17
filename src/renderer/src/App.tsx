import { NavLink, Outlet } from 'react-router-dom'

export const App = (): JSX.Element => {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold">IELTS-mate</h1>
        <p className="mt-3 text-slate-300">Phase 2：页面路由 + Settings 模块化</p>
        <nav className="mt-6 flex gap-3 text-sm">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded border px-3 py-1.5 ${
                isActive
                  ? 'border-emerald-700 bg-emerald-900 text-emerald-100'
                  : 'border-slate-600 text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            联调状态
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `rounded border px-3 py-1.5 ${
                isActive
                  ? 'border-emerald-700 bg-emerald-900 text-emerald-100'
                  : 'border-slate-600 text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            Settings / BYOK
          </NavLink>
        </nav>
        <div className="mt-8">
          <Outlet />
        </div>
      </section>
    </main>
  )
}
