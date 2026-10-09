type DownloaderAddFormProps = {
  taskUrl: string
  addingTask: boolean
  submitError: string
  onTaskUrlChange: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}

export function DownloaderAddForm({
  taskUrl,
  addingTask,
  submitError,
  onTaskUrlChange,
  onSubmit,
  onClose,
}: DownloaderAddFormProps) {
  return <div className="dl-add-form" aria-label="新建下载任务">
    <p className="dl-field-hint">可直接下载的文件链接将交给 Chrome 下载；m3u8/mpd 分片合并暂未接入。</p>
    <div className="dl-form-section dl-form-section--source">
      <div className="dl-field dl-field--source">
        <div className="dl-field-heading"><label htmlFor="download-task-url">下载链接</label><small>每行一个 HTTPS URL；本机地址可用 HTTP</small></div>
        <textarea id="download-task-url" value={taskUrl} onChange={(event) => onTaskUrlChange(event.target.value)} placeholder={'https://example.com/video\nhttps://example.com/audio'} rows={4} style={{ resize: 'vertical', minHeight: '80px' }} />
        <small className="dl-field-hint">支持 HTTPS 直链文件（如 .exe、.zip、.mp4）；网页链接仍按演示任务记录。</small>
      </div>
    </div>

    <div className="dl-form-actions">
      <button className="dl-btn dl-btn--primary" onClick={onSubmit} disabled={addingTask || !taskUrl.trim()}>{addingTask ? '提交下载任务中...' : '提交下载任务'}</button>
      <button className="dl-btn" onClick={onClose}>取消</button>
    </div>
    {submitError && <div className="dl-form-error" role="alert">{submitError}</div>}
  </div>
}
