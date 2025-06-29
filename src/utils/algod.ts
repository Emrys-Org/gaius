import algosdk from 'algosdk';

// Helper function to get environment variables with fallbacks
const getEnvVar = (key: string, fallback: string): string => {
  return import.meta.env[key] || fallback;
};

// Network configurations
export const ALGORAND_NETWORKS = {
  testnet: {
    name: 'TestNet',
    type: 'testnet',
    algodToken: getEnvVar('VITE_TESTNET_ALGOD_TOKEN', ''),
    algodServer: getEnvVar('VITE_TESTNET_ALGOD_SERVER', 'https://testnet-api.algonode.cloud'),
    algodPort: getEnvVar('VITE_TESTNET_ALGOD_PORT', ''),
    explorerUrl: getEnvVar('VITE_TESTNET_EXPLORER_URL', 'https://lora.algokit.io/testnet'),
    indexerUrl: getEnvVar('VITE_TESTNET_INDEXER_URL', 'https://testnet-idx.algonode.cloud'),
  },
  mainnet: {
    name: 'MainNet',
    type: 'mainnet',
    algodToken: getEnvVar('VITE_MAINNET_ALGOD_TOKEN', ''),
    algodServer: getEnvVar('VITE_MAINNET_ALGOD_SERVER', 'https://mainnet-api.algonode.cloud'),
    algodPort: getEnvVar('VITE_MAINNET_ALGOD_PORT', ''),
    explorerUrl: getEnvVar('VITE_MAINNET_EXPLORER_URL', 'https://lora.algokit.io/mainnet'),
    indexerUrl: getEnvVar('VITE_MAINNET_INDEXER_URL', 'https://mainnet-idx.algonode.cloud'),
  },
};

// Default to testnet for backward compatibility
export const ALGORAND_NETWORK = ALGORAND_NETWORKS.testnet;

// Initialize the Algorand client (default testnet)
export const algodClient = new algosdk.Algodv2(
  ALGORAND_NETWORK.algodToken,
  ALGORAND_NETWORK.algodServer,
  ALGORAND_NETWORK.algodPort
);

// Function to get algod client for specific network
export const getAlgodClient = (network: 'testnet' | 'mainnet' = 'testnet') => {
  const config = ALGORAND_NETWORKS[network];
  return new algosdk.Algodv2(
    config.algodToken,
    config.algodServer,
    config.algodPort
  );
};

// Function to get network config
export const getNetworkConfig = (network: 'testnet' | 'mainnet' = 'testnet') => {
  return ALGORAND_NETWORKS[network];
};

// Function to get the first loyalty pass date for a wallet
export const getFirstLoyaltyPassDate = async (
  address: string,
  assetIds: number[],
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<string | null> => {
  try {
    if (!address || !assetIds.length) return null;

    const config = ALGORAND_NETWORKS[network];
    const indexerUrl = config.indexerUrl;

    // Get the earliest asset transfer for any of the loyalty passes
    const promises = assetIds.map(async (assetId) => {
      const response = await fetch(
        `${indexerUrl}/v2/assets/${assetId}/transactions?address=${address}&tx-type=axfer&limit=1`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch asset transfer history: ${response.statusText}`);
      }

      const data = await response.json();
      const transactions = data.transactions || [];
      
      // Return the first transfer's timestamp if exists
      return transactions.length > 0 ? transactions[0]['round-time'] : null;
    });

    const timestamps = (await Promise.all(promises)).filter(Boolean);
    
    if (!timestamps.length) return null;

    // Get the earliest timestamp
    const earliestTimestamp = Math.min(...timestamps);
    return new Date(earliestTimestamp * 1000).toISOString();
  } catch (error) {
    console.error('Error fetching first loyalty pass date:', error);
    return null;
  }
}; 