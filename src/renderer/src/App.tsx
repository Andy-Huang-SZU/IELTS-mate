import { Outlet } from 'react-router-dom'
import { FluidBackground, Dock } from './components/flux'

/**
 * 布局容器
 *
 * - 全屏滚动容器，无底部占位
 * - Dock 以 FAB 形式 fixed 在右下角，hover 扇形展开
 * - 内容区域享有 100% 可用高度
 */
export function App(): JSX.Element {
  return (
    <div className="relative h-screen overflow-y-auto bg-[#F7F6F2] scrollbar-hide">
      <FluidBackground />

      <main className="relative z-10">
        <Outlet />
      </main>

      {/* FAB 扇形导航 — fixed 定位，不占文档流 */}
      <Dock />
    </div>
  )
}
