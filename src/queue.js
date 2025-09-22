const Bull = require("bull");
const logger = require("./lib/logger");
const config = require("./config");

// Create a Bull queue
const txnQueue = new Bull("transactions", config.redisUrl);

//log if redis connection succeeds or fails 
txnQueue.on("error", (error) => {
    logger.error("Redis connection error in txQueue:", error);
});
txnQueue.on("ready", () => {
    logger.info("Redis connection successful for txQueue");
});

module.exports = { txnQueue };
