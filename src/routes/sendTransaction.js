const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { getPool } = require("../db");
const logger = require("../lib/logger");
const { getQueue } = require("../queues/index");

const router = express.Router();

router.post("/", async (req, res) => {
    let pool;

    try {
        pool = getPool();

        const { functionSignature, args, contractAddress, chainId, backendWallet } = req.body;
        if (!functionSignature || !contractAddress || !chainId || !backendWallet) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }

        logger.info(`Received transaction request: ${functionSignature} on ${contractAddress} for chain ${chainId}`);

        await pool.query("BEGIN");

        const walletRes = await pool.query(
            `SELECT wallet_id, private_key FROM wallets WHERE public_key = $1`,
            [backendWallet]
        );
        if (walletRes.rowCount === 0) {
            throw new Error("Backend wallet not found in DB");
        }

        const { wallet_id: walletId, private_key: privateKey } = walletRes.rows[0];
        const queueId = uuidv4();

        const insertRes = await pool.query(
            `INSERT INTO transactions
             (queue_id, transaction_hash, backend_wallet, contract_address, chain_id, function_signature, args, status, created_at, updated_at)
             VALUES ($1, '', $2, $3, $4, $5, $6, 'queued', NOW(), NOW())`,
            [queueId, backendWallet, contractAddress, chainId, functionSignature, JSON.stringify(args)]
        );
        if (insertRes.rowCount === 0) {
            throw new Error("Failed to insert transaction into DB");
        }

        await pool.query("COMMIT");

        // After COMMIT the record exists permanently — ROLLBACK is no longer possible.
        // On queue failure, mark 'failed' so monitoring sees truth instead of a stuck 'queued'.
        const jobPayload = {
            queueId,
            functionSignature,
            args,
            contractAddress,
            chainId,
            backendWallet,
            backendWalletPrivateKey: privateKey,
        };
        const jobOptions = {
            attempts: 4,
            backoff: { type: "exponential", delay: 4000 },
            removeOnComplete: true,
            removeOnFail: false,
        };

        try {
            const txnQueue = getQueue(walletId, chainId);
            const job = await txnQueue.add(jobPayload, jobOptions);
            logger.info(`Transaction queued: queueId=${queueId} jobId=${job.id}`);
            res.json({ success: true, queueId, walletId });
        } catch (queueErr) {
            logger.error(`Failed to add job for queueId=${queueId}:`, queueErr.message);
            try {
                await pool.query(
                    `UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE queue_id = $1`,
                    [queueId]
                );
            } catch (dbErr) {
                logger.error(`Failed to mark queueId=${queueId} as failed:`, dbErr.message);
            }
            res.status(500).json({ success: false, error: "Transaction saved but failed to queue", queueId });
        }

    } catch (err) {
        if (pool) {
            try { await pool.query("ROLLBACK"); } catch (_) {}
        }
        logger.error("Error queueing transaction:", err.message);
        res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
    }
});

module.exports = router;
