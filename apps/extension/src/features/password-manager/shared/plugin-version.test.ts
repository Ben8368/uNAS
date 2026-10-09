import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGACY_PLUGIN_VERSION, parseRuntimeConfig } from '@unas/password-compat/legacy';

describe('Legacy plugin version baseline', () => {
  it('keeps the packaged request header baseline in sync with the enterprise protocol baseline', () => {
    const config = JSON.parse(readFileSync(new URL('../../../../public/runtime-config.json', import.meta.url), 'utf8'));
    expect(parseRuntimeConfig(config)?.networkPluginVersion).toBe(LEGACY_PLUGIN_VERSION);
  });
});
