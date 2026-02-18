import { Outlet } from 'react-router-dom'
import { FluidBackground, Dock } from './components/flux'

/**
 * Flux Academy 布局容器
 * - 暖米白背景 Canvas
 * - 交互式流体背景 (光斑)
 * - 底部悬浮 Dock 导航
 * - 页面内容区域
 */
export function App(): JSX.Element {
  return (
    <div className="relative min-h-screen bg-[#F7F6F2]">
      {/* 交互式流体背景 */}
      <FluidBackground />
      
      {/* 主内容区域 */}
      <main className="relative z-10 min-h-screen pb-24">
        <Outlet />
      </main>
      
      {/* 底部悬浮 Dock */}
      <Dock />
    </div>
  )
}
