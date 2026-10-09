import type { ProjectionMessage } from './protocol'
import { MAX_MESSAGE_BYTES } from './protocol'
import * as directoryAdapter from '../real/fileWorkspace'

export function publishSnapshot(channel: BroadcastChannel | undefined, sender: string, target?: string) {
  if (!channel) return
  const snapshot = directoryAdapter.getFileWorkspaceSnapshot()
  const message: ProjectionMessage = { version: 1, type: 'snapshot', sender, ...(target ? { target } : {}), snapshot }
  if (JSON.stringify(message).length > MAX_MESSAGE_BYTES) throw new Error('目录 Workspace 消息超过本地预算。')
  channel.postMessage(message)
}

export async function handleListRequest(
  channel: BroadcastChannel | undefined,
  sender: string,
  requestSender: string,
  requestId: string,
  path: string | undefined,
) {
  if (!channel) return
  try {
    const listing = await directoryAdapter.listAuthorizedDirectory(path)
    const message: ProjectionMessage = { version: 1, type: 'list-result', sender, target: requestSender, id: requestId, listing }
    if (JSON.stringify(message).length > MAX_MESSAGE_BYTES) throw new Error('目录 Workspace 消息超过本地预算。')
    channel.postMessage(message)
  } catch (error) {
    const message: ProjectionMessage = {
      version: 1,
      type: 'list-result',
      sender,
      target: requestSender,
      id: requestId,
      error: error instanceof Error ? error.message : '目录投影读取失败。',
    }
    channel.postMessage(message)
  }
}
