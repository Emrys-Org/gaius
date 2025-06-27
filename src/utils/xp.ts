import algosdk from 'algosdk';
import { getNetworkConfig } from './algod';

export interface XPTransaction {
  txId: string;
  amount: number;
  reason: string;
  timestamp: number;
  previousTotal: number;
  newTotal: number;
  tierChange?: {
    from: string;
    to: string;
  };
  isRevocation?: boolean;
}

export interface TierChange {
  from: string;
  to: string;
  timestamp: number;
}

export interface XPData {
  totalXP: number;
  lastTierChange: TierChange | null;
  xpHistory: XPTransaction[];
}

/**
 * Fetches XP transactions for a member from the blockchain
 * @param memberAddress The member's Algorand address
 * @param networkType The network type ('mainnet' or 'testnet')
 * @returns XP data including total XP, last tier change, and transaction history
 */
export const fetchMemberXPTransactions = async (
  memberAddress: string,
  networkType: 'mainnet' | 'testnet'
): Promise<XPData> => {
  try {
    const networkConfig = getNetworkConfig(networkType);
    
    // Create an indexer client
    const indexerClient = new algosdk.Indexer(
      networkConfig.algodToken,
      networkConfig.indexerUrl,
      networkConfig.algodPort
    );
    
    // Search for transactions with notes containing XP data
    const searchPrefix = '{"type":"xp_transaction"';
    const transactions = await indexerClient.searchForTransactions()
      .address(memberAddress)
      .notePrefix(new Uint8Array(Buffer.from(searchPrefix)))
      .do();
    
    let totalXP = 0;
    let lastTierChange: TierChange | null = null;
    const xpHistory: XPTransaction[] = [];
    
    // Process transactions to calculate total XP and get history
    for (const txn of transactions.transactions) {
      try {
        // Skip transactions without notes or ID
        if (!txn.note || !txn.id) continue;
        
        // Decode the note field from base64
        const noteBytes = Buffer.from(txn.note, 'base64');
        const noteStr = noteBytes.toString('utf8');
        const noteData = JSON.parse(noteStr);
        
        if (noteData.type === 'xp_transaction') {
          const amount = Number(noteData.amount);
          totalXP += amount; // This will handle negative amounts from revocations
          
          const transaction: XPTransaction = {
            txId: txn.id,
            amount,
            reason: String(noteData.reason || 'XP reward'),
            timestamp: txn.roundTime || Date.now(),
            previousTotal: Number(noteData.previousTotal),
            newTotal: Number(noteData.newTotal),
            tierChange: noteData.tierChange ? {
              from: String(noteData.tierChange.from),
              to: String(noteData.tierChange.to)
            } : undefined,
            isRevocation: Boolean(noteData.isRevocation)
          };
          
          xpHistory.push(transaction);
          
          // Keep track of the most recent tier change
          if (noteData.tierChange?.upgraded && txn.roundTime) {
            if (!lastTierChange || txn.roundTime > lastTierChange.timestamp) {
              lastTierChange = {
                from: String(noteData.tierChange.from),
                to: String(noteData.tierChange.to),
                timestamp: txn.roundTime
              };
            }
          }
        }
      } catch (error) {
        console.warn('Error processing XP transaction:', error);
      }
    }
    
    return {
      totalXP,
      lastTierChange,
      xpHistory: xpHistory.sort((a, b) => b.timestamp - a.timestamp) // Sort by most recent first
    };
  } catch (error) {
    console.error('Error fetching XP transactions:', error);
    throw error;
  }
}; 