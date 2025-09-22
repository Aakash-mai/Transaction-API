const { pollerQueue } = require("../queue");
const { getPool } = require("../db");
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

pollerQueue.process(async (job) => {
    const { queueId, txHash } = job.data;
    const pool = getPool();

    const timeout = 2 * 60 * 1000; // 2 minutes
    const interval = 5000; // 5 sec

    const start = Date.now();

    while (Date.now() - start < timeout) {
        try {
            const receipt = await provider.getTransactionReceipt(txHash);

            if (receipt) {
                if (receipt.status === 1) {
                    await pool.query(
                        `UPDATE transactions SET status=$1 WHERE queue_id=$2`,
                        ["mined", queueId]
                    );
                    console.log(`Tx mined: ${txHash}`);
                } else {
                    await pool.query(
                        `UPDATE transactions SET status=$1 WHERE queue_id=$2`,
                        ["errored", queueId]
                    );
                    console.log(`Tx failed: ${txHash}`);
                }
                return;
            }
        } catch (err) {
            logger.error("Polling error:", err);
        }

        await new Promise((res) => setTimeout(res, interval));
    }

    // Timeout case
    await pool.query(
        `UPDATE transactions SET status=$1 WHERE queue_id=$2`,
        ["errored", queueId]
    );
    logger.info(`Tx timed out: ${txHash}`);
});
