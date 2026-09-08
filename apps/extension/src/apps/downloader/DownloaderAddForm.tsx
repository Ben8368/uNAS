import type { CookieBrowser } from 'unas-src/apps/downloader/types'

type DownloaderAddFormProps = {
  taskUrl: string
  taskCookieBrowser: CookieBrowser
  taskCompatibleFormat: boolean
  addingTask: boolean
  submitError: string
  onTaskUrlChange: (value: string) => void
  onTaskCookieBrowserChange: (value: CookieBrowser) => void
  onTaskCompatibleFormatChange: (value: boolean) => void
  onSubmit: () => void
  onClose: () => void
}

type DownloadOptionHelpProps = { id: string; label: string; children: string }

function DownloadOptionHelp({ id, label, children }: DownloadOptionHelpProps) {
  return <span className="dl-option-help">
    <button type="button" className="dl-option-help__trigger" aria-label={label} aria-describedby={id}><span aria-hidden="true">?</span></button>
    <span id={id} className="dl-option-help__tooltip" role="tooltip">{children}</span>
  </span>
}

export function DownloaderAddForm({
  taskUrl,
  taskCookieBrowser,
  taskCompatibleFormat,
  addingTask,
  submitError,
  onTaskUrlChange,
  onTaskCookieBrowserChange,
  onTaskCompatibleFormatChange,
  onSubmit,
  onClose,
}: DownloaderAddFormProps) {
  return <div className="dl-add-form" aria-label="新建模拟下载任务">
    <p className="dl-field-hint">仅演示任务参数和状态，不访问链接、不读取登录态，也不生成文件。</p>
    <div className="dl-form-section dl-form-section--source">
      <div className="dl-field dl-field--source">
        <div className="dl-field-heading"><label htmlFor="download-task-url">模拟来源链接</label><small>每行一个 HTTPS URL</small></div>
        <textarea id="download-task-url" value={taskUrl} onChange={(event) => onTaskUrlChange(event.target.value)} placeholder={'https://example.com/video\nhttps://example.com/audio'} rows={4} style={{ resize: 'vertical', minHeight: '80px' }} />
        <small className="dl-field-hint">URL 仅用于模拟任务记录，不代表平台或字幕支持。提交后可在右侧运行状态中推进预览步骤。</small>
      </div>
    </div>

    <div className="dl-form-section dl-form-section--destination">
      <div className="dl-field dl-field--path">
        <div className="dl-field-heading"><label>下载目的地</label><small>浏览器配置决定实际位置</small></div>
        <div className="dl-path-field dl-path-field--static">
          <span className="dl-path-display dl-path-display--filled"><span className="dl-path-display__label">浏览器默认下载位置</span></span>
        </div>
        <small className="dl-field-hint">不请求目录授权，也不会读取、列出或修改浏览器下载目录。当前仍是 mock，不会创建下载文件。</small>
      </div>
    </div>

    <div className="dl-form-command-row">
      <div className="dl-field dl-option-control dl-login-option">
        <select id="download-cookie-browser" aria-label="浏览器登录态（未接入）" aria-describedby="download-cookie-unavailable" value={taskCookieBrowser} disabled>
          <option value="none">登录态 / Cookie 未接入</option>
        </select>
        <small id="download-cookie-unavailable">不会读取 Cookie；请勿提供登录信息。</small>
      </div>
      <div className="dl-option-control dl-compatible-format">
        <label className="dl-checkbox-label"><input type="checkbox" checked={taskCompatibleFormat} onChange={(event) => onTaskCompatibleFormatChange(event.target.checked)} /><span>模拟格式参数：H.264 / MP4</span></label>
        <DownloadOptionHelp id="download-compatible-format-help" label="兼容格式说明">仅记录选项用于交互演示，不执行转码，也不代表编解码器或容器支持。</DownloadOptionHelp>
      </div>
      <div className="dl-form-actions">
        <button className="dl-btn dl-btn--primary" onClick={onSubmit} disabled={addingTask || !taskUrl.trim()}>{addingTask ? '添加模拟任务中...' : '添加模拟任务'}</button>
        <button className="dl-btn" onClick={onClose}>取消</button>
      </div>
    </div>
    {submitError && <div className="dl-form-error" role="alert">{submitError}</div>}
  </div>
}
