const express = require("express");
const router = express.Router();
const { getPool } = require("../db");
const logger = require("../lib/logger");

//GET /transactionStatus/:queueId - Get transaction status and Transaction hash by queue ID from DB
router.get("/:queueId", async (req, res) => {
    try {
        const { queueId } = req.params;
        if (!queueId) {
            throw new Error("Missing required fields");
        }
        logger.info(`Retrieving transaction status for queue ID: ${queueId}`);

        const pool = getPool();
        const selectQuery = ` SELECT status, transaction_hash  FROM transactions WHERE queue_id = $1`;
        const result = await pool.query(selectQuery, [queueId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        logger.info(`Transaction status retrieved for queue ID: ${JSON.stringify(result.rows[0])}`);

        res.json({
            success: true,
            queueId: queueId,
            status: result.rows[0].status,
            txHash: result.rows[0].transaction_hash
        });
    } catch (err) {
        logger.error("Error retrieving transaction status", err);
        res.status(500).json({ success: false, error: err.message || "Internal Server Error" });
    }
});
module.exports = router;