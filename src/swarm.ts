import { Bee } from '@ethersphere/bee-js';
import dotenv from 'dotenv';

dotenv.config();

export const DEFAULT_BEE_URL = 'http://localhost:1633';

/**
 * Creates and initializes a Bee client instance.
 * @param url Optional custom Bee node URL endpoint. Defaults to BEE_URL env or http://localhost:1633.
 */
export function createBeeClient(url?: string): Bee {
  const beeUrl = url || process.env.BEE_URL || DEFAULT_BEE_URL;
  return new Bee(beeUrl);
}

/**
 * Checks connection health and readiness of the Bee node.
 * @param bee Bee instance
 */
export async function checkBeeConnection(bee: Bee): Promise<boolean> {
  try {
    const health = await bee.status.getHealth();
    return health.status === 'ok';
  } catch (error) {
    return false;
  }
}
