import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { DownloaderAddForm } from './DownloaderAddForm'

describe('DownloaderAddForm', () => {
  it('only exposes link input while preserving the visible mock boundary', () => {
    const markup = renderToStaticMarkup(
      <DownloaderAddForm
        taskUrl="https://example.com/video"
        addingTask={false}
        submitError=""
        onTaskUrlChange={vi.fn()}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(markup).toContain('可直接下载的文件链接将交给 Chrome 下载；m3u8/mpd 分片合并暂未接入。')
    expect(markup).toContain('下载链接')
    expect(markup).toContain('每行一个 HTTPS URL')
    expect(markup).toContain('提交下载任务')
    expect(markup).not.toContain('<select')
    expect(markup).not.toContain('type="checkbox"')
    expect(markup).not.toContain('下载目的地')
    expect(markup).not.toContain('Cookie')
    expect(markup).not.toContain('H.264')
  })
})
