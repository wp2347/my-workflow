# AudioResultCard 元信息字段名 i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AudioResultCard 预览卡片的元信息字段名支持中英文 i18n，常见字段显示友好名称，未知字段保持原样。

**Architecture:** 在 `audioResult.fields.*` 新增中英文 i18n 映射。`AudioResultCard` 的静态 `known` 映射改为 `fieldLabel(key)` 函数：从 `t("audioResult.fields.<key>")` 取翻译，若 `t()` 返回 key 本身（i18n fallback）则显示原字段名。未知字段不抛错。

**Tech Stack:** React · i18n（zh.json/en.json）· Vitest（仅验证）

---

## Task 1: i18n keys

**Files:**
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: 在 zh.json 的 `audioResult` 对象内新增 `fields` 子对象**

`src/i18n/locales/zh.json` 的 `"audioResult": { ... }` 对象内，在 `"clearFailed": "清空失败，请重试"` 之后（保持 JSON 逗号正确）追加：

```json
    "fields": {
      "title": "标题",
      "duration": "时长",
      "style": "风格",
      "artist": "艺术家",
      "album": "专辑",
      "genre": "流派",
      "format": "格式",
      "model": "模型",
      "lyrics": "歌词",
      "sample_rate": "采样率",
      "channels": "声道",
      "length": "长度",
      "bitrate": "码率",
      "music_duration": "时长",
      "music_sample_rate": "采样率",
      "music_channel": "声道",
      "music_size": "文件大小"
    }
```

注意：`audioResult` 内已有 `title`/`duration`/`style` 三个顶层 key（值为"标题"/"时长"/"风格"）。新增的 `fields` 子对象**不冲突**（不同路径：`audioResult.fields.title` vs `audioResult.title`），两者都保留。

- [ ] **Step 2: 在 en.json 的 `audioResult` 对象内新增 `fields` 子对象**

`src/i18n/locales/en.json` 的 `"audioResult": { ... }` 内，`"clearFailed": "Clear failed, please retry"` 之后追加：

```json
    "fields": {
      "title": "Title",
      "duration": "Duration",
      "style": "Style",
      "artist": "Artist",
      "album": "Album",
      "genre": "Genre",
      "format": "Format",
      "model": "Model",
      "lyrics": "Lyrics",
      "sample_rate": "Sample Rate",
      "channels": "Channels",
      "length": "Length",
      "bitrate": "Bitrate",
      "music_duration": "Duration",
      "music_sample_rate": "Sample Rate",
      "music_channel": "Channel",
      "music_size": "File Size"
    }
```

- [ ] **Step 3: 验证 JSON 合法**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/zh.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8')); console.log('ok')"`
Expected: 输出 `ok`

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat(i18n): audioResult 元信息字段名映射"
```

---

## Task 2: AudioResultCard 字段名本地化

**Files:**
- Modify: `src/components/panels/AudioResultCard.tsx`（第 37-42 行 known 映射 + 第 62 行渲染）

- [ ] **Step 1: 替换静态 known 映射为 fieldLabel 函数**

把 `src/components/panels/AudioResultCard.tsx` 第 37-42 行：

```tsx
  const known: Record<string, string> = {
    title: t("audioResult.title"),
    duration: t("audioResult.duration"),
    style: t("audioResult.style"),
  }
  const entries = Object.entries(metadata || {})
```

替换为：

```tsx
  const fieldLabel = (key: string): string => {
    const label = t(`audioResult.fields.${key}`)
    return label === `audioResult.fields.${key}` ? key : label
  }
  const entries = Object.entries(metadata || {})
```

- [ ] **Step 2: 渲染处改用 fieldLabel**

把第 62 行：

```tsx
                <dt className="text-muted-foreground min-w-[60px]">{known[k] || k}</dt>
```

替换为：

```tsx
                <dt className="text-muted-foreground min-w-[60px]">{fieldLabel(k)}</dt>
```

- [ ] **Step 3: typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS（无新错误；预存错误保持基线）

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/AudioResultCard.tsx
git commit -m "feat(ui): AudioResultCard 元信息字段名 i18n 本地化"
```

---

## Task 3: 验证

**Files:** 无（仅验证）

- [ ] **Step 1: 全部单测**

Run: `npm test`
Expected: PASS（80 个测试）

- [ ] **Step 2: 浏览器验证中文显示**

1. 打开 `http://localhost:3000/history/cmscmv0gf000033mgd8ax7utr`（之前用真实 MiniMax 生成的那次执行）
2. 元信息卡片应显示：`时长: 110602`、`采样率: 44100`、`声道: 2`、`码率: 256000`、`文件大小: 3541253`（中文字段名）
3. 点击侧边栏「Switch to English」→ 刷新历史页 → 应显示 `Duration`/`Sample Rate`/`Channel`/`Bitrate`/`File Size`
4. 若某次执行的 metadata 有 `title`/`duration`/`style`，应显示 `标题`/`时长`/`风格`

- [ ] **Step 3: 最终 Commit（如有修复则按 fix: 提交）**

---

## 自检备注

- Spec 覆盖：i18n keys(T1)、AudioResultCard 改造(T2)、验证(T3)。全覆盖。
- 占位符扫描：无 TBD/TODO。
- 类型一致：`fieldLabel` 在 T2 定义与使用一致；`audioResult.fields.<key>` 键在 T1 定义、T2 引用一致。
