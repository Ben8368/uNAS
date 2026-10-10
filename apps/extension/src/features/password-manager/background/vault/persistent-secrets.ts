import type { LocalUnlockMaterial } from './local-unlock';
import { openDeviceSecret, sealDeviceSecret, type DeviceSecretEnvelope } from '../../../../platform/crypto/deviceSecret';
export type PersistentSecretEnvelope = DeviceSecretEnvelope;
export const sealPersistentMaterial = (material: LocalUnlockMaterial) => sealDeviceSecret(material);
export async function openPersistentMaterial(envelope: unknown): Promise<LocalUnlockMaterial> {
  const item = await openDeviceSecret(envelope) as LocalUnlockMaterial;
  if (!item || typeof item.vaultKey !== 'string' || !item.vaultKey ||
    !(typeof item.connectionId === 'string' && item.connectionId || typeof item.username === 'string' && item.username && typeof item.appPassword === 'string' && item.appPassword)) throw new Error('持久化 WebDAV 连接材料格式无效');
  return item;
}
