import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { bootstrapApiClient, cancelTask, resetDemoScenario } from 'unas-src/api'
import { useDownloaderTaskData } from './useDownloaderTaskData'

function FirstRender() {
  const { mergedTasks } = useDownloaderTaskData()
  return <div>{mergedTasks.length ? mergedTasks.map(task => `${task.name}:${task.status}`).join(',') : 'empty'}</div>
}

beforeEach(() => { bootstrapApiClient(); resetDemoScenario('initial-state') })
describe('download first render', () => {
  it('renders current mock data without a transient empty list', () => {
    expect(renderToStaticMarkup(<FirstRender />)).toContain('模拟产品发布会回放:running')
  })
  it('uses current terminal records when reopening, not stale initial fixtures', async () => {
    await cancelTask('demo-download-001')
    expect(renderToStaticMarkup(<FirstRender />)).toContain('模拟产品发布会回放:cancelled')
  })
  it('only renders empty when the snapshot is genuinely empty', () => {
    resetDemoScenario('empty-state')
    expect(renderToStaticMarkup(<FirstRender />)).toBe('<div>empty</div>')
  })
})
