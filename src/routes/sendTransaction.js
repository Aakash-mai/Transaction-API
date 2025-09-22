const express = require("express");
const { ethers } = require("ethers");
const { v4: uuidv4 } = require("uuid");
const { getPool } = require("../db");
const logger = require("../lib/logger");
const { txnQueue } = require("../queue");
const config = require("../config");

const router = express.Router();

// POST /sendTransaction - Queue a new transaction
router.post("/", async (req, res) => {
    try {
        const { functionSignature, args, contractAddress, chainId, backendWallet } = req.body;

        if (!functionSignature || !contractAddress || !chainId || !backendWallet) {
            throw new Error("Missing required fields");
        }

        logger.info(`Received transaction request: ${functionSignature} on ${contractAddress} for chain ${chainId}`);

        // --- Wallet balance check ---
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const balance = await provider.getBalance(backendWallet);

        if (balance < ethers.parseEther("0.01")) {
            throw new Error(`Insufficient funds in backend wallet: ${backendWallet}`);
        }

        const queueId = uuidv4();
        const pool = getPool();
        await pool.query("BEGIN");

        // Insert into DB
        await pool.query(
            `INSERT INTO transactions
        (queue_id,transaction_hash,backend_wallet, contract_address, chain_id, function_signature, args, status, created_at, updated_at)
       VALUES ($1,'',$2, $3, $4, $5,$6, 'queued', NOW(), NOW())`,
            [queueId, backendWallet, contractAddress, chainId, functionSignature, JSON.stringify(args)]
        );
        if (pool.rowCount === 0) {
            throw new Error("Failed to insert transaction into DB");
        }

        // Fetch backend wallet private key
        const walletRes = await pool.query(
            `SELECT private_key FROM wallets WHERE public_key = $1`,
            [backendWallet]
        );
        if (walletRes.rowCount === 0) {
            throw new Error("Backend wallet not found");
        }
        const backendWalletPrivateKey = walletRes.rows[0].private_key;
        await pool.query("COMMIT");

        // Create transaction object for the queue
        const transaction = {
            queueId,
            functionSignature,
            args,
            contractAddress,
            chainId,
            backendWallet,
            backendWalletPrivateKey
        }

        // Add to Bull queue
        const job = await txnQueue.add(
            transaction, {
            attempts: 2,
            backoff: 0,
            removeOnComplete: true, // remove job from queue on success
            removeOnFail: false,    // keep all failed jobs
        }
        );

        logger.info(`Transaction queued with ID: ${queueId} and Job ID: ${job.id}`);
        res.json({ success: true, queueId });
    } catch (err) {
        await pool.query("ROLLBACK");
        logger.error("Error queueing transaction", err);
        res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
    }
}
);

module.exports = router;