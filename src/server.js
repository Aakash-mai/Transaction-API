const express = require("express");
const { connectDb, getPool } = require("./db.js");
const { initDb } = require("./models/initTables.js");
const walletsRouter = require("./routes/wallets.js");
const transactionStatusRouter = require("./routes/transactionStatus.js");
const logger = require("./lib/logger.js");
const config = require("../config.js");

const PORT = config.port || 4000;
const app = express();
app.use(express.json());
app.use("/addWallet", walletsRouter);
app.use("/transactionStatus", transactionStatusRouter);

async function startServer() {
    await connectDb();
    await initDb();
    app.get("/health", (req, res) => {
        res.json({ status: "ok" });
    });

    app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
    });
}

startServer();

