import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { DownloaderAddForm } from './DownloaderAddForm'

describe('DownloaderAddForm', () => {
  it('labels simulated inputs and disables real login-state selection with a visible reason', () => {
    const markup = renderToStaticMarkup(
      <DownloaderAddForm
        taskUrl="https://example.com/video"
        taskOutputDir=""
        taskCookieBrowser="none"
        taskCompatibleFormat={false}
        addingTask={false}
        submitError=""
        onTaskUrlChange={vi.fn()}
        onTaskOutputDirChange={vi.fn()}
        onTaskCookieBrowserChange={vi.fn()}
        onTaskCompatibleFormatChange={vi.fn()}
        onOpenDirectoryPicker={vi.fn()}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(markup).toContain('class="dl-form-command-row"')
    expect(markup).toContain('class="dl-field dl-option-control dl-login-option"')
    expect(markup).toContain('aria-label="浏览器登录态（未接入）"')
    expect(markup).toMatch(/<select[^>]*id="download-cookie-browser"[^>]*disabled=""/)
    expect(markup).toContain('aria-describedby="download-cookie-unavailable"')
    expect(markup).toContain('不会读取 Cookie；请勿提供登录信息。')
    expect(markup).not.toContain('value="chrome"')
    expect(markup).not.toContain('退出对应浏览器')
    expect(markup).toContain('仅演示任务参数和状态，不访问链接、不读取登录态，也不生成文件。')
    expect(markup).toContain('每行一个 HTTPS URL')
    expect(markup).toContain('模拟格式参数：H.264 / MP4')
    expect(markup).toContain('aria-describedby="download-compatible-format-help"')
    expect(markup).toContain('id="download-compatible-format-help" class="dl-option-help__tooltip" role="tooltip"')
    expect(markup).toContain('添加模拟任务')
    expect(markup).not.toContain('检测到字幕时')
    expect(markup).not.toContain('会转码为')
  })
})
