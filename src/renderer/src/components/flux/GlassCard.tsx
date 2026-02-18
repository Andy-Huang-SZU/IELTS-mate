import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface GlassCardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

/**
 * Flux Academy 风格陶瓷质感磨砂玻璃卡片
 * - 半透明白色背景 (rgba(255, 255, 255, 0.4) ~ 0.65)
 * - 极强的 blur 效果制造景深感
 * - 边框模拟顶部受光、底部反光
 * - 多层阴影制造悬浮感
 */
export function GlassCard({ children, className, hover = false }: GlassCardProps): JSX.Element {
  return (
    <div
      className={twMerge(
        clsx(
          'relative overflow-hidden rounded-3xl',
          // 背景：半透明白色
          'bg-white/40',
          // 边框：顶部高光，底部反光
          'border border-white/60 border-b-white/20',
          // 阴影：多层悬浮感
          'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.02),0_20px_40px_-8px_rgba(0,0,0,0.04)]',
          // 模糊
          'backdrop-blur-xl',
          // 悬停效果
          hover && 'hover:bg-white/55 hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.03),0_30px_60px_-12px_rgba(199,169,147,0.15)] transition-all duration-300 ease-out',
          className
        )
      )}
    >
      {children}
    </div>
  )
}
