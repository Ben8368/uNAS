import { useLayoutEffect, useState } from 'react'
import { Database, Download, FolderOpen, HardDrive, Server, Trash2 } from 'lucide-react'
import { ResizableAppSidebar } from 'unas-src/shared/ui/ResizableAppSidebar'
import { BrowserDownloadsPane } from './BrowserDownloadsPane'
import { LocalDirectoryPane } from './LocalDirectoryPane'
import { DavFilesPane } from './DavFilesPane'
import { TempCachePane } from './TempCachePane'
import { setFileManagerSection, type FileManagerSection } from './navigation'

export { DirectoryPickerDialog } from 'unas-src/features/file-manager/DirectoryPickerDialog'
export { FileManagerPane as MockFileManagerPane } from 'unas-src/features/file-manager/FileManagerPane'

const sectionGroups = [
  {
    label: '位置',
    sections: [
      { id: 'webdav', label: 'WebDAV', icon: Server },
      { id: 'local', label: '本地文件', icon: FolderOpen },
      { id: 'downloads', label: '下载', icon: Download },
    ],
  },
  {
    label: '存储',
    sections: [
      { id: 'trash', label: '回收站', icon: Trash2 },
      { id: 'cache', label: '临时缓存', icon: Database },
    ],
  },
] as const

export function FileManagerApp() {
  const [section, setSection] = useState<FileManagerSection>('local')
  useLayoutEffect(() => setFileManagerSection(section), [section])
  return <div className="fm-workspace">
    <ResizableAppSidebar className="app-sidebar" storageKey="file-manager">
      <nav className="app-nav fm-workspace-nav" aria-label="文件位置">
        {sectionGroups.map(group => <div className="fm-nav-group" key={group.label}>
          <span className="fm-nav-group__label" aria-hidden="true">{group.label}</span>
          {group.sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`app-nav-item ${section === id ? 'app-nav-item--active' : ''}`} aria-pressed={section === id} onClick={() => setSection(id)}><Icon aria-hidden="true" /><span>{label}</span></button>)}
        </div>)}
      </nav>
      <div className="fm-workspace-sidebar-footer"><HardDrive aria-hidden="true" /><span>本地优先工作区</span></div>
    </ResizableAppSidebar>
    <main className="fm-workspace-main">
      <div hidden={section !== 'local'}><LocalDirectoryPane active={section === 'local'} /></div>
      {section === 'downloads' && <BrowserDownloadsPane />}
      <div hidden={section !== 'webdav'}><DavFilesPane /></div>
      {(section === 'cache' || section === 'trash') && <TempCachePane key={section} trash={section === 'trash'} />}
    </main>
  </div>
}
