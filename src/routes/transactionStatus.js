const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const logger = require("../lib/logger");

router.get("/:queueId", async (req, res) => {
    try {
        const { queueId } = req.params;
        logger.info(`Retrieving transaction status for queueId: ${queueId}`);

        const pool = getPool();
        const result = await pool.query(
            `SELECT status, transaction_hash FROM transactions WHERE queue_id = $1`,
            [queueId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Transaction not found" });
        }

        const { status, transaction_hash } = result.rows[0];
        logger.info(`Transaction status for queueId ${queueId}: ${status}`);

        res.json({ success: true, queueId, status, txHash: transaction_hash });
    } catch (err) {
        logger.error(`Error retrieving transaction status: ${err.message}`);
        res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
    }
});

module.exports = router;
