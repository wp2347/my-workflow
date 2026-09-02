# 全站 UI 优化设计（柔和智能 · 雾紫）

- 日期：2026-08-12
- 范围：全站（主框架/列表页/画布编辑器/表单弹窗/聊天）
- 风格方向：B · 雾紫智能（Soft Violet）——柔和、低饱和、克制用色

## 1. 设计目标

1. 全站统一为"柔和 + 智能"气质：低饱和雾紫主色、大量中性灰、柔和阴影、圆角更大。
2. **杜绝颜色污染**：主色只在按钮/选中态/链接/开关使用，其余全部中性；状态色（绿/琥珀/红）仅以低饱和形态出现在徽章与节点图标上。
3. 深浅两套主题同步调优。
4. 画布编辑器（React Flow 节点/连线/小地图）一并统一。

## 2. 配色系统（CSS 变量，`src/app/globals.css`）

### 浅色（`:root`）

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `--background` | `#faf9fb` | 微紫白 |
| `--foreground` | `#21192f` | 深紫灰 |
| `--card` / `--popover` | `#ffffff` | |
| `--primary` | `#6d5bd0` | 雾紫主色 |
| `--primary-foreground` | `#ffffff` | |
| `--secondary` | `#f0edf8` | |
| `--secondary-foreground` | `#21192f` | |
| `--muted` | `#f3f0f9` | |
| `--muted-foreground` | `#6f6781` | |
| `--accent` | `#f0edf8` | |
| `--accent-foreground` | `#21192f` | |
| `--destructive` | `#c2414c` | |
| `--border` | `#e7e3f0` | |
| `--input` | `#d9d3e8` | 略深，保证输入框可见 |
| `--ring` | `#b3a6e8` | 聚焦光圈，柔和 |
| `--sidebar` | `#fdfcfe` | |
| `--sidebar-foreground` | `#21192f` | |
| `--sidebar-primary` | `#6d5bd0` | |
| `--sidebar-accent` | `#f0edf8` | |
| `--sidebar-border` | `#e7e3f0` | |
| `--radius` | `0.75rem` | 12px |

### 深色（`.dark`）

| 变量 | 值 |
| --- | --- |
| `--background` | `#16131d` |
| `--foreground` | `#e9e6f2` |
| `--card` | `#1e1a28` |
| `--popover` | `#221d30` |
| `--primary` | `#a99de8` |
| `--primary-foreground` | `#1a1425` |
| `--secondary` | `#2a2436` |
| `--muted` | `#282232` |
| `--muted-foreground` | `#9b94a8` |
| `--accent` | `#2a2436` |
| `--destructive` | `#e58a92` |
| `--border` | `rgb(255 255 255 / 8%)` |
| `--input` | `rgb(255 255 255 / 12%)` |
| `--ring` | `rgb(169 157 232 / 40%)` |
| `--sidebar` | `#1e1a28` |
| `--sidebar-border` | `rgb(255 255 255 / 8%)` |

实现时颜色可直接使用 hex（Tailwind v4 接受任意颜色值），保持 `@theme inline` 的映射不变，替换各变量值即可。

### 阴影规范（新增通用 shadow 工具类到 globals.css）

- 卡片：`0 1px 2px rgb(31 27 41 / 4%)`
- 悬浮/交互：`0 4px 16px rgb(31 27 41 / 10%)`
- 弹层（下拉/弹窗）：`0 8px 28px rgb(31 27 41 / 12%)`
- 深色模式阴影用黑色透明度替代。

## 3. 共享组件改造

### 3.1 按钮 `src/components/ui/button.tsx`
- 默认：`bg-primary text-primary-foreground` + 内高光 `shadow-[inset_0_1px_0_rgb(255_255_255_/_12%)]` 与轻投影 `shadow-sm`，hover 加深主色
- outline：`border-border` 或 `border-input`，hover `bg-muted`
- secondary：`bg-secondary text-secondary-foreground`
- ghost / destructive / link 保持语义，destructive 改为浅红底红字（`bg-destructive/10 text-destructive`，已在）
- 尺寸保持 default `h-8`、`sm h-7`、`lg h-9`，圆角统一 `rounded-lg`（跟随 `--radius-md`）

