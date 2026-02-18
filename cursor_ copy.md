# 项目开发文档和架构规划
_Exported on 2026/2/18 at GMT+8 17:34:38 from Cursor (2.3.41)_

---

**User**

1、请细化页面。不可能每个部分只有一个页面。
2、风格我不满意。需要加上morphism，记单词部分的页面太过丑陋。
3、speaking部分我们的文档已经明确指出有两个模式，应该在这个主页面中选择进入两个模式，然后两个模式是两个不同的页面。
请你结合实际使用情景和@docs 中的具体文档内容，大幅优化目前的UI设计。

---

**Cursor**

正在阅读文档以确认各模块的页面结构、Speaking 的两种模式及具体描述，随后大幅优化设计并加入 morphism 风格。


继续查看文档与当前设计文件结构，以便我们添加多页面并应用 morphism 风格。


正在根据文档细化多页面结构、应用 glassmorphism/neumorphism 风格，并单独实现 Speaking 的两种模式入口与两个子页面。


正在设置 morphism 变量并更新 Dashboard：为卡片应用玻璃拟态并添加“最近活动”区。


将 Vocabulary 主页改为 Hub（三个入口卡片，玻璃拟态），并新增 Vocabulary Review 与 Vocabulary Stats 页面。


在 Vocabulary 主区添加 Hub 入口并删除旧内容；接着创建 Review 与 Stats 两个新页面。


正在创建 Vocabulary Review 页（玻璃拟态大闪卡 + 进度 + 四档按钮）和 Vocabulary Stats 页。


正在将 Speaking 主页面改为模式选择（两个大卡片），并添加 Speaking Chat 与 Speaking Mock 页面。


正在创建 Speaking Chat 与 Speaking Mock 两个子页面。


正在为 Settings 和 Writing 应用玻璃拟态，并更新文档。


已按你的三点要求做完调整，并和文档对齐。摘要如下。

---

## 1. 细化页面（每个模块不再只有一页）

- **Vocabulary**
  - **Hub**（`/vocabulary`）：今日待复习横幅（42 words due today + Start review）+ 三个入口卡片：**Flashcard review**（Enter）→ **Stats & charts**（View）→ **Browse words**（Open）。
  - **Review**（`/vocabulary/review`）：进度条（3/42）、大闪卡（单词 / 音标 / 释义 / 点击翻转提示）、Again / Hard / **Good** / Easy 四档按钮。
  - **Stats**（`/vocabulary/stats`）：Review heatmap（Last 12 weeks）+ Learning curve（Mastered vs in progress）两个玻璃面板。
- **Speaking**
  - **模式选择**（`/speaking`）：两个大卡片——**闲聊模式 (Free Chat)**、**模考模式 (Mock Test)**，各有说明和 Enter，以及「View practice history」。
  - **Free Chat**（`/speaking/chat`）：对话气泡（AI / 用户）、波形区、Push to talk 录音。
  - **Mock Test**（`/speaking/mock`）：Part 1 / 2 / 3 徽章、题目卡、计时 00:45、Start recording（90s/110s/120s）。
- **Dashboard**：在原有统计 + 热力图基础上，增加了 **Recent activity**（如：Reviewed 12 words、Writing Task 2、Speaking Part 1）。

---

## 2. Morphism 风格（玻璃拟态）

- **全局**：卡片/面板使用半透明填充（如 `#ffffff0c`、`#ffffff0a`）+ 细边框（`#ffffff12`～`#ffffff18`）+ 大圆角（12–24px）。
- **侧栏**：统一为 `#ffffff08`，与背景区分、保持轻量玻璃感。
- **记单词相关**：
  - Hub：三张入口卡为玻璃卡片（圆角 20px），图标用色块（蓝/绿/紫）+ 圆角 14px。
  - Review：中央大闪卡为玻璃卡（约 520×320，圆角 24px）；Again/Hard 为深色/玻璃按钮，Good/Easy 为主色/绿色，整体更干净。
  - Stats：热力图与学习曲线分别放在两个玻璃面板（圆角 20px）中。
- **Settings / Writing**：表单卡、编辑区卡也改为同套玻璃样式（圆角 20px）。
- 实现建议：Tailwind 用 `bg-white/[0.06]`、`border-white/[0.08]`、`backdrop-blur-xl` 等还原。

---

## 3. Speaking：主页面选模式，两个模式两个页面

- **主页面**（`/speaking`）：仅做 **模式选择**——两个并排大卡片：
  - **闲聊模式**：Free Chat，说明无时间限制、练流利度与即时反馈，蓝色 Enter。
  - **模考模式**：Mock Test，说明 Part 1 → Part 2（1min prep + 2min）→ Part 3、计时与评分，橙色 Enter。
- **两个独立页面**：
  - `/speaking/chat`：自由对话界面（气泡 + 波形 + Push to talk）。
  - `/speaking/mock`：模考界面（Part 徽章 + 题目 + 计时 + 录音）。

---

## 文档与设计文件

- **`docs/frontend-pages.md`**：已更新「设计稿」小节（多屏、玻璃拟态、Vocabulary/Speaking 页面划分），并明确 2.5 口语为「模式选择 + Chat 页 + Mock 页」。
- **`designs/README.md`**：已重写，说明 glassmorphism、多屏与画布对应关系（第 1 行：Dashboard → … → Speaking 模式选择；第 2 行：Vocab Review/Stats、Speaking Chat/Mock）。

设计文件仍为 **`designs/ielts-mate.pen`**，在 Pencil 中打开即可查看所有上述页面与风格。若你希望某一块再加强 morphism（例如更重阴影或更明显模糊），可以指定页面或组件，我可以再改一版设计说明或标注。

