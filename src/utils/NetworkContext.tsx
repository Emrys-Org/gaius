import React, { createContext, useContext, useEffect } from 'react';
import { useNetwork } from '@txnlab/use-wallet-react';
import { getAlgodClient, ALGORAND_NETWORKS } from './algod';

interface NetworkContextType {
  isMainnet: boolean;
  network: 'mainnet' | 'testnet';
  algodClient: any;
  explorerURL: string;
  indexerURL: string;
}

const NetworkContext = createContext<NetworkContextType>({
  isMainnet: false,
  network: 'testnet',
  algodClient: getAlgodClient('testnet'),
  explorerURL: ALGORAND_NETWORKS.testnet.explorerUrl,
  indexerURL: ALGORAND_NETWORKS.testnet.indexerUrl,
});

export const useNetworkContext = () => useContext(NetworkContext);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeNetwork } = useNetwork();
  
  const networkState = {
    isMainnet: activeNetwork === 'mainnet',
    network: activeNetwork === 'mainnet' ? 'mainnet' : 'testnet',
    algodClient: getAlgodClient(activeNetwork === 'mainnet' ? 'mainnet' : 'testnet'),
    explorerURL: ALGORAND_NETWORKS[activeNetwork === 'mainnet' ? 'mainnet' : 'testnet'].explorerUrl,
    indexerURL: ALGORAND_NETWORKS[activeNetwork === 'mainnet' ? 'mainnet' : 'testnet'].indexerUrl,
  };

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
}; 