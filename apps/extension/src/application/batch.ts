export interface BatchFailure<T> { item: T; message: string }
export interface BatchResult<T> { succeeded: T[]; failed: BatchFailure<T>[]; partial: boolean }

/** Settle every command before refreshing; limit fan-out to four requests. */
export async function runBatch<T>(items: readonly T[], operation: (item: T) => Promise<unknown>): Promise<BatchResult<T>> {
  const succeeded: T[] = []
  const failed: BatchFailure<T>[] = []
  for (let offset = 0; offset < items.length; offset += 4) {
    const chunk = items.slice(offset, offset + 4)
    const outcomes = await Promise.allSettled(chunk.map((item) => Promise.resolve().then(async () => {
      const result = await operation(item)
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
        throw new Error('message' in result && typeof result.message === 'string' ? result.message : '操作未成功')
      }
      return result
    })))
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') succeeded.push(chunk[index])
      else failed.push({ item: chunk[index], message: outcome.reason instanceof Error ? outcome.reason.message : '操作失败' })
    })
  }
  return { succeeded, failed, partial: succeeded.length > 0 && failed.length > 0 }
}

export function describeBatch<T>(action: string, result: BatchResult<T>, label: (item: T) => string = String): string {
  const summary = `${action}：成功 ${result.succeeded.length} 项，失败 ${result.failed.length} 项。`
  return result.failed.length ? `${summary} 可重试失败项：${result.failed.map(({ item, message }) => `${label(item)}（${message}）`).join('；')}` : summary
}
