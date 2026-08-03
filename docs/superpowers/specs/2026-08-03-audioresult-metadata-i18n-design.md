# AudioResultCard 元信息字段名 i18n 设计

> 日期：2026-08-03
> 状态：已定稿，待用户审阅

## 目标

执行历史详情页的 `AudioResultCard` 预览卡片中，元信息（metadata）字段名支持中英文 i18n。常见音乐元信息字段（title/duration/style、MiniMax 的 music_duration 等）显示友好本地化名称，未知字段保持原样显示。

## 背景

`AudioResultCard`（`src/components/panels/AudioResultCard.tsx`）当前用静态映射：
```ts
const known: Record<string, string> = {
  title: t("audioResult.title"),
  duration: t("audioResult.duration"),
  style: t("audioResult.style"),
}
```
只有 3 个键。MiniMax 返回的 `music_duration`/`music_sample_rate`/`music_channel`/`bitrate`/`music_size` 等字段名未翻译，直接以英文键名显示（如 `music_duration: 110602`）。

## 方案

把静态 `known` 映射改为 i18n 查找：字段名作为 key，从 `audioResult.fields.<字段名>` 取翻译；取不到（`t()` 返回 key 本身或 fallback）则显示原字段名。

### 1. i18n keys（`zh.json` / `en.json`）

在 `audioResult` 分组下新增 `fields` 子对象：

**zh.json `audioResult.fields`：**
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

**en.json `audioResult.fields`：**
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

### 2. AudioResultCard 改造（`src/components/panels/AudioResultCard.tsx`）

把第 37-41 行的静态 `known` 映射替换为 i18n 动态查找：

```tsx
  const fieldLabel = (key: string): string => {
    const label = t(`audioResult.fields.${key}`)
    return label === `audioResult.fields.${key}` ? key : label
  }
```

渲染处（第 62 行）：
```tsx
<dt className="text-muted-foreground min-w-[60px]">{fieldLabel(k)}</dt>
```

- 字段名在 `audioResult.fields` 中存在 → 显示本地化名称
- 不存在 → `t()` 返回 key 字符串本身（i18n 库的 fallback 行为），`fieldLabel` 检测到后返回原字段名

保留现有 `audioResult.title/duration/style` 三个顶层 key 不动（可能被其他代码引用，YAGNI 不删），但 `fields` 子对象会优先覆盖这 3 个字段的显示。

### 3. 错误处理

- 未知字段：`t()` fallback 到 key，`fieldLabel` 检测 `label === key` 返回原字段名，不抛错。
- 字段值本身（如 `110602`）不做格式化，原样显示。

## 涉及文件

1. `src/components/panels/AudioResultCard.tsx` — `known` 映射改 `fieldLabel` i18n 查找
2. `src/i18n/locales/zh.json` — 新增 `audioResult.fields`
3. `src/i18n/locales/en.json` — 新增 `audioResult.fields`

## 测试要点

- i18n JSON 合法（node JSON.parse 验证）
- AudioResultCard typecheck 通过
- 浏览器验证：历史页元信息显示中/英文（切换语言后刷新）

## 非目标（本次不做）

- 不做字段值的格式化（时长 110602ms → "1分50秒"、码率 256000 → "256kbps"）。
- 不重命名 MiniMax 返回的原始字段键（保持 `music_duration` 等原始键，仅显示层翻译）。

## 不确定项

- 无。