### 3.2 下拉/选择 `src/components/ui/select.tsx`
- **选项间距**：`SelectItem` 增加 `my-0.5`（每个选项之间留间距，组内最后一项无多余间距）——这是用户明确反馈点
- 弹出面板：`rounded-xl shadow-lg`（柔和阴影）、保留淡入缩放动画
- 选中项：`bg-accent text-accent-foreground` 即浅雾紫底 + 勾选图标
- 分组标签：`SelectLabel` 增加上下留白，与选项分隔
- 触发器：与输入框一致的高度/圆角/边框/聚焦光圈

### 3.3 输入/文本域 `src/components/ui/input.tsx` / `textarea.tsx`
- 聚焦光圈统一：`focus-visible:ring-3 focus-visible:ring-ring/50`（跟随 `--ring` 自动变色）
- 圆角/高度与按钮、选择器对齐（`h-8 rounded-lg`）

### 3.4 开关 / 徽章 / 标签页 / 卡片 / 弹窗
- `switch.tsx`：颜色随 `--primary` 自动生效，无需改动（核对圆角与尺寸）
- `badge.tsx`：新增低饱和状态色变体（可复用 `variant` 或新增 `soft-success / soft-warning / soft-destructive` 样式类），颜色从 tokens 派生，不硬编码
- `tabs.tsx`：容器浅雾紫底（`bg-muted`）+ 选中项白卡片 + 轻投影
- `card.tsx`：确认默认圆角跟随 `--radius`、加轻投影
- `dialog.tsx`：`rounded-2xl shadow-lg`，保持动画

## 4. 布局

- 侧边栏 `src/app/(dashboard)/layout.tsx`：
  - 背景 `--sidebar`（浅色 `#fdfcfe`）
  - 激活项用浅雾紫底 + 雾紫文字（`variant="secondary"` 已接近，核对颜色自动生效）
  - 各链接按钮尺寸/间距统一（`h-8`、按钮组间距）
- 列表页（workflows/templates/history/credentials/knowledge/extensions）：
  - 统一页面内边距 `p-6`、标题区结构（标题 + 副标题 + 右上主按钮）与间距
  - 卡片 hover 雾紫描边（`hover:border-primary` 已在，随 token 自动生效）
- 画布编辑器：NodePanel / Toolbar / ConfigPanel 内边距、分隔线颜色统一跟随 token

## 5. 画布节点（React Flow）

- 节点卡片（`src/components/nodes/*.tsx`）：中性底 + 细边框 + 轻阴影，**图标小方块用各类型低饱和色**，节点本体不染色：
  - `LLMNode`：雾紫 `#6d5bd0` / 底 `#f1edfb`
  - `InputNode`：蓝 `#3b74d0` / 底 `#eaf1fd`
  - `OutputNode`：绿 `#4f946e` / 底 `#ecf7f1`
  - `ConditionNode`：琥珀 `#b07a2d` / 底 `#fbf3e4`
  - `HttpNode`：钢灰蓝；`FeishuNode`：青；`MergeNode`：紫灰；`CronTriggerNode`：琥珀；`MusicNode`：柔粉
  - 以上颜色仅用于图标小方块背景/前景，全部低饱和
- 选中态：`border-primary` + `ring-3 ring-ring/40`（雾紫描边 + 光圈）
- 端口（Handle）：统一雾紫 `#b3a6e8`，白描边，选中/可连接时高亮
- 连线（`Canvas.tsx`）：`stroke #b3a6e8`、`strokeWidth 2`、smoothstep + 动画保留；选中连线加深
- 背景网格：跟随主题（浅色浅紫灰点阵，深色半透明白）
- 小地图/缩放控件：底色与阴影跟随 token；如默认样式不适配则添加覆盖样式

## 6. 国际化

- 本次改动几乎不新增文案；如新增任何状态徽章/占位文字，必须同步 `src/i18n/locales/zh.json` 与 `en.json`，组件用 `useTranslation()`。

## 7. 不做的事（YAGNI）

- 不改动节点执行逻辑 / 数据流 / API
- 不重构组件结构（只改样式与少量 class）
- 不新增第三方 UI 库

## 8. 风险与验证

- 风险：`shadcn`/Base UI 组件 class 较多，改动时需逐一核对交互态（hover/active/focus/disabled）
- 验证：`npm run typecheck` + `npm run lint` + `npm run build`；手动过一遍各页面与画布交互
