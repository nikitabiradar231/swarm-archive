import assert from 'node:assert';
import { test, describe } from 'node:test';
import fs from 'fs';
import path from 'path';
import { saveTrackedFeedConfig, readTrackedFeedConfig } from './feed.js';
import { formatDuration } from './postage.js';

describe('Integration & Workflow Verification', () => {
  test('should verify tracked feed config contains no private key secrets', () => {
    const configPath = path.resolve(process.cwd(), 'config', 'feed.json');
    if (fs.existsSync(configPath)) {
      const config = readTrackedFeedConfig(configPath);
      assert.strictEqual(typeof config.owner, 'string');
      assert.strictEqual(typeof config.topic, 'string');

      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.strictEqual(raw.privateKey, undefined);
      assert.strictEqual(raw.BEE_PRIVATE_KEY, undefined);
      assert.strictEqual(raw.secret, undefined);
    }
  });

  test('should verify postage lifetime format displays clear duration', () => {
    const infoText = formatDuration(86400 * 30);
    assert.strictEqual(infoText.includes('30 days'), true);
  });
});
