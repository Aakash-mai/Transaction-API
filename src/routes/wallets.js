const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const logger = require("../lib/logger");
const { createQueueForWallet } = require("../queues/index");


// POST /addWallet - Add a new wallet
router.post("/", async (req, res) => {
    const pool = getPool();
    try {
        const { publicKey, privateKey } = req.body;
        if (!publicKey || !privateKey) {
            throw new Error("Missing required fields");
        }
        logger.info(`Adding wallet with public key: ${publicKey}`);

        await pool.query("BEGIN");
        const walletRes = await pool.query(
            `SELECT wallet_id FROM wallets WHERE public_key = $1`,
            [publicKey]
        );

        if (walletRes.rowCount > 0) {
            // Wallet already exists, return existing wallet_id
            return res.json({ success: true, walletId: walletRes.rows[0].wallet_id, message: "Wallet already exists" });
        }
        const insertQuery = `INSERT INTO wallets (public_key, private_key) VALUES ($1, $2) RETURNING * `;
        const result = await pool.query(insertQuery, [publicKey, privateKey]);
        if (result.rowCount === 0) {
            throw new Error("Failed to add wallet");
        }
        logger.info(`Wallet added: ${JSON.stringify(result.rows[0])}`);
        const { wallet_id } = result.rows[0];
        await pool.query("COMMIT");

        // Dynamically create queue for this wallet
        await createQueueForWallet(wallet_id, publicKey);

        res.json({
            success: true,
            wallet: result.rows[0].public_key,
            walletId: result.rows[0].wallet_id,
        });
    } catch (err) {
        await pool.query("ROLLBACK");
        logger.error("Error adding wallet", err);
        res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
    }
});

module.exports = router;
