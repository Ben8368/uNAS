import { test, expect } from './fixtures'

const authorizationUrl = new URL('https://accounts.feishu.cn/accounts/auth_login/oauth2/authorize')
authorizationUrl.search = new URLSearchParams({
  response_type: 'code',
  client_id: 'cli_aae6da4f6538dbed',
  redirect_uri: 'https://tec-iam.tec-do.com/portal/api/v1/login/feishu_oauth/gboh9uvzolazw62gmxojwaarust5qyvh',
  state: 'synthetic-legacy-login',
}).toString()

const cases = [
  { name: 'original identity authorization', reauthorize: false, allowed: true },
  { name: 'collapsed previously granted identity scope', reauthorize: true, allowed: true },
  { name: 'delayed permission reveal and enabled button', reauthorize: true, delayed: true, allowed: true },
  { name: 'additional permission', reauthorize: true, extraScope: true, allowed: false },
  { name: 'separate new permission section', reauthorize: true, newScopeBlock: true, allowed: false },
  { name: 'unknown permission markup', reauthorize: true, unknownMarkup: true, allowed: false },
  { name: 'different OAuth client', reauthorize: true, wrongClient: true, allowed: false },
  { name: 'different OAuth redirect', reauthorize: true, wrongRedirect: true, allowed: false },
] as const

for (const scenario of cases) {
  test(`Legacy login: ${scenario.name}`, async ({ extension }, testInfo) => {
    const options = scenario as typeof scenario & { delayed?: boolean; extraScope?: boolean; newScopeBlock?: boolean; unknownMarkup?: boolean; wrongClient?: boolean; wrongRedirect?: boolean }
    const authUrl = new URL(authorizationUrl)
    if (options.wrongClient) authUrl.searchParams.set('client_id', 'untrusted-client')
    if (options.wrongRedirect) authUrl.searchParams.set('redirect_uri', 'https://example.test/callback')
    // Everything is synthetic: no session, OAuth code, or enterprise API request.
    await extension.context.route('https://portal.unipass.top/**', route => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><body><button onclick='location.href=${JSON.stringify(authUrl.href)}'>钛动科技</button></body></html>`,
    }))
    await extension.context.route('https://accounts.feishu.cn/**', route => route.fulfill({
      contentType: 'text/html; charset=utf-8',
      // Install the synthetic handler before its markup: injectImmediately can
      // observe streamed DOM before a trailing script has been parsed in Chrome.
      body: `<!doctype html><html><head><script>
        function revealScopes() {
          const reveal = () => {
            document.getElementById('expand').textContent = '收起';
            const update = () => {
              document.getElementById('scopes').hidden = false;
              document.getElementById('authorize').disabled = false;
            };
            ${options.delayed ? 'setTimeout(update, 100)' : 'update()'};
          };
          if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal, { once: true });
          else reveal();
        }
      </script></head><body>
        <h1>钛动身份认证中心（Tec-IAM）</h1>
        ${scenario.reauthorize ? `
          <div class="scopeBlock-synthetic">
            <div><div class="scopeTitle-synthetic">请重新授权</div></div>
            <div class="scopeDesc-synthetic">以下权限此前已授予，重新授权后可继续使用</div>
          </div>
          <div class="${options.unknownMarkup ? 'unknown' : 'scopeBlock-synthetic'}">
            <div><span>此前已授予的权限</span><span id="expand" onclick="revealScopes()">展开</span></div>
            <div id="scopes" hidden><span class="scopeNameText-synthetic">获取用户身份标识</span>
              ${options.extraScope ? '<span class="scopeNameText-synthetic">读取通讯录</span>' : ''}
            </div>
          </div>
          ${options.newScopeBlock ? '<div class="scopeBlock-synthetic"><span>新增权限</span><span class="scopeNameText-synthetic">读取通讯录</span></div>' : ''}` : '<p>获取用户身份标识</p>'}
        <button id="authorize" ${options.delayed ? 'disabled' : ''} onclick="this.dataset.clicked=String(Number(this.dataset.clicked || 0)+1)">授权</button>
      </body></html>`,
    }))
    // Open through Playwright before starting the helper, so the first document
    // is intercepted too (an extension-created tab can miss that first route).
    const authPage = await extension.context.newPage()
    await authPage.goto('https://portal.unipass.top/login')
    await expect(authPage.getByRole('button', { name: '钛动科技' })).toBeVisible()
    const ui = await extension.context.newPage()
    await ui.goto(`chrome-extension://${extension.extensionId}/manage.html`)
    const result = await ui.evaluate(async () => chrome.runtime.sendMessage({ type: 'startUniPassLogin' }))
    expect(result.ok).toBe(true)
    const worker = extension.context.serviceWorkers()[0]
    await expect.poll(() => worker.evaluate(async () => (await chrome.tabs.query({})).some(tab => tab.url?.startsWith('https://accounts.feishu.cn/accounts/auth_login/oauth2/authorize')))).toBe(true)
    await expect(authPage).toHaveURL(authUrl.href)
    await expect(authPage.locator('#authorize')).toBeVisible()
    if (scenario.allowed) {
      await expect(authPage.locator('#authorize')).toHaveAttribute('data-clicked', '1')
      await expect.poll(() => worker.evaluate(async () => {
        const { pendingUniPassLogin } = await chrome.storage.session.get('pendingUniPassLogin')
        return pendingUniPassLogin?.phase
      })).toBe('complete')
    } else {
      // Wait beyond the bounded observer before asserting no authorization.
      await authPage.waitForTimeout(12_500)
      await expect(authPage.locator('#authorize')).not.toHaveAttribute('data-clicked', /./)
      expect(await worker.evaluate(async () => {
        const { pendingUniPassLogin } = await chrome.storage.session.get('pendingUniPassLogin')
        return pendingUniPassLogin?.phase
      })).not.toBe('complete')
    }
    await authPage.screenshot({ path: testInfo.outputPath('synthetic-authorization.png') })
    const settings = await ui.evaluate(async () => chrome.runtime.sendMessage({ type: 'getPluginVersionSettings' }))
    expect(settings.data).toMatchObject({ networkVersion: '5.3.6', storeBaselineVersion: '5.3.6', source: 'built-in' })
    const reused = await ui.evaluate(async () => chrome.runtime.sendMessage({ type: 'startUniPassLogin' }))
    expect(reused.data.tabId).toBe(result.data.tabId)
    await ui.evaluate(async () => chrome.runtime.sendMessage({ type: 'completeUniPassLogin' }))
    // The helper must preserve a login tab that it reused rather than created.
    expect(authPage.isClosed()).toBe(false)
    expect(await worker.evaluate(async () => (await chrome.storage.session.get('pendingUniPassLogin')).pendingUniPassLogin)).toBeUndefined()
    await authPage.close()
    expect(extension.errors).toEqual([])
  })
}
