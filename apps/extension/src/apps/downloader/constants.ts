import type { CategoryKey, CategoryMeta, PlatformOption } from 'unas-src/apps/downloader/types'

export const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    value: 'auto',
    label: '模拟 URL 分类',
  },
  {
    value: 'youtube',
    label: 'YouTube / Shorts（标签）',
  },
  {
    value: 'bilibili',
    label: 'Bilibili（标签）',
  },
  {
    value: 'short_video',
    label: '短视频平台（标签）',
  },
]

export const CATEGORY_MAP: Record<CategoryKey, CategoryMeta> = {
  all: { label: '全部', icon: 'grid', key: 'all' },
  downloading: { label: '模拟运行中', icon: 'download', key: 'downloading' },
  completed: { label: '模拟完成', icon: 'check', key: 'completed' },
  paused: { label: '已停止', icon: 'pause', key: 'paused' },
  error: { label: '错误', icon: 'error', key: 'error' },
}
