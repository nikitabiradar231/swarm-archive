# Eight hundred winters, one lapsed invoice

A publishing and recovery tool for Tsering's manuscript archive built using **Swarm Desktop**, **Bee**, **`@ethersphere/bee-js` v13**, and **Node.js/TypeScript**.

---

## 1. What the Project Does

This project provides a reliable decentralized publishing and recovery workflow for Tsering's manuscript archive:

```text
Archive files
    ↓
Bee upload (Swarm storage)
    ↓
Swarm reference (Content hash)
    ↓
Feed update (Signed single-owner chunk)
    ↓
Stable feed address (Owner address + Topic)
    ↓
Stranger receives owner + topic
    ↓
Recovery tool reads feed
    ↓
Gets latest archive reference
    ↓
Downloads archive from Swarm
```

- **Publisher (`npm run publish-archive`)**: Uploads an archive directory to Swarm storage, queries the live Bee network feed for the next feed index, updates the feed with the new Swarm reference, and writes the public feed owner address and topic to a tracked file (`config/feed.json`).
- **Recovery (`npm run recover`)**: Recovers the latest manuscript archive statelessly from Swarm using only public identifiers (`owner`, `topic`, and Bee endpoint URL).

---

## 2. Requirements

- **Node.js**: v18+ (tested on Node v24)
- **npm**: v9+
- **Bee Node / Swarm Desktop**: Running locally at `http://localhost:1633` (or accessible over network).
- **Funded Postage Batch**: A valid Swarm postage batch ID on your Bee node.

---

## 3. How to Run Bee / Swarm Desktop

1. Install and launch **Swarm Desktop** or run a local `bee` node.
2. Ensure the Bee API is enabled and accessible (by default at `http://localhost:1633`).
3. Verify node status:
   ```bash
   curl http://localhost:1633/health
   ```
4. Create and fund a postage batch via Swarm Desktop or Bee CLI.

---

## 4. How to Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure the environment variables in `.env`:

```env
# Bee Node Endpoint
BEE_URL=http://localhost:1633

# Swarm Postage Batch ID (must be funded)
BEE_POSTAGE_BATCH_ID=6f8a...

# Feed Owner Private Key (64 hex characters, keep secret!)
BEE_PRIVATE_KEY=0123456789abcdef...

# Feed Topic
FEED_TOPIC=manuscript-archive
```

---

## 5. How to Publish an Archive

1. Place manuscript files inside an archive folder (e.g. `./archive`).
2. Run the publisher:

```bash
npm run publish-archive -- --dir ./archive
```

You can also override options via CLI flags:

```bash
npm run publish-archive -- --dir ./archive --batch <POSTAGE_BATCH_ID> --key <PRIVATE_KEY> --endpoint http://localhost:1633 --topic manuscript-archive
```

During publishing, the tool will:
1. Query Bee for the postage batch's remaining duration/TTL and display it clearly.
2. Upload the archive directory contents to Swarm.
3. Query the live network feed from Bee to find the next feed index (handles first-run index `0`).
4. Sign and publish the new archive reference to the Swarm feed.
5. Save the public `owner` address and `topic` into `config/feed.json`.

---

## 6. How to Recover an Archive

A stranger can recover the manuscript archive without local publisher state:

```bash
npm run recover -- --owner <OWNER_ETH_ADDRESS> --topic <TOPIC>
```

Or omit flags to use the public tracked configuration in `config/feed.json`:

```bash
npm run recover
```

You can specify a custom output directory or Bee endpoint:

```bash
npm run recover -- --owner 0xfcad0b19bb29d4674531d6f115237e16afce377c --topic manuscript-archive --endpoint http://localhost:1633 --output ./my-recovered-archive
```

---

## 7. Public Feed Configuration Location

The public feed owner address and topic are stored in the tracked repository file:

`config/feed.json`

Example:

```json
{
  "owner": "fcad0b19bb29d4674531d6f115237e16afce377c",
  "topic": "manuscript-archive"
}
```

> [!IMPORTANT]
> `config/feed.json` contains **only public metadata** (`owner` address and `topic` string). It **NEVER** contains private keys or secrets.

---

## 8. Stable Feed Address as Permanent Pointer

In Swarm, content-addressed references change whenever manuscript files are modified or updated.

The **Swarm Feed** acts as a stable, permanent address (`owner` address + `topic`). Anyone with the owner address and topic can look up the latest update on the network to find the current archive reference, ensuring long-term continuity without changing public links.

---

## 9. Swarm Data Referencing Architecture

Archive files are uploaded separately to Swarm storage, returning a root Swarm content reference (64-character hash).

The feed stores only this Swarm reference pointer (along with a timestamp and update index). When a user recovers the archive, the recovery tool queries the feed for the reference pointer and downloads the actual manuscript files directly from Swarm.

---

## 10. Postage-Batch Lifetime and Availability

Data availability in Swarm depends on active funding:

- Every upload requires a **Postage Batch**.
- The program dynamically queries Bee for actual batch details and displays the calculated remaining TTL/lifetime.
- **Availability Warning**: When a postage batch expires (TTL reaches zero), node operators in the Swarm network may garbage-collect un-funded chunks. To keep Tsering's manuscript archive online, the publisher or maintainer must top up or renew the postage batch before expiration.

---

## 11. Security Instructions

> [!CAUTION]
> - **Never commit private keys, gift codes, or `.env` files** to Git repositories.
> - `BEE_PRIVATE_KEY` grants signing authority for feed updates and must remain strictly secret.
> - `.gitignore` is configured to exclude `.env`, `.env.*`, `dist/`, and local temporary output files.
> - Ensure all secrets are passed via environment variables or secure secret managers.
