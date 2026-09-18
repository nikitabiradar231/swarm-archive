import assert from 'node:assert';
import { test, describe } from 'node:test';
import { parseTopic, getNextFeedIndexFromNetwork, saveTrackedFeedConfig, readTrackedFeedConfig } from './feed.js';
import { formatDuration } from './postage.js';
import { Topic, FeedIndex, BeeResponseError } from '@ethersphere/bee-js';
import fs from 'fs';
import path from 'path';

describe('Eight hundred winters - Feed & Postage Unit Tests', () => {
  describe('parseTopic()', () => {
    test('should parse 64-char hex string topic directly', () => {
      const hexTopic = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const topic = parseTopic(hexTopic);
      assert.strictEqual(topic.toHex(), hexTopic.toLowerCase());
    });

    test('should hash general string topic into a 32-byte Topic', () => {
      const topicStr = 'manuscript-archive';
      const topic = parseTopic(topicStr);
      assert.strictEqual(typeof topic.toHex(), 'string');
      assert.strictEqual(topic.toHex().length, 64);
    });
  });

  describe('getNextFeedIndexFromNetwork() First-Run & Index Logic', () => {
    test('should return index 0 (first-run) when Bee throws 404 or BeeResponseError for uninitialized feed', async () => {
      const mockBee: any = {
        feed: {
          fetchLatestUpdate: async () => {
            const err = new Error('Feed update not found') as any;
            err.status = 404;
            throw err;
          },
        },
      };

      const owner = '0x1234567890123456789012345678901234567890';
      const topic = parseTopic('test-topic');

      const result = await getNextFeedIndexFromNetwork(mockBee, owner, topic);
      assert.strictEqual(result.isFirstRun, true);
      assert.strictEqual(result.nextIndex.toBigInt(), 0n);
    });

    test('should return next index when feed update exists on network', async () => {
      const mockBee: any = {
        feed: {
          fetchLatestUpdate: async () => {
            return {
              feedIndex: FeedIndex.fromBigInt(3n),
              feedIndexNext: FeedIndex.fromBigInt(4n),
              payload: new Uint8Array(),
            };
          },
        },
      };

      const owner = '0x1234567890123456789012345678901234567890';
      const topic = parseTopic('test-topic');

      const result = await getNextFeedIndexFromNetwork(mockBee, owner, topic);
      assert.strictEqual(result.isFirstRun, false);
      assert.strictEqual(result.nextIndex.toBigInt(), 4n);
    });
  });

  describe('formatDuration() Postage Lifetime Formatting', () => {
    test('should format 0 or negative seconds as Expired', () => {
      assert.match(formatDuration(0), /Expired/);
      assert.match(formatDuration(-100), /Expired/);
    });

    test('should format seconds into days, hours, and minutes', () => {
      const secondsInYear = 365 * 86400 + 12 * 3600 + 30 * 60;
      const formatted = formatDuration(secondsInYear);
      assert.match(formatted, /365 days/);
      assert.match(formatted, /12 hours/);
      assert.match(formatted, /30 minutes/);
    });
  });

  describe('saveTrackedFeedConfig() and readTrackedFeedConfig()', () => {
    test('should write and read tracked feed config without secrets', () => {
      const testConfigDir = path.resolve(process.cwd(), 'scratch', 'test-config');
      const testConfigFile = path.join(testConfigDir, 'feed.json');

      const ownerAddress = 'fcad0b19bb29d4674531d6f115237e16afce377c';
      const topicName = 'tsering-manuscript-v1';

      saveTrackedFeedConfig(testConfigFile, ownerAddress, topicName);

      const loaded = readTrackedFeedConfig(testConfigFile);
      assert.strictEqual(loaded.owner, ownerAddress);
      assert.strictEqual(loaded.topic, topicName);

      // Verify JSON file content has no extra keys like private keys
      const rawContent = JSON.parse(fs.readFileSync(testConfigFile, 'utf8'));
      assert.deepStrictEqual(Object.keys(rawContent).sort(), ['owner', 'topic']);

      // Cleanup
      if (fs.existsSync(testConfigFile)) fs.unlinkSync(testConfigFile);
      if (fs.existsSync(testConfigDir)) fs.rmdirSync(testConfigDir);
    });
  });
});
