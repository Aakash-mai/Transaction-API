const config = require("../config");

const supportedChains = {
    80002: { name: "amoy", rpcUrls: [config.amoyRpcUrl, "https://rpc-amoy.polygon.technology", "https://polygon-amoy-bor-rpc.publicnode.com"].filter(Boolean) },
    43113: { name: "fuji", rpcUrls: [config.fujiRpcUrl, "https://api.avax-test.network/ext/bc/C/rpc", "https://avalanche-fuji-c-chain-rpc.publicnode.com"].filter(Boolean) },
    11155420: { name: "opsepolia", rpcUrls: [config.opsepoliaRpcUrl, "https://optimism-sepolia.publicnode.com", "https://optimism-sepolia.drpc.org", "https://sepolia.optimism.io"].filter(Boolean) },
    97: { name: "bnbTestnet", rpcUrls: [config.bnbTestnetRpcUrl, "https://bsc-testnet-rpc.publicnode.com", "https://bsc-testnet.public.blastapi.io"].filter(Boolean) },
    11155111: { name: "sepolia", rpcUrls: [config.sepoliaRpcUrl, "https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.drpc.org"].filter(Boolean) },
    11142220: { name: "celoSepolia", rpcUrls: [config.celoSepoliaRpcUrl, "wss://celo-sepolia.drpc.org"].filter(Boolean) },
    84532: { name: "baseSepolia", rpcUrls: [config.baseSepoliaRpcUrl, "https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com"].filter(Boolean) },
};

const kalpSupportedNetworks = {
    1905: {
        networkName: "kalptantra",
        networkUrl: "https://rpc-mumbai-newtest.kalp.network/transaction/v1",
        privateKey: config.prodkalpPrivateKey,
        cert: config.prodkalpCert,
        enrollmentId: config.prodkalpEnrollmentId,
    },
    1906: {
        networkName: "stage",
        networkUrl: "https://qa-kalp-gateway.p2eppl.com/transaction/v1",
        privateKey: config.stagekalpPrivateKey,
        cert: config.stagekalpCert,
        enrollmentId: config.stagekalpEnrollmentId,
    },
    1910: {
        networkName: "dev",
        networkUrl: "https://dev-kalp-gateway.p2eppl.com/transaction/v1",
        privateKey: config.devkalpPrivateKey,
        cert: config.devkalpCert,
        enrollmentId: config.devkalpEnrollmentId,
    },
};

module.exports = { supportedChains, kalpSupportedNetworks };