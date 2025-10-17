const Bull = require("bull");
const { getPool } = require("../db");
const logger = require("../lib/logger");
const config = require("../config");
const { assignWorker } = require("./txnWorker");
const { supportedChains } = require("../utils/supportedChains");

const queues = {}; // cache of all active queues

async function initializeWalletQueues() {
    let queueCount = 0;
    const pool = getPool();
    const result = await pool.query("SELECT wallet_id, public_key FROM wallets");

    for (const { wallet_id, public_key } of result.rows) {
        for (const chainId in supportedChains) {
            await createQueueForWallet(wallet_id, public_key, chainId);
            queueCount++;
        }

    }
    logger.info(`Initialized ${queueCount} wallet queues.`);

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
    const queue = new Bull(queueName, config.redisUrl, { settings: { stalledInterval: 0 } });

    // Attach worker to the queue
    assignWorker(queue, chainId);

    queues[key] = queue;
    logger.info(`Created queue ${queueName} for wallet_id=${wallet_id} (${chain.name})`);

    return queue;
}

function getQueue(wallet_id, chainId) {
    const key = `${wallet_id}-${chainId}`;
    const queue = queues[key];
    if (!queue) throw new Error(`Queue not found for wallet_id=${wallet_id}, chainId=${chainId}`);
    return queue;
}

module.exports = {
    initializeWalletQueues,
    createQueueForWallet,
    getQueue,
    queues,
};
