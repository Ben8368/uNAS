import { spawn } from 'node:child_process'

const cliArgs = process.argv.slice(2)
const browser = cliArgs.includes('--browser=chrome') ? 'chrome' : undefined
const headed = cliArgs.includes('--headed')
const colorProfile = process.argv.find((value) => value.startsWith('--color-profile='))?.slice('--color-profile='.length)

const env = { ...process.env }
if (browser) env.UNAS_E2E_BROWSER = browser
if (headed) env.UNAS_E2E_HEADED = '1'
if (colorProfile) env.UNAS_E2E_COLOR_PROFILE = colorProfile

const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm'
const commandArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'pnpm.cmd exec playwright test']
  : ['exec', 'playwright', 'test']
const child = spawn(command, commandArgs, { env, stdio: 'inherit' })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
