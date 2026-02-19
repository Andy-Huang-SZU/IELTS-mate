import { useEffect, useRef } from 'react'

/**
 * 交互式流体背景
 * - 3-4 个彩色光斑在背景层缓慢游走
 * - 随鼠标移动而缓慢偏移 (Lerp 缓动跟随)
 * - 使用 CSS filter blur + mix-blend-mode 制造光晕渗透效果
 */
export function FluidBackground(): JSX.Element {
  const orb1Ref = useRef<HTMLDivElement>(null)
  const orb2Ref = useRef<HTMLDivElement>(null)
  const orb3Ref = useRef<HTMLDivElement>(null)
  
  const mouseX = useRef(0)
  const mouseY = useRef(0)
  
  // 每个 orb 当前位置
  const orb1 = useRef({ x: 0, y: 0 })
  const orb2 = useRef({ x: 0, y: 0 })
  const orb3 = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.current = e.clientX
      mouseY.current = e.clientY
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    
    let animationId: number
    
    const animate = () => {
      // Lerp 缓动算法: current += (target - current) * delay
      // 不同 orb 使用不同的滞后系数，制造层次感
      
      // Orb1: 暖橙色 - 跟随最紧密
      orb1.current.x += (mouseX.current - orb1.current.x) * 0.05
      orb1.current.y += (mouseY.current - orb1.current.y) * 0.05
      
      // Orb2: 淡青色 - 滞后中等
      orb2.current.x += (mouseX.current - orb2.current.x) * 0.03
      orb2.current.y += (mouseY.current - orb2.current.y) * 0.03
      
      // Orb3: 淡紫色 - 滞后最大
      orb3.current.x += (mouseX.current - orb3.current.x) * 0.08
      orb3.current.y += (mouseY.current - orb3.current.y) * 0.08
      
      // 应用变换
      if (orb1Ref.current) {
        orb1Ref.current.style.transform = `translate3d(${orb1.current.x - 200}px, ${orb1.current.y - 200}px, 0)`
      }
      if (orb2Ref.current) {
        orb2Ref.current.style.transform = `translate3d(${orb2.current.x - 300}px, ${orb2.current.y - 300}px, 0)`
      }
      if (orb3Ref.current) {
        orb3Ref.current.style.transform = `translate3d(${orb3.current.x - 150}px, ${orb3.current.y - 150}px, 0)`
      }
      
      animationId = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animationId)
    }
  }, [])
  
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* 暖橙色光斑 - Warm Sun */}
      <div
        ref={orb1Ref}
        className="absolute left-0 top-0 h-[500px] w-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #FFD6A5 0%, #FF9F43 100%)',
          filter: 'blur(120px)',
          mixBlendMode: 'multiply',
          willChange: 'transform',
        }}
      />
      
      {/* 淡青色光斑 - Soft Teal */}
      <div
        ref={orb2Ref}
        className="absolute left-0 top-0 h-[600px] w-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #CAE9E0 0%, #5EEAD4 100%)',
          filter: 'blur(120px)',
          mixBlendMode: 'multiply',
          willChange: 'transform',
        }}
      />
      
      {/* 淡紫色光斑 - Pale Lavender */}
      <div
        ref={orb3Ref}
        className="absolute left-0 top-0 h-[400px] w-[400px] rounded-full"
        style={{
          background: 'radial-gradient(circle, #E6E6FA 0%, #A78BFA 100%)',
          filter: 'blur(100px)',
          mixBlendMode: 'multiply',
          willChange: 'transform',
        }}
      />
    </div>
  )
}
