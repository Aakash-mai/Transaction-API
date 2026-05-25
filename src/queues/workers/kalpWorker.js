const { submitTransaction } = require("kalp-wallet-ts");
const { getPool } = require("../../db");
const logger = require("../../lib/logger");
const { kalpSupportedNetworks } = require("../../utils/supportedChains");

// Credentials and URLs come from kalpSupportedNetworks — no config imports needed here
async function writeTxToKalpChain(network, contractAddress, functionSignature, args) {
    const txHash = await submitTransaction(
        network.networkName,
        network.networkUrl,
        network.enrollmentId,
        network.privateKey,
        network.cert,
        network.networkName, // channelName = networkName on Kalp
        contractAddress,     // chainCodeName
        functionSignature,   // transactionName
        args                 // transactionParams
    );
    logger.info(`Kalp transaction sent: ${txHash}`);
    return txHash;
}

function assignWorkerForKalp(queue, chainId) {
    const network = kalpSupportedNetworks[chainId];
    if (!network) {
        logger.error(`Unsupported Kalp chainId=${chainId} for queue ${queue.name}`);
        return;
    }

    queue.process(1, async (job) => {
        // backendWalletPrivateKey is not used by Kalp — credentials come from kalpSupportedNetworks
        const { queueId, functionSignature, args, contractAddress, chainId } = job.data;

        if (!functionSignature || !contractAddress || !chainId) {
            throw new Error("Missing required job data");
        }

        // Hoisted outside try so catch can access them
        const pool = getPool();
        let timedOut = false;
        let txPromise = null;

        try {
            logger.info(`[${queue.name}] Processing job ${job.id} for queueId ${queueId}`);

            // On timeout we do NOT throw/retry — tx may already be in flight on the gateway.
            // The background txPromise self-heals the DB if the gateway responds late.
            txPromise = writeTxToKalpChain(network, contractAddress, functionSignature, args);

            const txHash = await Promise.race([
                txPromise,
                new Promise((_, reject) =>
                    setTimeout(() => {
                        timedOut = true;
                        reject(new Error("TIMEOUT"));
                    }, 60000)
                ),
            ]);

            await pool.query(
                `UPDATE transactions SET transaction_hash = $1, status = 'sent', updated_at = NOW() WHERE queue_id = $2`,
                [txHash, queueId]
            );

        } catch (error) {
            if (timedOut) {
                // Ambiguous — tx may already be in flight. Mark as timeout, do NOT retry.
                logger.error(`[${queue.name}] Job ${job.id} timed out for queueId ${queueId} — tx may be in flight, NOT retrying.`);
                try {
                    await pool.query(
                        `UPDATE transactions SET status = 'timeout', updated_at = NOW() WHERE queue_id = $1`,
                        [queueId]
                    );
                } catch (dbErr) {
                    logger.error(`[${queue.name}] Failed to mark timeout for queueId ${queueId}: ${dbErr.message}`);
                }
                // If the gateway responds late, self-heal the DB record
                txPromise.then(async (hash) => {
                    logger.info(`[${queue.name}] Late response for queueId ${queueId}: ${hash} — updating to sent.`);
                    try {
                        await getPool().query(
                            `UPDATE transactions SET transaction_hash = $1, status = 'sent', updated_at = NOW() WHERE queue_id = $2`,
                            [hash, queueId]
                        );
                    } catch (dbErr) {
                        logger.error(`[${queue.name}] Failed to update late-resolved tx for queueId ${queueId}: ${dbErr.message}`);
                    }
                }).catch(() => {
                    // Gateway eventually failed too — status stays 'timeout'
                });
                return; // Do NOT throw — Bull must not retry a potentially in-flight tx
            }

            // Hard failure — kalp-wallet-ts throws strings, not Error objects, so use String()
            logger.error(`[${queue.name}] Job ${job.id} failed for queueId ${queueId}: ${String(error)}`);
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
        logger.error(`[${queue.name}] Job ${job.id} failed for queueId=${job.data.queueId}: ${String(err)}`)
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

module.exports = { assignWorkerForKalp };
