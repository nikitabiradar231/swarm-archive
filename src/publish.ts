import { createBeeClient, checkBeeConnection } from './swarm.js';
import { getPostageBatchInfo, displayPostageLifetime } from './postage.js';
import { parseTopic, publishReferenceToFeed, saveTrackedFeedConfig } from './feed.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function parseArgs(args: string[]) {
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      options[key] = val;
      if (val !== 'true') i++;
    }
  }
  return options;
}

export async function publishArchive(archiveDir?: string, customOptions?: Record<string, string>) {
  const cliArgs = parseArgs(process.argv.slice(2));
  const options = { ...cliArgs, ...customOptions };

  const targetDir = archiveDir || options.dir || options.d || './archive';
  const beeUrl = options.endpoint || process.env.BEE_URL || 'http://localhost:1633';
  const batchId = options.batch || process.env.BEE_POSTAGE_BATCH_ID;
  const privateKeyHex = options.key || process.env.BEE_PRIVATE_KEY;
  const topicName = options.topic || process.env.FEED_TOPIC || 'manuscript-archive';

  console.log('=== Publishing Archive to Swarm ===');
  console.log(`Bee Endpoint:   ${beeUrl}`);
  console.log(`Archive Dir:    ${path.resolve(targetDir)}`);
  console.log(`Topic:          ${topicName}\n`);

  if (!privateKeyHex) {
    throw new Error(
      'BEE_PRIVATE_KEY environment variable or --key argument is missing. Please provide publisher private key.'
    );
  }

  if (!batchId) {
    throw new Error(
      'BEE_POSTAGE_BATCH_ID environment variable or --batch argument is missing. Please provide a funded postage batch ID.'
    );
  }

  if (!fs.existsSync(targetDir)) {
    throw new Error(`Archive directory does not exist at path: ${path.resolve(targetDir)}`);
  }

  const stat = fs.statSync(targetDir);
  if (!stat.isDirectory()) {
    throw new Error(`Specified path is not a directory: ${path.resolve(targetDir)}`);
  }

  const bee = createBeeClient(beeUrl);

  const isConnected = await checkBeeConnection(bee);
  if (!isConnected) {
    console.warn(`Warning: Could not verify connection health at ${beeUrl}. Proceeding with operation...`);
  }

  // 1. Query Bee for actual postage batch TTL and display remaining lifetime
  console.log('Fetching postage batch status...');
  const postageInfo = await getPostageBatchInfo(bee, batchId);
  displayPostageLifetime(postageInfo);

  if (!postageInfo.usable) {
    throw new Error(`Postage batch ${batchId} is marked as unusable by the Bee node.`);
  }

  // 2. Upload archive directory contents to Swarm
  console.log(`Uploading archive directory "${targetDir}" to Swarm...`);
  const topicObj = parseTopic(topicName);
  const uploadResult = await bee.collection.uploadFromDirectory(batchId, targetDir);

  const archiveReference = uploadResult.reference.toHex();
  console.log(`\nArchive uploaded to Swarm successfully!`);
  console.log(`Swarm Archive Reference: ${archiveReference}\n`);

  // 3. Query network feed state and publish reference to feed
  console.log('Querying network feed and updating Swarm feed...');
  const feedResult = await publishReferenceToFeed(
    bee,
    privateKeyHex,
    topicObj,
    batchId,
    archiveReference
  );

  console.log(`\nFeed updated successfully!`);
  console.log(`  Feed Owner:  ${feedResult.owner}`);
  console.log(`  Feed Topic:  ${topicName}`);
  console.log(`  Feed Index:  ${feedResult.feedIndexUsed}`);

  // 4. Save public owner address & topic into tracked config/feed.json
  const configPath = path.resolve(process.cwd(), 'config', 'feed.json');
  saveTrackedFeedConfig(configPath, feedResult.owner, topicName);
  console.log(`\nTracked feed config updated at: ${configPath}`);
  console.log(`  Stranger can copy feed owner (${feedResult.owner}) and topic (${topicName}) to recover archive.`);
  console.log('===================================\n');

  return {
    archiveReference,
    owner: feedResult.owner,
    topic: topicName,
    feedIndexUsed: feedResult.feedIndexUsed,
  };
}

if (process.argv[1] && process.argv[1].endsWith('publish.js')) {
  publishArchive().catch((err) => {
    console.error('\nPublish failed:', err.message || err);
    process.exit(1);
  });
}
