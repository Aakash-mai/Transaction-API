const Bull = require("bull");
const { getPool } = require("../db");
const logger = require("../lib/logger");
const config = require("../config");
const { assignWorker } = require("./txnWorker");

const queues = {}; // cache of all active queues

async function initializeWalletQueues() {
    const pool = getPool();
    const result = await pool.query("SELECT wallet_id, public_key FROM wallets");

    for (const { wallet_id, public_key } of result.rows) {
        await createQueueForWallet(wallet_id, public_key);
    }

    logger.info(`Initialized ${result.rows.length} wallet queues.`);
}

// Dynamically create queue for new wallet
async function createQueueForWallet(wallet_id, public_key) {
    if (queues[wallet_id]) {
        logger.info(`Queue for wallet_id=${wallet_id} already exists.`);
        return queues[wallet_id];
    }

    const queueName = `txnQueue-${wallet_id}`;
    const queue = new Bull(queueName, config.redisUrl, {
        settings: { stalledInterval: 0 },
    });
    // Attach worker to the queue
    assignWorker(queue);
    queues[wallet_id] = queue;
    logger.info(`Created queue ${queueName} for wallet ${public_key}`);

    return queue;
}

function getQueueByWalletId(walletId) {
    const queue = queues[walletId];
    if (!queue) throw new Error(`Queue for wallet_id=${walletId} not found`);
    return queue;
}

module.exports = {
    initializeWalletQueues,
    createQueueForWallet,
    getQueueByWalletId,
    queues,
};
