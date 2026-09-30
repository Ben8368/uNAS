import type { ReactNode } from 'react'
import { File, Folder } from 'lucide-react'
import { formatSize } from './utils'

export type ManagedFileRow = { id: string; name: string; size: number; directory?: boolean; detail: string }
export function ManagedFileTable({ rows, busy, empty, open, actions }: { rows: ManagedFileRow[]; busy: boolean; empty: string; open?: (id: string) => void; actions: (row: ManagedFileRow) => ReactNode }) {
  return <div className="fm-managed-table" aria-busy={busy}>
    <div className="fm-managed-table-head"><span>文件名</span><span>大小</span><span>时间</span><span>操作</span></div>
    <div className="fm-managed-list">
      {rows.map(row => <div className="fm-managed-row" key={row.id}>
        <div className="fm-managed-name">{row.directory ? <Folder aria-hidden="true" /> : <File aria-hidden="true" />}{row.directory && open ? <button type="button" className="fm-managed-open" title={row.name} disabled={busy} onClick={() => open(row.id)} aria-label={`打开文件夹 ${row.name}`}>{row.name}</button> : <span title={row.name}>{row.name}</span>}</div>
        <span>{row.directory ? '—' : formatSize(row.size)}</span><span className="fm-managed-time" title={row.detail}>{row.detail}</span>
        <div className="fm-managed-row-actions">{actions(row)}</div>
      </div>)}
      {rows.length === 0 && <p className="fm-managed-empty">{busy ? '正在读取文件…' : empty}</p>}
    </div>
  </div>
}
