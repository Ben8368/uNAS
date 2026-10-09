import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STORE_PLUGIN_VERSION, parseRuntimeConfig } from 'unipass-extension/legacy';

describe('Legacy plugin version baseline', () => {
  it('keeps the packaged request header baseline in sync with the store baseline', () => {
    const config = JSON.parse(readFileSync(new URL('../../../../public/runtime-config.json', import.meta.url), 'utf8'));
    expect(parseRuntimeConfig(config)?.networkPluginVersion).toBe(STORE_PLUGIN_VERSION);
  });
});
