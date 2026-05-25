const app = require("./app");
const { connectDb, disconnectDb } = require("./db");
const { initDb } = require("./db/schema");
const { initializeWalletQueues, closeAllQueues } = require("./queues");
const logger = require("./lib/logger");
const config = require("./config");

const PORT = config.port || 4000;
let server;

async function gracefulShutdown(exitCode = 0) {
    logger.info("Shutting down gracefully...");
    try {
        if (server) server.close();
        await closeAllQueues();
        await disconnectDb();
    } catch (err) {
        logger.error(`Error during shutdown: ${err.message}`);
    }
    process.exit(exitCode);
}

process.on("SIGTERM", () => gracefulShutdown(0));
process.on("SIGINT",  () => gracefulShutdown(0));

process.on("uncaughtException", (error) => {
    logger.error(`Uncaught Exception: ${error}`);
    gracefulShutdown(1);
});

process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
    gracefulShutdown(1);
});

async function startServer() {
    await connectDb();
    await initDb();
    await initializeWalletQueues();
    logger.info("All wallet queues and workers initialized.");

    server = app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
    });
}

startServer().catch((err) => {
    logger.error(`Failed to start server: ${err}`);
    process.exit(1);
});
