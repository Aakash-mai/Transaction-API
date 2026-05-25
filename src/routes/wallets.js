const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const logger = require("../lib/logger");
const { initializeWalletQueues } = require("../queues/index");

router.post("/", async (req, res) => {
    const pool = getPool();
    try {
        const { publicKey, privateKey } = req.body;
        if (!publicKey || !privateKey) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }

        logger.info(`Adding wallet with public key: ${publicKey}`);

        await pool.query("BEGIN");

        const walletRes = await pool.query(
            `SELECT wallet_id FROM wallets WHERE public_key = $1`,
            [publicKey]
        );

        if (walletRes.rowCount > 0) {
            // Nothing was modified — release the transaction before returning
            await pool.query("ROLLBACK");
            return res.json({ success: true, walletId: walletRes.rows[0].wallet_id, message: "Wallet already exists" });
        }

        const result = await pool.query(
            `INSERT INTO wallets (public_key, private_key) VALUES ($1, $2) RETURNING *`,
            [publicKey, privateKey]
        );

        if (result.rowCount === 0) {
            throw new Error("Failed to add wallet");
        }

        const { wallet_id } = result.rows[0];
        await pool.query("COMMIT");

        // Respond immediately — queue init is recoverable on next restart if it fails
        res.json({ success: true, wallet: result.rows[0].public_key, walletId: wallet_id });

        initializeWalletQueues().catch((err) =>
            logger.error(`Failed to initialize queues for new wallet ${wallet_id}:`, err.message)
        );

    } catch (err) {
        try { await pool.query("ROLLBACK"); } catch (_) {}
        logger.error("Error adding wallet:", err.message);
        res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
    }
});

module.exports = router;
