import { useEffect } from 'react'

import { fetchFilebrowserDisks, getWorkspace } from 'unas-src/api'
import type { DiskInfo } from 'unas-src/apps/file-manager/types'
import { isPathOnDisk, resolveInitialPath } from 'unas-src/apps/file-manager/utils'
import { getErrorMessage } from 'unas-src/utils'

const DISK_REFRESH_MS = 30_000

type UseFileManagerInitOpts = {
  checkpoint: () => () => boolean
  navigate: (path: string) => Promise<unknown>
  setError: (message: string) => void
  setDisks: (disks: DiskInfo[]) => void
  setActiveDiskPath: (path: string) => void
  setLastLocalPath: (path: string) => void
}

export function useFileManagerInit({
  navigate,
  checkpoint,
  setError,
  setDisks,
  setActiveDiskPath,
  setLastLocalPath,
}: UseFileManagerInitOpts) {
  useEffect(() => {
    let alive = true
    const isCurrent = checkpoint()

    async function init() {
      try {
        const [diskData, workspace] = await Promise.all([fetchFilebrowserDisks(), getWorkspace()])
        if (!alive || !isCurrent()) return
        const nextDisks = diskData?.disks || []
        const workspacePath = workspace?.workspace?.project_root || workspace?.project_root || ''
        const initialPath = resolveInitialPath('', workspacePath, nextDisks)
        setDisks(nextDisks)
        if (initialPath) {
          setActiveDiskPath(nextDisks.find((disk) => isPathOnDisk(initialPath, disk.path))?.path || '')
          const data = await navigate(initialPath) as { path?: string } | null
          if (alive && data?.path) setLastLocalPath(data.path)
        }
      } catch (err: unknown) {
        if (alive && isCurrent()) setError(getErrorMessage(err) || '文件管理初始化失败')
      }
    }

    void init()
    return () => {
      alive = false
    }
  }, [navigate, checkpoint, setActiveDiskPath, setDisks, setError, setLastLocalPath])

  useEffect(() => {
    let alive = true

    async function refreshDisks() {
      try {
        const diskData = await fetchFilebrowserDisks()
        if (!alive) return
        setDisks(diskData?.disks || [])
      } catch {
        // 保留上次采样结果，避免侧边栏闪烁。
      }
    }

    const timer = window.setInterval(() => {
      void refreshDisks()
    }, DISK_REFRESH_MS)

    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [setDisks])
}
