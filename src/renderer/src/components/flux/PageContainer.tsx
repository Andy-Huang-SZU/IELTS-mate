import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

interface PageContainerProps {
  children: ReactNode
  className?: string
  /** 与 Dashboard 等保持一致的最大宽度与内边距 */
  narrow?: boolean
}

/**
 * 文档要求：内容区域四周留白，卡片悬浮。
 * 所有页面共用同一 max-width 与 padding，保证与 Dashboard 一致。
 */
export function PageContainer({ children, className, narrow = false }: PageContainerProps): JSX.Element {
  return (
    <div
      className={twMerge(
        clsx(
          'mx-auto w-full px-6 py-8',
          narrow ? 'max-w-2xl' : 'max-w-6xl',
          className
        )
      )}
    >
      {children}
    </div>
  )
}
