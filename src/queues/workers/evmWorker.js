const { ethers } = require("ethers");
const { getPool } = require("../../db");
const logger = require("../../lib/logger");
const { supportedChains } = require("../../utils/supportedChains");

// One provider per chainId shared across all wallets on that chain.
// staticNetwork skips ethers' auto-detection call — eliminates the retry spam on startup.
// Multiple URLs → FallbackProvider: tries primary first; if it stalls >2s, races the next one.
const providerCache = {};
function getProvider(chainId, rpcUrls) {
    if (!providerCache[chainId]) {
        const network = ethers.Network.from(Number(chainId));
        if (rpcUrls.length === 1) {
            providerCache[chainId] = new ethers.JsonRpcProvider(rpcUrls[0], network, { staticNetwork: true });
        } else {
            const inputs = rpcUrls.map((url, i) => ({
                provider: new ethers.JsonRpcProvider(url, network, { staticNetwork: true }),
                priority: i + 1,    // 1 = highest; primary is always tried first
                stallTimeout: 2000, // ms before racing next provider
                weight: 1,
            }));
            providerCache[chainId] = new ethers.FallbackProvider(inputs, network, { quorum: 1 });
        }
    }
    return providerCache[chainId];
}

function assignWorker(queue, chainId) {
    const chain = supportedChains[chainId];
    if (!chain) {
        logger.error(`Unsupported chainId=${chainId} for queue ${queue.name}`);
        return;
    }

    const provider = getProvider(chainId, chain.rpcUrls);

    queue.process(1, async (job) => {
        const { queueId, functionSignature, args, contractAddress, chainId, backendWalletPrivateKey } = job.data;

        if (!functionSignature || !contractAddress || !chainId || !backendWalletPrivateKey) {
            throw new Error("Missing required job data");
        }

        const pool = getPool();
        let timedOut = false;
        let txPromise = null;

        try {
            logger.info(`[${queue.name}] Processing job ${job.id} for queueId ${queueId}`);

            const wallet = new ethers.Wallet(backendWalletPrivateKey, provider);
            const iface = new ethers.Interface([functionSignature]);
            const contract = new ethers.Contract(contractAddress, iface.fragments, wallet);

            // On timeout we do NOT throw/retry — tx may already be in the mempool.
            // The background txPromise self-heals the DB if the RPC responds late.
            txPromise = contract[functionSignature](...args);

            const txResponse = await Promise.race([
                txPromise,
                new Promise((_, reject) =>
                    setTimeout(() => {
                        timedOut = true;
                        reject(new Error("TIMEOUT"));
                    }, 60000)
                ),
            ]);

            logger.info(`[${queue.name}] Transaction sent: ${txResponse.hash}`);
            await pool.query(
                `UPDATE transactions SET transaction_hash = $1, status = 'sent', updated_at = NOW() WHERE queue_id = $2`,
                [txResponse.hash, queueId]
            );

        } catch (error) {
            if (timedOut) {
                // Ambiguous — tx may already be in the mempool. Mark as timeout, do NOT retry.
                logger.error(`[${queue.name}] Job ${job.id} timed out for queueId ${queueId} — tx may be in mempool, NOT retrying.`);
                try {
                    await pool.query(
                        `UPDATE transactions SET status = 'timeout', updated_at = NOW() WHERE queue_id = $1`,
                        [queueId]
                    );
                } catch (dbErr) {
                    logger.error(`[${queue.name}] Failed to mark timeout for queueId ${queueId}: ${dbErr.message}`);
                }
                // If the RPC responds late, self-heal the DB record
                txPromise.then(async (resp) => {
                    logger.info(`[${queue.name}] Late response for queueId ${queueId}: ${resp.hash} — updating to sent.`);
                    try {
                        await getPool().query(
                            `UPDATE transactions SET transaction_hash = $1, status = 'sent', updated_at = NOW() WHERE queue_id = $2`,
                            [resp.hash, queueId]
                        );
                    } catch (dbErr) {
                        logger.error(`[${queue.name}] Failed to update late-resolved tx for queueId ${queueId}: ${dbErr.message}`);
                    }
                }).catch(() => {
                    // RPC eventually failed too — status stays 'timeout'
                });
                return; // Do NOT throw — Bull must not retry a potentially in-flight tx
            }

            // Hard failure (connection refused, bad nonce, revert) — safe to retry
            // ethers v6 errors surface detail in shortMessage, not message
            logger.error(`[${queue.name}] Job ${job.id} failed for queueId ${queueId}: ${error.shortMessage || error.message || String(error)}`);
            try {
                await pool.query(
                    `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE queue_id = $1`,
                    [queueId]
                );
            } catch (dbErr) {
                logger.error(`[${queue.name}] Failed to update failed status for queueId ${queueId}: ${dbErr.message}`);
            }
            throw error; // Let Bull apply exponential backoff retries
        }
    });

    queue.on("completed", (job) =>
        logger.info(`[${queue.name}] Job ${job.id} completed for queueId=${job.data.queueId}`)
    );
    queue.on("failed", (job, err) =>
        logger.error(`[${queue.name}] Job ${job.id} failed for queueId=${job.data.queueId}: ${err.shortMessage || err.message || String(err)}`)
    );
    queue.on("error", (err) => {
        // UNBLOCKED / READONLY are transient Redis failover/restart events — warn, not error
        if (err.message.includes("UNBLOCKED") || err.message.includes("READONLY")) {
            logger.warn(`[${queue.name}] Transient Redis disconnect: ${err.message.split(",")[0]}`);
        } else {
            logger.error(`[${queue.name}] Queue error: ${err.message}`);
        }
    });
}

module.exports = { assignWorker };
