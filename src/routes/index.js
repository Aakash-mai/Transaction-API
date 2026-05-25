const express = require("express");
const router = express.Router();

router.use("/addWallet",         require("./wallets"));
router.use("/sendTransaction",   require("./sendTransaction"));
router.use("/transactionStatus", require("./transactionStatus"));
router.use("/health",            require("./health"));

module.exports = router;
