import { useLayoutEffect, useState } from 'react'
import { Database, Download, FolderOpen, HardDrive, Server, Trash2 } from 'lucide-react'
import { ResizableAppSidebar } from 'unas-src/components/ResizableAppSidebar'
import { BrowserDownloadsPane } from './file-manager/BrowserDownloadsPane'
import { LocalDirectoryPane } from './file-manager/LocalDirectoryPane'
import { DavFilesPane } from './file-manager/DavFilesPane'
import { TempCachePane } from './file-manager/TempCachePane'
import { setFileManagerSection, type FileManagerSection } from './file-manager/navigation'

export { DirectoryPickerDialog } from 'unas-src/apps/file-manager/DirectoryPickerDialog'
export { FileManagerPane as MockFileManagerPane } from 'unas-src/apps/file-manager/FileManagerPane'

const sectionGroups = [
  {
    label: '位置',
    sections: [
      { id: 'local', label: '本地文件', icon: FolderOpen },
      { id: 'webdav', label: 'WebDAV', icon: Server },
      { id: 'downloads', label: '下载', icon: Download },
    ],
  },
  {
    label: '存储',
    sections: [
      { id: 'cache', label: '临时缓存', icon: Database },
      { id: 'trash', label: '回收站', icon: Trash2 },
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
      {section === 'local' && <LocalDirectoryPane />}
      {section === 'downloads' && <BrowserDownloadsPane />}
      {section === 'webdav' && <DavFilesPane />}
      {(section === 'cache' || section === 'trash') && <TempCachePane key={section} trash={section === 'trash'} />}
    </main>
  </div>
}
