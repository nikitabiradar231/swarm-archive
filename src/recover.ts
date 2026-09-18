import { createBeeClient } from './swarm.js';
import { parseTopic, readTrackedFeedConfig } from './feed.js';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import * as tar from 'tar';
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

/**
 * Downloads a tar archive from Bee endpoint for a given Swarm reference and extracts it.
 */
export async function downloadAndExtractArchive(
  beeUrl: string,
  reference: string,
  outputDir: string
): Promise<void> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const cleanUrl = beeUrl.replace(/\/+$/, '');
  const downloadUrl = `${cleanUrl}/bzz/${reference}/`;

  console.log(`Downloading archive tar stream from: ${downloadUrl}`);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(downloadUrl);
    const client = urlObj.protocol === 'https:' ? https : http;

    const req = client.get(
      downloadUrl,
      {
        headers: {
          Accept: 'application/x-tar',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          const extractStream = tar.x({
            C: outputDir,
          });

          res.pipe(extractStream);

          extractStream.on('finish', () => {
            console.log(`Archive extracted successfully to: ${path.resolve(outputDir)}`);
            resolve();
          });

          extractStream.on('error', (err) => {
            reject(new Error(`Failed to extract tar archive: ${err.message}`));
          });
        } else if (res.statusCode === 404 || res.statusCode === 400) {
          // Fallback if not a directory tar archive or manifest path
          console.log(`Tar endpoint returned HTTP ${res.statusCode}. Trying single file download fallback...`);
          resolve(downloadSingleFileFallback(beeUrl, reference, outputDir));
        } else {
          reject(new Error(`Bee node returned HTTP status ${res.statusCode} when downloading archive.`));
        }
      }
    );

    req.on('error', (err) => {
      reject(new Error(`HTTP request error when connecting to Bee node: ${err.message}`));
    });
  });
}

async function downloadSingleFileFallback(beeUrl: string, reference: string, outputDir: string): Promise<void> {
  const bee = createBeeClient(beeUrl);
  const fileData = await bee.file.download(reference);
  const fileName = fileData.name || `archive_${reference.slice(0, 8)}.data`;
  const filePath = path.join(outputDir, fileName);

  fs.writeFileSync(filePath, fileData.data.toUint8Array());
  console.log(`Downloaded single archive file to: ${filePath}`);
}

export async function recoverArchive(customOptions?: Record<string, string>) {
  const cliArgs = parseArgs(process.argv.slice(2));
  const options = { ...cliArgs, ...customOptions };

  let owner = options.owner;
  let topic = options.topic;

  // If owner or topic are not passed as CLI flags, read them from the public tracked config file config/feed.json
  if (!owner || !topic) {
    const configPath = path.resolve(process.cwd(), 'config', 'feed.json');
    if (fs.existsSync(configPath)) {
      const feedConfig = readTrackedFeedConfig(configPath);
      owner = owner || feedConfig.owner;
      topic = topic || feedConfig.topic;
    }
  }

  if (!owner || owner.trim() === '') {
    throw new Error(
      'Feed owner address is required for recovery. Provide --owner <OWNER> CLI argument or set config/feed.json.'
    );
  }

  if (!topic || topic.trim() === '') {
    throw new Error(
      'Feed topic is required for recovery. Provide --topic <TOPIC> CLI argument or set config/feed.json.'
    );
  }

  const beeUrl = options.endpoint || process.env.BEE_URL || 'http://localhost:1633';
  const outputDir = options.output || options.out || './recovered-archive';

  console.log('=== Recovering Manuscript Archive from Swarm Feed ===');
  console.log(`Bee Endpoint:   ${beeUrl}`);
  console.log(`Feed Owner:     ${owner}`);
  console.log(`Feed Topic:     ${topic}`);
  console.log(`Output Path:    ${path.resolve(outputDir)}\n`);

  const bee = createBeeClient(beeUrl);
  const topicObj = parseTopic(topic);

  // 1. Read feed from network to obtain latest archive reference
  console.log('Reading feed update from Swarm network...');
  const reader = bee.feed.makeReader(topicObj, owner);
  const feedResult = await reader.downloadReference();

  const archiveReference = feedResult.reference.toHex();
  console.log(`Latest Feed Index:    ${feedResult.feedIndex.toBigInt()}`);
  console.log(`Latest Archive Ref:   ${archiveReference}\n`);

  // 2. Download archive from Swarm using the retrieved reference
  console.log('Downloading archive from Swarm...');
  await downloadAndExtractArchive(beeUrl, archiveReference, outputDir);

  console.log('\n=================================================');
  console.log('Archive recovery completed successfully!');
  console.log(`Files recovered in: ${path.resolve(outputDir)}`);
  console.log('=================================================\n');

  return {
    archiveReference,
    outputDir: path.resolve(outputDir),
  };
}

if (process.argv[1] && process.argv[1].endsWith('recover.js')) {
  recoverArchive().catch((err) => {
    console.error('\nRecovery failed:', err.message || err);
    process.exit(1);
  });
}
