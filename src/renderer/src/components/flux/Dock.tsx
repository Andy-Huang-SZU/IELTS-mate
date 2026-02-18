import { NavLink } from 'react-router-dom'
import { Home, Library, PenTool, Mic, Settings } from 'lucide-react'
import { clsx } from 'clsx'

const dockItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/vocabulary', icon: Library, label: 'Vocab' },
  { to: '/writing', icon: PenTool, label: 'Writing' },
  { to: '/speaking', icon: Mic, label: 'Speaking' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

/**
 * 底部悬浮导航坞 (纯 CSS 动画版)
 * - 胶囊形状，极高的磨砂玻璃模糊度
 * - 使用 CSS transition 实现选中态平滑过渡
 * - 鼠标悬停时图标轻微上浮
 */
export function Dock(): JSX.Element {
  return (
    <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-2xl bg-white/40 px-4 py-3 shadow-xl backdrop-blur-2xl border border-white/60 transition-all duration-300">
        {dockItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="relative flex items-center justify-center rounded-xl p-3 transition-all duration-200 hover:bg-white/30 hover:-translate-y-1"
          >
            {({ isActive }) => (
              <>
                {/* 选中态背景 */}
                <div
                  className={clsx(
                    'absolute inset-0 rounded-xl transition-all duration-300',
                    isActive ? 'bg-white/50 scale-100' : 'bg-transparent scale-95'
                  )}
                />
                
                {/* 图标 */}
                <item.icon
                  size={24}
                  strokeWidth={1.5}
                  className={clsx(
                    'relative z-10 transition-colors duration-200',
                    isActive ? 'text-[#E17055]' : 'text-[#636E72]'
                  )}
                />
                
                {/* 标签 (选中时显示) */}
                {isActive && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-stone-800 px-2 py-1 text-xs text-white opacity-100 transition-opacity duration-200">
                    {item.label}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
