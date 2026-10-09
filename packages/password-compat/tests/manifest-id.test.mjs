import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("internal test shell uses uNAS without an external store identity", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manifest.json", import.meta.url), "utf8"));

  assert.equal(manifest.name, "uNAS");
  assert.equal(manifest.action.default_title, "uNAS");
  assert.equal(manifest.key, undefined);
  assert.equal(manifest.update_url, undefined);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, "manifest 版本必须为三段整数");
  assert.deepEqual(manifest.host_permissions, [
    "https://portal.unipass.top/*",
    "https://accounts.feishu.cn/*",
    "https://jupiter.tec-do.com/*",
    "https://easylist-downloads.adblockplus.org/*",
  ]);
});
