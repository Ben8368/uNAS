import { extensionApi, sendExtensionMessage } from './extensionPlatform'

export type PasswordManagerProfile = { id: string; name?: string }

export async function readPasswordManagerProfiles(): Promise<PasswordManagerProfile[]> {
  const response = await sendExtensionMessage({ type: 'listVaultProfiles' }) as { ok?: boolean; data?: unknown; error?: string }
  if (!response?.ok) throw new Error(response?.error || '无法读取密码库状态。')
  if (!Array.isArray(response.data)) return []
  return response.data.filter((profile): profile is PasswordManagerProfile => Boolean(profile && typeof profile === 'object'
    && typeof (profile as { id?: unknown }).id === 'string'))
}

export async function openPasswordManager(): Promise<void> {
  if (!extensionApi()?.runtime?.id) throw new Error('密码管家仅在已安装的 uNAS 扩展中可用。')
  const response = await sendExtensionMessage({ kind: 'password-manager.open' }) as { ok?: boolean; error?: string }
  if (!response?.ok) throw new Error(response?.error || '无法打开密码管家管理页。')
}
