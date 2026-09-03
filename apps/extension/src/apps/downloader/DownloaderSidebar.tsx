import { CATEGORY_MAP } from 'unas-src/apps/downloader/constants'
import { AiIcon, CategoryIcon } from 'unas-src/apps/downloader/icons'
import type { CategoryKey, TaskStats } from 'unas-src/apps/downloader/types'
import { ResizableAppSidebar } from 'unas-src/components/ResizableAppSidebar'

type DownloaderSidebarProps = {
  selectedCategory: CategoryKey
  stats: TaskStats
  onSelectCategory: (category: CategoryKey) => void
  miniAiOpen: boolean
  onToggleMiniAi: () => void
}

export function DownloaderSidebar({
  selectedCategory,
  stats,
  onSelectCategory,
  miniAiOpen,
  onToggleMiniAi,
}: DownloaderSidebarProps) {
  return (
    <ResizableAppSidebar className="dl-sidebar" storageKey="downloader">
      <nav className="dl-nav">
        {Object.entries(CATEGORY_MAP).map(([key, category]) => (
          <button
            key={key}
            className={`dl-nav-item ${selectedCategory === key ? 'dl-nav-item--active' : ''}`}
            onClick={() => onSelectCategory(key as CategoryKey)}
          >
            <CategoryIcon name={category.icon} />
            <span>{category.label}</span>
            <small>({stats[category.key]})</small>
          </button>
        ))}
      </nav>
      <div className="dl-sidebar-bottom">
        <button
          type="button"
          className={`dl-nav-item ${miniAiOpen ? 'dl-nav-item--active' : ''}`}
          aria-pressed={miniAiOpen}
          onClick={onToggleMiniAi}
        >
          <AiIcon />
          <span>AI</span>
        </button>
      </div>
    </ResizableAppSidebar>
  )
}
