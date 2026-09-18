import { Bee, Topic, PrivateKey, EthAddress, FeedIndex, BeeResponseError } from '@ethersphere/bee-js';
import fs from 'fs';
import path from 'path';

export interface FeedConfig {
  owner: string;
  topic: string;
}

export interface NextFeedIndexResult {
  nextIndex: FeedIndex;
  isFirstRun: boolean;
  currentIndex?: FeedIndex;
}

/**
 * Normalizes a topic input into a hex string or Topic object.
 * If topic is 64 hex characters, uses it as raw bytes/hex.
 * Otherwise hashes topic string using Topic.fromString().
 */
export function parseTopic(topicStr: string): Topic {
  const clean = topicStr.trim();
  if (/^[0-9a-fA-F]{64}$/.test(clean)) {
    return new Topic(clean);
  }
  return Topic.fromString(clean);
}

/**
 * Queries the live Bee network feed to determine the next feed index.
 * Network feed state is the single source of truth.
 *
 * Explicitly handles first-run (when feed has never been updated) by returning FeedIndex(0).
 *
 * @param bee Bee instance
 * @param owner Owner's EthAddress or hex string
 * @param topic Topic instance or hex string
 */
export async function getNextFeedIndexFromNetwork(
  bee: Bee,
  owner: string | EthAddress,
  topic: Topic | string
): Promise<NextFeedIndexResult> {
  try {
    const feedUpdate = await bee.feed.fetchLatestUpdate(topic, owner);

    let nextIndex: FeedIndex;
    if (feedUpdate.feedIndexNext) {
      nextIndex = feedUpdate.feedIndexNext;
    } else {
      nextIndex = feedUpdate.feedIndex.next();
    }

    return {
      nextIndex,
      isFirstRun: false,
      currentIndex: feedUpdate.feedIndex,
    };
  } catch (error: any) {
    // Handle first-run case when feed has never been updated on the network
    if (
      error instanceof BeeResponseError ||
      error?.status === 404 ||
      error?.code === 404 ||
      (error?.message && error.message.includes('not found'))
    ) {
      return {
        nextIndex: FeedIndex.fromBigInt(0n),
        isFirstRun: true,
      };
    }
    // Re-throw unexpected network/server errors
    throw error;
  }
}

/**
 * Publishes an archive reference to a Swarm feed using the next network index.
 */
export async function publishReferenceToFeed(
  bee: Bee,
  privateKey: PrivateKey | string,
  topic: Topic | string,
  postageBatchId: string,
  archiveReference: string
): Promise<{ owner: string; topicHex: string; feedIndexUsed: string }> {
  const pk = typeof privateKey === 'string' ? new PrivateKey(privateKey) : privateKey;
  const ownerAddress = pk.publicKey().address().toHex();

  // 1. Query network feed to get current next index from network (Source of Truth)
  const { nextIndex, isFirstRun } = await getNextFeedIndexFromNetwork(bee, ownerAddress, topic);

  console.log(`Feed network query complete:`);
  console.log(`  Feed owner:      ${ownerAddress}`);
  console.log(`  First run:       ${isFirstRun ? 'Yes (starting at index 0)' : 'No'}`);
  console.log(`  Next feed index: ${nextIndex.toBigInt()}`);

  // 2. Make feed writer and upload update at nextIndex
  const writer = bee.feed.makeWriter(topic, pk);
  await writer.upload(postageBatchId, archiveReference, { index: nextIndex });

  const topicHex = writer.topic.toHex();

  return {
    owner: ownerAddress,
    topicHex,
    feedIndexUsed: nextIndex.toBigInt().toString(),
  };
}

/**
 * Saves feed owner address and topic to the tracked config/feed.json file.
 * DOES NOT store private keys or secrets.
 */
export function saveTrackedFeedConfig(configPath: string, owner: string, topic: string): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data: FeedConfig = {
    owner,
    topic,
  };

  fs.writeFileSync(configPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Reads the tracked feed configuration from config/feed.json.
 */
export function readTrackedFeedConfig(configPath: string): FeedConfig {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Tracked feed config file not found at: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const data = JSON.parse(raw);

  if (typeof data.owner !== 'string' || typeof data.topic !== 'string') {
    throw new Error(`Invalid feed config in ${configPath}. Must contain "owner" and "topic" strings.`);
  }

  return {
    owner: data.owner,
    topic: data.topic,
  };
}
