const Queue = require("bull");
const { ethers } = require("ethers");
const { getPool } = require("../db");
const config = require("../config");
const logger = require("../lib/logger");
const { txnQueue } = require("../queue");

// Process jobs from the queue
function assignWorker(queue) {
    queue.process(async (job) => {
        const {
            queueId,
            functionSignature,
            args,
            contractAddress,
            chainId,
            backendWalletPrivateKey
        } = job.data;
        if (!functionSignature || !contractAddress || !chainId || !backendWalletPrivateKey) {
            throw new Error("Missing required job data");
        }

        try {
            const pool = getPool();
            logger.info(`[${queue.name}]Processing job ${job.id} for queueId ${queueId}`);

            // Send transaction to blockchain
            const provider = new ethers.JsonRpcProvider(config.rpcUrl);
            const wallet = new ethers.Wallet(backendWalletPrivateKey, provider);

            // Parse function signature into ABI + contract
            const iface = new ethers.Interface([functionSignature]);
            const contract = new ethers.Contract(contractAddress, iface.fragments, wallet);

            // Send tx
            const txResponse = await contract[functionSignature](...args);
            logger.info(`Transaction sent: ${JSON.stringify(txResponse.hash)}`);

            // Update transaction status to 'sent' in DB
            await pool.query(
                `UPDATE transactions SET transaction_hash = $1, status = 'sent', updated_at = NOW() WHERE queue_id = $2`,
                [txResponse.hash, queueId]
            );

            return;

            // --- 4. Poll for receipt (max 2 mins) ---
            const start = Date.now();
            let receipt = null;
            while (Date.now() - start < 120000) {
                receipt = await provider.getTransactionReceipt(txResponse.hash);
                if (receipt) break;
                await new Promise((r) => setTimeout(r, 5000));
            }

            if (!receipt) {
                logger.error(`Tx ${txResponse.hash} timed out`);
                await pool.query(
                    `UPDATE transactions SET status=$1 WHERE queue_id=$2`,
                    ["errored", queueId]
                );
                return;
            }

            logger.info(`[${queue.name}] Transaction mined: ${txResponse.hash}`);
            if (receipt.status === 1) {
                await pool.query(
                    `UPDATE transactions SET status=$1 WHERE queue_id=$2`,
                    ["mined", queueId]
                );
            } else {
                logger.error(`[${queue.name}] Transaction reverted: ${txResponse.hash}`);
                await pool.query(
                    `UPDATE transactions SET status=$1 WHERE queue_id=$2`,
                    ["errored", queueId]
                );
            }


        } catch (error) {
            logger.error(`[${queue.name}] Error processing job ${job.id} for queueId ${queueId}:`, error.message || error);
            // Update transaction status to 'failed' in DB
            const pool = getPool();
            await pool.query(
                `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE queue_id = $1`,
                [queueId]
            );
            throw error; // Let Bull handle retries
        }
    });
    queue.on("completed", (job) =>
        logger.info(`[${queue.name}]  Job ${job.id} completed for queueId=${job.data.queueId}`)
    );

    queue.on("failed", (job, err) =>
        logger.error(`[${queue.name}] Job ${job.id} failed for queueId=${job.data.queueId}`, err)
    );
}
module.exports = { assignWorker };
