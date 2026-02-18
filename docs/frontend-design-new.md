这是一份基于 **"Flux Academy (Light Mode)"** 视觉风格的最终版前端设计方案。

该方案将重点放在 **“轻盈”、“流动”与“触感”** 上，并提供了具体的代码实现思路，确保开发落地的还原度。

---

# 前端设计方案：Flux Academy (Light Mode)

> **核心理念**：将软件界面打造为一个“悬浮在云端的书房”。抛弃沉重的深色科幻感，转而使用温暖的柔光、陶瓷质感的磨砂玻璃和符合物理直觉的微交互。

## 1. 设计系统基础 (Design System)

### 1.1 色板 (Color Palette)
这套配色的核心在于**低饱和度 + 高明度**，模拟自然光下的漫反射。

*   **Canvas (背景基底)**: `#F7F6F2` (暖米白)
*   **Fluid Orbs (流动光斑色)**:
    *   *Warm Sun*: `#FFD6A5` (淡橙)
    *   *Soft Teal*: `#CAE9E0` (淡青)
    *   *Pale Lavender*: `#E6E6FA` (淡紫)
*   **Glass Surface (卡片背景)**: `rgba(255, 255, 255, 0.4)` ~ `0.65`
*   **Text (文字)**:
    *   Primary: `#2D3436` (深灰，避免纯黑的刺眼)
    *   Secondary: `#636E72`
    *   Accent: `#E17055` (用于强调数据或 CTA)

### 1.2 排印 (Typography)
*   **Headings (标题)**: *Fraunces* 或 *Playfair Display* 。
    *   *特征*：柔和的衬线体，传递学术与优雅感。
*   **Body (正文)**: *Inter* 或 *Satoshi*。
    *   *特征*：高可读性，几何感，中和标题的古典气。

---

## 2. 核心视觉实现 (Technical Implementation)

### 2.1 交互式流体背景 (Interactive Fluid Background)
**目标**：背景不是一张死图，而是几个巨大的彩色光斑，随鼠标移动而缓慢游走，如同水面的倒影。

**实现逻辑 (React + Framer Motion / Native JS)**：

1.  **DOM 结构**：在根节点放置 3-4 个 `div` (Blob)，绝对定位。
2.  **CSS 样式**：
    *   使用 `filter: blur(120px)` 将圆形模糊成光晕。
    *   使用 `mix-blend-mode: multiply` 或 `overlay` 让颜色互相渗透。
    *   使用 `will-change: transform` 开启 GPU 加速。
3.  **JS 交互 (缓动跟随)**：
    *   **核心算法 (Linear Interpolation / Lerp)**：
        `currentX += (targetX - currentX) * 0.05`
    *   **实现步骤**：
        1.  监听 `mousemove` 事件，获取鼠标坐标 `(e.clientX, e.clientY)` 作为 `target`。
        2.  创建一个 `useRef` 存储每个 Blob 的当前坐标 `(currX, currY)`。
        3.  使用 `requestAnimationFrame` 循环：每一帧计算 `curr` 向 `target` 靠近一点点。
        4.  更新 DOM 的 `transform: translate3d(...)`。
    *   *优化*：为不同的 Blob 设置不同的“滞后系数” (0.05, 0.03, 0.08)，制造出层次感。

```javascript
// 伪代码示例
const useMouseFollow = (ref, delay) => {
  useAnimationFrame(() => {
    // 每一帧让 ref.current 向 mouse.current 移动一小步
    currentX = lerp(currentX, mouseX, delay);
    currentY = lerp(currentY, mouseY, delay);
    ref.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  });
};
```

### 2.2 陶瓷质感磨砂玻璃 (Ceramic Glassmorphism)
**目标**：不同于普通的磨砂，这种玻璃要有“厚度”和“温润感”，边缘有高光。

**CSS 实现 (Tailwind v4 / Custom CSS)**：

