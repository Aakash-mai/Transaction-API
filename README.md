# Transaction API

A backend service that queues and submits blockchain transactions across multiple EVM-compatible networks and Kalp networks. Each wallet gets a dedicated queue per chain, ensuring ordered, non-blocking transaction processing with automatic retry and failover.

---

## Features

- **Multi-network support** — EVM testnets (Polygon Amoy, Ethereum Sepolia, Optimism Sepolia, Base Sepolia, BNB Testnet, Avalanche Fuji, Celo Sepolia) and Kalp networks (prod, stage, dev)
- **Per-wallet queues** — each wallet × chain pair gets its own Bull queue, preventing nonce conflicts across wallets
- **RPC fallback** — primary RPC from env, falls back to public endpoints automatically via ethers FallbackProvider
- **60s timeout guard** — transactions that time out are marked as `timeout` and not retried (may already be in-flight)
- **Redis persistence** — Bull job queue survives Redis restarts via AOF
- **Graceful shutdown** — SIGTERM/SIGINT drains in-flight jobs before exiting

---

## API Endpoints

### `POST /addWallet`
Register a backend wallet. Creates per-chain queues for the wallet immediately.

```json
// Request
{
  "publicKey": "0xYourWalletAddress",
  "privateKey": "0xYourPrivateKey"
}

// Response
{
  "success": true,
  "wallet": "0xYourWalletAddress",
  "walletId": 1
}
```

---

### `POST /sendTransaction`
Queue a contract function call. Returns a `queueId` to track the transaction.

```json
// Request
{
  "functionSignature": "function set(uint256 _x)",
  "args": [42],
  "contractAddress": "0xYourContractAddress",
  "chainId": 80002,
  "backendWallet": "0xYourWalletAddress"
}

// Response
{
  "success": true,
  "queueId": "550e8400-e29b-41d4-a716-446655440000",
  "jobId": 1
}
```

---

### `GET /transactionStatus/:queueId`
Poll the status of a queued transaction.

```json
// Response
{
  "success": true,
  "queueId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "sent",
  "txHash": "0xabc123..."
}
```

Possible statuses: `queued` → `sent` | `failed` | `timeout`

---

### `GET /health`
Returns liveness of Postgres and Redis connections.

```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected"
}
```

---

## Supported Chains

| Chain | Chain ID |
|---|---|
| Polygon Amoy | 80002 |
| Ethereum Sepolia | 11155111 |
| Optimism Sepolia | 11155420 |
| Base Sepolia | 84532 |
| BNB Testnet | 97 |
| Avalanche Fuji | 43113 |
| Celo Sepolia | 11142220 |
| Kalp Production | 1905 |
| Kalp Staging | 1906 |
| Kalp Dev | 1910 |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values.

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PORT` | HTTP server port (default: 4000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `AMOY_RPC_URL` | Optional — falls back to public RPC if not set |
| `FUJI_RPC_URL` | Optional — falls back to public RPC if not set |
| `OPSEPOLIA_RPC_URL` | Optional — falls back to public RPC if not set |
| `BNBTESTNET_RPC_URL` | Optional — falls back to public RPC if not set |
| `SEPOLIA_RPC_URL` | Optional — falls back to public RPC if not set |
| `CELO_SEPOLIA_RPC_URL` | Optional — falls back to public RPC if not set |
| `BASESEPOLIA_RPC_URL` | Optional — falls back to public RPC if not set |
| `PROD_KALP_PRIVATE_KEY` | Kalp production wallet private key (PEM) |
| `PROD_KALP_ENROLLMENT_ID` | Kalp production enrollment ID |
| `PROD_KALP_CERT` | Kalp production certificate (PEM) |
| `DEV_KALP_PRIVATE_KEY` | Kalp dev wallet private key (PEM) |
| `DEV_KALP_ENROLLMENT_ID` | Kalp dev enrollment ID |
| `DEV_KALP_CERT` | Kalp dev certificate (PEM) |
| `STAGE_KALP_PRIVATE_KEY` | Kalp staging wallet private key (PEM) |
| `STAGE_KALP_ENROLLMENT_ID` | Kalp staging enrollment ID |
| `STAGE_KALP_CERT` | Kalp staging certificate (PEM) |

---

## Setup

### Prerequisites
- Node.js v22+
- PostgreSQL (or connection string to a hosted instance)
- Redis 7+

---

### Option A — Docker (recommended)

Runs the app and Redis together with a single command. Postgres is external (cloud-hosted).

**1. Clone and configure**
```bash
git clone <repo-url>
cd transaction-api
cp .env.example .env
# Fill in DATABASE_URL and all credentials in .env
```

**2. Start**
```bash
docker compose up -d --build
```

**3. Check status**
```bash
docker compose ps
docker compose logs -f app
```

**4. Redeploy after a code change**
```bash
docker compose up -d --build app
```

**5. Stop**
```bash
docker compose down
```

> Redis data (Bull job queue) is persisted in a Docker named volume. It survives `docker compose down` and is only wiped with `docker compose down -v`.

---

### Option B — Local (PM2)

**1. Install dependencies**
```bash
npm install
```

**2. Configure environment**
```bash
cp .env.example .env
# Fill in .env — set REDIS_URL=redis://127.0.0.1:6379
```

**3. Start Redis (if not already running)**
```bash
docker run -d \
  --name redis-queue \
  --restart=always \
  -p 6379:6379 \
  -v redis-queue-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes --appendfsync everysec --save 60 100
```

**4. Start the app**
```bash
# Development (auto-reload on file change)
npm run dev

# Production via PM2
pm2 start src/server.js --name transaction-app
pm2 save
```

**5. PM2 useful commands**
```bash
pm2 logs transaction-app       # stream logs
pm2 restart transaction-app    # restart
pm2 stop transaction-app       # stop
pm2 status                     # view all processes
```

---

## Project Structure

```
src/
├── app.js                  # Express app (pure, no port binding)
├── server.js               # Entry point — startup, shutdown, OS signal handlers
├── config.js               # All env vars in one place
├── db/
│   ├── index.js            # Postgres connection pool
│   └── schema.js           # Table initialisation
├── queues/
│   ├── index.js            # Queue creation, Redis client factory
│   └── workers/
│       ├── evmWorker.js    # EVM transaction processor (ethers v6 + FallbackProvider)
│       └── kalpWorker.js   # Kalp transaction processor (kalp-wallet-ts)
├── routes/
│   ├── index.js            # Route aggregator
│   ├── wallets.js          # POST /addWallet
│   ├── sendTransaction.js  # POST /sendTransaction
│   ├── transactionStatus.js # GET /transactionStatus/:queueId
│   └── health.js           # GET /health
├── lib/
│   └── logger.js           # Winston logger (IST timezone, daily rotate)
└── utils/
    └── supportedChains.js  # Chain configs and Kalp network credentials
```
