import { Bee, PostageBatch } from '@ethersphere/bee-js';

export interface PostageLifetimeInfo {
  batchId: string;
  usable: boolean;
  label: string;
  depth: number;
  utilization: number;
  durationSeconds: number;
  durationDays: number;
  formattedLifetime: string;
}

/**
 * Retrieves dynamic postage batch information from the Bee node.
 * Calculates and formats the remaining lifetime/TTL.
 *
 * @param bee Bee client instance
 * @param batchId Swarm postage batch ID
 */
export async function getPostageBatchInfo(bee: Bee, batchId: string): Promise<PostageLifetimeInfo> {
  if (!batchId || batchId.trim() === '') {
    throw new Error('Postage Batch ID is missing or empty. Please set BEE_POSTAGE_BATCH_ID or pass --batch.');
  }

  const cleanBatchId = batchId.trim();
  const batch: PostageBatch = await bee.stamp.get(cleanBatchId);

  const durationSeconds = batch.duration ? batch.duration.toSeconds() : 0;
  const durationDays = batch.duration ? batch.duration.toDays() : 0;
  const formattedLifetime = formatDuration(durationSeconds);

  return {
    batchId: cleanBatchId,
    usable: batch.usable,
    label: batch.label,
    depth: batch.depth,
    utilization: batch.utilization,
    durationSeconds,
    durationDays,
    formattedLifetime,
  };
}

/**
 * Formats duration in seconds into a human-readable string (days, hours, minutes).
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return 'Expired (0 seconds remaining)';
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);

  return `${parts.join(', ')} (${seconds} seconds remaining)`;
}

/**
 * Prints the postage batch lifetime and health info to console.
 */
export function displayPostageLifetime(info: PostageLifetimeInfo): void {
  console.log('=== Swarm Postage Batch Lifetime ===');
  console.log(`Batch ID:           ${info.batchId}`);
  console.log(`Label:              ${info.label || '(unlabeled)'}`);
  console.log(`Usable:             ${info.usable ? 'Yes' : 'No'}`);
  console.log(`Depth:              ${info.depth}`);
  console.log(`Utilization:        ${info.utilization}`);
  console.log(`Remaining Lifetime: ${info.formattedLifetime}`);
  console.log('====================================\n');
}