```css
.flux-card {
  /* 背景：半透明白色 */
  background: rgba(255, 255, 255, 0.4);
  
  /* 核心：极其强烈的模糊，制造景深感 */
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);

  /* 边框：模拟顶部受光，底部反光 */
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);

  /* 阴影：多层阴影制造悬浮感 */
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.02),
    0 20px 40px -8px rgba(0, 0, 0, 0.04);
    
  /* 倒角 */
  border-radius: 24px;
}

/* 悬停时的光效 */
.flux-card:hover {
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 
    0 10px 15px -3px rgba(0, 0, 0, 0.03),
    0 30px 60px -12px rgba(199, 169, 147, 0.15); /* 暖色投影 */
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

### 2.3 3D 核心球体 (The Hero Orb)
**目标**：首页左侧的视觉中心，一个缓慢蠕动的有机球体。

**实现方案**：
*   **高配版 (推荐)**: 使用 **Spline** 导出的 React 组件。这是最容易实现图示那种“类似粘土/软糖”质感的方法。
*   **低配版 (纯 CSS)**: 使用 CSS `border-radius` 动画。
    ```css
    @keyframes morph {
      0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
      50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
      100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
    }
    .hero-orb {
      background: linear-gradient(135deg, #FFD6A5 0%, #FF9F43 100%);
      animation: morph 8s ease-in-out infinite;
    }
    ```

---

## 3. 页面布局详解 (Page Layouts)

### 3.1 首页 / Dashboard (Bento Grid)
布局采用 CSS Grid，间距 `gap-6`。

*   **Zone A (Left - Hero):** 2x2 大卡片。
    *   内容：Spline 3D 球体 + 问候语 ("Good morning, Alex") + 当前聚焦任务。
    *   效果：球体在卡片内缓慢自转。
*   **Zone B (Top Right - Consistency):** 1x2 长卡片。
    *   内容：GitHub 风格的热力图，但是点是**圆形的、发光的** (box-shadow)。
    *   颜色：活跃天数为暖橙色，非活跃为浅灰色。
*   **Zone C (Bottom Right - Goals & Mastery):** 两个 1x1 小卡片。
    *   **Goals**: 列表项。完成的项划掉并淡化。
    *   **Mastery**: 环形进度条或条形进度条。使用 SVG `stroke-dasharray` 实现动画。

### 3.2 悬浮导航坞 (Floating Dock)
**位置**：屏幕底部居中，`position: fixed; bottom: 32px;`。
**样式**：胶囊形状，极高的磨砂玻璃模糊度。

**图标设计 (使用 Lucide React)**：
1.  **Home**: `Home` (首页)
2.  **Vocab**: `Library` 或 `BookOpen` (代表词库)
3.  **Writing**: `PenTool` 或 `Feather` (羽毛笔，更优雅)
4.  **Speaking**: `Mic` (麦克风)
5.  **Settings**: `Settings` (设置)

**交互**：
*   使用 **Framer Motion** 的 `<motion.div layoutId="active-pill" />`。
*   当点击不同图标时，一个淡淡的白色光斑背景会在图标之间平滑滑动（而不是生硬的跳转）。
*   鼠标悬停图标时，图标轻微上浮 `translateY(-4px)`。

---

## 4. 动画编排 (Animation Orchestration)

不要让所有元素同时出现。使用**交错动画 (Stagger)**。

```javascript
// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1, // 每个子元素延迟 0.1s 出现
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1, 
    transition: { type: "spring", stiffness: 100, damping: 15 } // 弹簧效果
  }
};
```

---

## 5. 开发路线图检查清单

1.  **Step 1: 环境搭建**
    *   配置 Tailwind v4。
    *   定义 `theme.colors` 中的 pastel 色系。
    *   安装 `framer-motion`, `lucide-react`, `clsx`, `tailwind-merge`。

2.  **Step 2: 基础组件 (UI Kit)**
    *   封装 `<GlassCard />`: 包含上述 CSS 样式的通用容器。
    *   封装 `<FluidBackground />`: 实现鼠标跟随逻辑。
    *   封装 `<Dock />`: 实现底部导航与路由跳转。

3.  **Step 3: 首页组装**
    *   实现 Bento Grid 布局。
    *   嵌入 3D 球体 (或 CSS 替代品)。
    *   绘制热力图组件。

4.  **Step 4: 细节打磨**
    *   添加全局字体。
    *   调整阴影和模糊半径，确保在浅色背景下文字依然清晰可见。
    *   测试窗口缩放时的流体布局适配。