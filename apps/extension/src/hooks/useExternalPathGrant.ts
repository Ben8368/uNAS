import { useCallback, useState } from 'react'
import { requestReadGrant, requestWriteGrant } from 'unas-src/api'

export function useExternalReadGrant(fallbackPath: string) {
  const [grantId, setGrantId] = useState<string | null>(null)
  const [displayPath, setDisplayPath] = useState(fallbackPath)
  const [message, setMessage] = useState('')
  const importExternal = useCallback(async () => {
    try {
      const result = await requestReadGrant()
      if (result.status !== 'granted') { setMessage(result.reason); return }
      setGrantId(result.grant.id)
      setDisplayPath(`[模拟文件] ${result.grant.displayName}`)
      setMessage('模拟授权完成；未打开文件选择器，未读取真实用户文件。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '模拟授权失败') }
  }, [])
  const clearGrant = useCallback(() => {
    setGrantId(null)
    setDisplayPath(fallbackPath)
    setMessage('')
  }, [fallbackPath])
  return { grantId, displayPath, setDisplayPath, importExternal, clearGrant, message }
}

export function useExternalWriteGrant() {
  const [grantId, setGrantId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const selectOutputPath = useCallback(async (defaultPath?: string) => {
    try {
      const result = await requestWriteGrant(defaultPath)
      if (result.status !== 'granted') { setMessage(result.reason); return }
      setGrantId(result.grant.id)
      setMessage('已选择模拟输出位置；不会写入或生成真实文件。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '模拟授权失败') }
  }, [])
  const clearGrant = useCallback(() => { setGrantId(null); setMessage('') }, [])
  return { grantId, selectOutputPath, clearGrant, message }
}
