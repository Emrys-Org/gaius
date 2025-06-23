import algosdk from 'algosdk'
import { ALGORAND_NETWORKS } from '../helpers/constants'

// Default to testnet for backward compatibility
export const ALGORAND_NETWORK = ALGORAND_NETWORKS.testnet

// Initialize the Algorand client (default testnet)
export const algodClient = new algosdk.Algodv2(
  ALGORAND_NETWORK.algodToken,
  ALGORAND_NETWORK.algodServer,
  ALGORAND_NETWORK.algodPort,
)

// Function to get algod client for specific network
export const getAlgodClient = (network: 'testnet' | 'mainnet' = 'testnet') => {
  const config = ALGORAND_NETWORKS[network]
  return new algosdk.Algodv2(
    config.algodToken,
    config.algodServer,
    config.algodPort,
  )
}

// Function to get network config
export const getNetworkConfig = (
  network: 'testnet' | 'mainnet' = 'testnet',
) => {
  return ALGORAND_NETWORKS[network]
}
