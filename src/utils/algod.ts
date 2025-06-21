import algosdk from 'algosdk';

// Network configuration
export const ALGORAND_NETWORK = {
  name: 'TestNet',
  type: 'testnet',
  algodToken: '',
  algodServer: 'https://testnet-api.algonode.cloud',
  algodPort: '',
  explorerUrl: 'https://lora.algokit.io/testnet',
  indexerUrl: 'https://testnet-idx.algonode.cloud',
};

// Initialize the Algorand client
export const algodClient = new algosdk.Algodv2(
  ALGORAND_NETWORK.algodToken,
  ALGORAND_NETWORK.algodServer,
  ALGORAND_NETWORK.algodPort
); 