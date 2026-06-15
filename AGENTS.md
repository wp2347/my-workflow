# My Workflow Development Rules

## i18n Behavior Code（国际化行为准则）

### 强制规则

1. **所有面向用户的文字必须国际化**，禁止在组件中硬编码中文或英文字符串。
2. 新增任何 UI 文案时，必须同步添加到 `src/i18n/locales/zh.json` 和 `src/i18n/locales/en.json`。
3. 组件中使用 `useTranslation()` hook 获取翻译函数 `t`。

### 使用方式

```tsx
import { useTranslation } from "@/i18n"

export function MyComponent() {
  const { t } = useTranslation()
  return <h1>{t("myPage.title")}</h1>
}
```

### 添加新翻译

1. 在 `zh.json` 和 `en.json` 中按页面/功能分组添加 key
2. 支持占位符：`t("key", { name: "value" })` → `"Hello {name}"` → `"Hello value"`
3. 嵌套 key 用 `.` 分隔：`t("home.welcome")`

### 语言切换

- 侧边栏底部 🌐 按钮切换中/英文
- 用户选择存储在 `localStorage` (`workflow-locale`)

### 检查清单

每次修改 UI 时确保：
- [ ] 新增文字已加入 `zh.json`
- [ ] 新增文字已加入 `en.json`
- [ ] 组件中使用了 `t()` 而非硬编码字符串
- [ ] 占位符格式为 `{keyName}`

## 技术栈规则

- 状态管理：Zustand（`src/stores/`）
- 类型定义：`src/types/workflow.ts`
- AI 模型列表：`src/lib/providers.ts`（需与官方文档同步）
- API 路由：Next.js Route Handlers（`src/app/api/`）
- 数据库：Prisma + PostgreSQL，schema 在 `prisma/schema.prisma`

## 新增节点类型规则

添加新节点时需创建/修改：
1. `src/types/workflow.ts` — 添加 `NodeType` 联合类型
2. `src/components/nodes/` — 新建节点 UI 组件
3. `src/components/canvas/Canvas.tsx` — 注册 `nodeTypes`
4. `src/components/canvas/NodePanel.tsx` — 添加拖拽入口
5. `src/components/panels/NodeConfigPanel.tsx` — 添加配置表单
6. `src/engine/nodes/` — 新建执行器逻辑
7. `src/engine/executor.ts` — 注册 executor
8. ⚠️ 所有新增 UI 文字必须同步更新 `zh.json` 和 `en.json`

## 运行命令

```bash
npm run dev          # 开发（Turbopack）
npm run dev:webpack  # 开发（Webpack 兼容）
npm run typecheck    # TypeScript 类型检查
npm run build        # 生产构建
npm run lint         # ESLint
```
