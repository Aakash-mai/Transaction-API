declare const Network: {
    Stagenet: string;
    Testnet: string;
    Mainnet: string;
    IntegrationManinet: string;
};
declare function getSeedPhrase(): Promise<string>;
declare function getKeyPairFromSeedPhrase(seedPhrase: any): Promise<{
    pemPrivateKey: any;
    pemPublicKey: string;
}>;
declare function getKeyPair(): Promise<{
    pemPrivateKey: string;
    pemPublicKey: string;
}>;
declare function getEnrollmentId(publicKey: any): Promise<string>;
declare function createCsr(enrollmentID: any, privateKeyPem: any, publicKeyPem: any): any;
declare function registerAndEnrollUser(network: any, nglURL: any, channelName: any, enrollmentID: any, csr: any): Promise<any>;
declare function register(network: any, nglURL: any, channelName: any, enrollmentID: any, encryptedWord: any): Promise<string>;
declare function enrollCsr(network: any, nglURL: any, channelName: any, enrollmentID: any, encryptedWord: any, csr: any): Promise<any>;
declare function getSecret(enrollmentID: any): Promise<string>;
declare function submitTransaction(network: any, gatewayURL: any, enrollmentID: any, pemPrivateKey: any, cert: any, channelName: any, chainCodeName: any, transactionName: any, transactionParams: any): Promise<any>;
declare function evaluateTransaction(network: any, gatewayURL: any, enrollmentID: any, privateKeyString: any, cert: any, channelName: any, chainCodeName: any, transactionName: any, transactionParams: any): Promise<any>;
declare const evaluateBalance: (network: any, gatewayURL: any, enrollmentID: any, privateKeyString: any, cert: any, channelName: any, chainCodeName: any, transactionNameBalance: any, transactionParamsBalance: any) => Promise<any>;
declare function signUsingElliptic(privateKeyString: any, hashedBytesArray: any): Promise<string[]>;
declare function getRandSvalue(privateKeyString: any, proposal: any): Promise<string[]>;
export { getKeyPair, getKeyPairFromSeedPhrase, register, enrollCsr, createCsr, getEnrollmentId, submitTransaction, getSeedPhrase, signUsingElliptic, evaluateTransaction, evaluateBalance, getRandSvalue, registerAndEnrollUser, getSecret, Network, };
