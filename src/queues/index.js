const Bull = require("bull");
const IORedis = require("ioredis");
const { getPool } = require("../db");
const logger = require("../lib/logger");
const config = require("../config");
const { assignWorker } = require("./workers/evmWorker");
const { assignWorkerForKalp } = require("./workers/kalpWorker");
const { supportedChains } = require("../utils/supportedChains");

const queues = {}; // cache of all active queues

// Dedicated client solely for health probing — no queue work runs on it
const redisHealthClient = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
});
redisHealthClient.on("error", (err) => logger.error(`Redis health client error: ${err.message}`));

async function pingRedis() {
    const pong = await redisHealthClient.ping();
    if (pong !== "PONG") throw new Error("Unexpected Redis ping response");
}

// Bull creates 3 ioredis connections per queue (client, subscriber, bclient).
// reconnectOnError returning 2 = reconnect AND resend the failed command automatically.
// This handles Redis going read-only (replica/slave failover) mid-burst transparently.
// subscriber and bclient need maxRetriesPerRequest: null — they must retry indefinitely
// during reconnection or Bull's internal listeners crash and the queue stops processing.
function createBullRedisClient(type) {
    const client = new IORedis(config.redisUrl, {
        maxRetriesPerRequest: type === "client" ? 3 : null,
        enableReadyCheck: false,
        reconnectOnError(err) {
            // READONLY  → replica received a write; reconnect to master + resend.
            // UNBLOCKED → Docker restart / connection drop killed a blocking BRPOP; reconnect + re-issue.
            // return 2  = reconnect AND resend the failed command automatically.
            if (err.message.includes("READONLY") || err.message.includes("UNBLOCKED")) {
                logger.warn(`[Redis] Reconnecting after transient drop (${err.message.split(",")[0]})...`);
                return 2;
            }
            return false;
        },
        retryStrategy(times) {
            if (times > 20) {
                logger.error("[Redis] Max reconnect attempts reached — giving up.");
                return null;
            }
            return Math.min(times * 250, 5000);
        },
    });
    client.on("error", (err) => {
        if (err.message.includes("READONLY")) {
            logger.error("[Redis] Read-only mode active — queue writes blocked until reconnect completes.");
        } else {
            logger.error(`[Redis:${type}] ${err.message}`);
        }
    });
    return client;
}

async function initializeWalletQueues() {
    let queueCount = 0;
    try {
        const pool = getPool();
        const result = await pool.query("SELECT wallet_id, public_key FROM wallets");

        for (const { wallet_id, public_key } of result.rows) {
            if (public_key.startsWith("kalpWallet")) {
                await createKalpQueue(wallet_id, 1910);
                await createKalpQueue(wallet_id, 1906);
                await createKalpQueue(wallet_id, 1905);
                queueCount += 3;
                continue;
            }
            for (const chainId in supportedChains) {
                await createQueueForWallet(wallet_id, public_key, chainId);
                queueCount++;
            }
        }
        logger.info(`Initialized ${queueCount} wallet queues.`);
    } catch (err) {
        logger.error(`Failed to initialize wallet queues: ${err.message}`);
        throw err;
    }
}
// Dynamically create queue for new wallet
async function createQueueForWallet(wallet_id, public_key, chainId) {
    const key = `${wallet_id}-${chainId}`;

    if (queues[key]) {
        logger.info(`Queue already exists for wallet_id=${wallet_id} and chainId=${chainId}`);
        return queues[key];
    }
    const chain = supportedChains[chainId];

    const queueName = `txnQueue-${wallet_id}-${chainId}`;
    const queue = new Bull(queueName, { createClient: (type) => createBullRedisClient(type) });

    assignWorker(queue, chainId);

    queues[key] = queue;
    logger.info(`Created queue ${queueName} for wallet_id=${wallet_id} (${chain.name})`);

    return queue;
}

//create 1 queue for kalp loadnet
async function createKalpQueue(walletId, chainId) {
    const key = `${walletId}-${chainId}`;

    if (queues[key]) {
        logger.info(`Queue already exists for kalp wallet and chainId=${chainId}`);
        return queues[key];
    }

    const queueName = `txnQueue-${walletId}-${chainId}`;
    const queue = new Bull(queueName, { createClient: (type) => createBullRedisClient(type) });

    assignWorkerForKalp(queue, chainId);

    queues[key] = queue;
    logger.info(`Created queue ${queueName} for kalp wallet (${chainId})`);

    return queue;
}

function getQueue(wallet_id, chainId) {
    const key = `${wallet_id}-${chainId}`;
    const queue = queues[key];
    if (!queue) throw new Error(`Queue not found for wallet_id=${wallet_id}, chainId=${chainId}`);
    return queue;
}

async function closeAllQueues() {
    // allSettled so a single stuck queue doesn't block the rest from closing
    await Promise.allSettled(Object.values(queues).map((q) => q.close()));
    await redisHealthClient.quit();
    logger.info("All queues and Redis health client closed.");
}

module.exports = {
    initializeWalletQueues,
    createQueueForWallet,
    createKalpQueue,
    getQueue,
    closeAllQueues,
    pingRedis,
    queues,
};
