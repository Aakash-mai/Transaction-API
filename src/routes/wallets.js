const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const logger = require("../lib/logger");
const e = require("express");

// POST /addWallet - Add a new wallet
router.post("/", async (req, res) => {
    try {
        const { publicKey, privateKey } = req.body;
        if (!publicKey || !privateKey) {
            throw new Error("Missing required fields");
        }
        logger.info(`Adding wallet with public key: ${publicKey}`);

        const pool = getPool();
        const insertQuery = `INSERT INTO wallets (public_key, private_key) VALUES ($1, $2) RETURNING * `;
        const result = await pool.query(insertQuery, [publicKey, privateKey]);

        logger.info(`Wallet added: ${result.rows[0].public_key}`);

        res.json({
            success: true,
            wallet: result.rows[0].public_key,
        });
    } catch (err) {
        logger.error("Error adding wallet", err);
        res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
    }
});

module.exports = router;
