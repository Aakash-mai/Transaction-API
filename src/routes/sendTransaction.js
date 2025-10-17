const express = require("express");
const { ethers } = require("ethers");
const { v4: uuidv4 } = require("uuid");
const { getPool } = require("../db");
const logger = require("../lib/logger");
const { getQueue } = require("../queues/index");
const config = require("../config");
const { supportedChains } = require("../utils/supportedChains");

const router = express.Router();

// POST /sendTransaction - Queue a new transaction
router.post("/", async (req, res) => {
    const pool = getPool();
    try {
        const { functionSignature, args, contractAddress, chainId, backendWallet } = req.body;

        if (!functionSignature || !contractAddress || !chainId || !backendWallet) {
            throw new Error("Missing required fields");
        }

        logger.info(`Received transaction request: ${functionSignature} on ${contractAddress} for chain ${chainId}`);

        // --- Start DB transaction ---

        await pool.query("BEGIN");

        // Fetch wallet details
        const walletRes = await pool.query(
            `SELECT wallet_id, private_key, public_key FROM wallets WHERE public_key = $1`,
            [backendWallet]
        );
        if (walletRes.rowCount === 0) {
            throw new Error("Backend wallet not found in DB");
        }

        const { wallet_id: walletId, private_key: privateKey } = walletRes.rows[0];

        // --- Wallet balance check ---
        const chain = supportedChains[chainId];
        if (!chain) {
            throw new Error(`Unsupported chainId: ${chainId}`);
        }
        const rpcUrl = chain.rpcUrl;
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const balance = await provider.getBalance(backendWallet);

        if (balance < ethers.parseEther("0.01")) {
            throw new Error(`Insufficient funds in backend wallet: ${backendWallet}`);
        }

        const queueId = uuidv4();

        // Insert into DB
        const insertRes = await pool.query(
            `INSERT INTO transactions
        (queue_id,transaction_hash,backend_wallet, contract_address, chain_id, function_signature, args, status, created_at, updated_at)
       VALUES ($1,'',$2, $3, $4, $5,$6, 'queued', NOW(), NOW())`,
            [queueId, backendWallet, contractAddress, chainId, functionSignature, JSON.stringify(args)]
        );
        if (insertRes.rowCount === 0) {
            throw new Error("Failed to insert transaction into DB");
        }
        await pool.query("COMMIT");

        const txnQueue = getQueue(walletId, chainId);


        // Create transaction object for the queue
        const transaction = {
            queueId,
            functionSignature,
            args,
            contractAddress,
            chainId,
            backendWallet,
            backendWalletPrivateKey: privateKey,
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
        res.json({ success: true, queueId, walletId });
    } catch (err) {
        await pool.query("ROLLBACK");
        logger.error("Error queueing transaction", err);
        res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
    }
}
);

module.exports = router;