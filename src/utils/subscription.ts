import algosdk from 'algosdk';
import { getAlgodClient } from './algod';

// Wallet address that receives subscription payments
const SUBSCRIPTION_WALLET = 'NXZKJ5F74WOM5FI7KQQ4XQVAGAAXLGS6ROUEQJGDWXT6UNOQMTEC5UAAMU';

// Subscription plans with their details and limits
export const SUBSCRIPTION_PLANS = {
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 5, // 5 ALGO per month
    memberLimit: 250,
    programLimit: 40,
    features: ['Basic analytics', 'Email support'],
    recommended: false
  },
  pro: {
    id: 'pro',
    name: 'Professional',
    price: 20, // 20 ALGO per month
    memberLimit: 2500,
    programLimit: 20,
    features: ['Advanced analytics', 'Priority support', 'Custom branding'],
    recommended: true
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 50, // 50 ALGO per month
    memberLimit: Infinity,
    programLimit: Infinity,
    features: ['Premium analytics', 'Dedicated support', 'Custom branding', 'API access'],
    recommended: false
  }
};

// Duration of subscription in seconds (30 days)
const SUBSCRIPTION_DURATION = 30 * 24 * 60 * 60;

// Interface for subscription details
export interface SubscriptionDetails {
  plan: string;
  expiryDate: Date;
  isActive: boolean;
  transactionId: string;
  memberLimit: number;
  programLimit: number;
}

// Interface for subscription transaction
interface SubscriptionTransaction {
  txId: string;
  timestamp: number;
  amount: number;
  plan: string;
  expiryDate: number;
}

// Check if a wallet has an active subscription
export async function checkSubscription(walletAddress: string): Promise<SubscriptionDetails | null> {
  if (!walletAddress) return null;

  try {
    const networkType = 'testnet'; // Default to testnet for safety
    const algodClient = getAlgodClient(networkType);
    
    // Get transactions where the wallet sent payment to the subscription wallet
    const txns = await getSubscriptionTransactions(walletAddress, algodClient);
    
    if (txns.length === 0) {
      return null;
    }
    
    // Sort transactions by timestamp (newest first)
    const sortedTxns = txns.sort((a, b) => b.timestamp - a.timestamp);
    
    // Get the most recent transaction
    const latestTxn = sortedTxns[0];
    
    // Check if subscription is still active
    const now = Date.now() / 1000; // Current time in seconds
    const isActive = latestTxn.expiryDate > now;
    
    // Determine the plan based on the amount
    const plan = latestTxn.plan;
    const planDetails = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS];
    
    return {
      plan: plan,
      expiryDate: new Date(latestTxn.expiryDate * 1000),
      isActive,
      transactionId: latestTxn.txId,
      memberLimit: planDetails?.memberLimit || 0,
      programLimit: planDetails?.programLimit || 0
    };
  } catch (error) {
    console.error('Error checking subscription:', error);
    return null;
  }
}

// Get all subscription transactions for a wallet
async function getSubscriptionTransactions(walletAddress: string, algodClient: algosdk.Algodv2): Promise<SubscriptionTransaction[]> {
  try {
    // For demo purposes, we'll check localStorage for stored transactions
    // In a production app, you would use the Algorand Indexer API to get and verify transactions
    const storedTxns = localStorage.getItem(`subscription_txns_${walletAddress}`);
    if (storedTxns) {
      return JSON.parse(storedTxns);
    }
    
    return [];
  } catch (error) {
    console.error('Error getting subscription transactions:', error);
    return [];
  }
}

// Store a subscription transaction in localStorage (for demo purposes)
export function storeSubscriptionTransaction(
  walletAddress: string,
  txId: string,
  plan: string,
  amount: number
): void {
  try {
    // Calculate expiry date (30 days from now)
    const now = Math.floor(Date.now() / 1000);
    const expiryDate = now + SUBSCRIPTION_DURATION;
    
    // Create transaction object
    const txn: SubscriptionTransaction = {
      txId,
      timestamp: now,
      amount,
      plan,
      expiryDate
    };
    
    // Get existing transactions
    const storedTxns = localStorage.getItem(`subscription_txns_${walletAddress}`);
    let txns: SubscriptionTransaction[] = storedTxns ? JSON.parse(storedTxns) : [];
    
    // Add new transaction
    txns.push(txn);
    
    // Store updated transactions
    localStorage.setItem(`subscription_txns_${walletAddress}`, JSON.stringify(txns));
  } catch (error) {
    console.error('Error storing subscription transaction:', error);
  }
}

// Process a subscription payment
export async function processSubscription(
  walletAddress: string,
  plan: string,
  signTransactions: (txns: Uint8Array[]) => Promise<(Uint8Array | null)[]>
): Promise<{ success: boolean; message: string; txId?: string }> {
  try {
    if (!walletAddress || !signTransactions) {
      return { success: false, message: 'Wallet not connected' };
    }
    
    // Get plan details
    const planDetails = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS];
    if (!planDetails) {
      return { success: false, message: 'Invalid subscription plan' };
    }
    
    // Amount in microAlgos (1 ALGO = 1,000,000 microAlgos)
    const amount = planDetails.price * 1_000_000;
    
    // Get network-specific algod client
    const networkType = 'testnet'; // Default to testnet for safety
    const algodClient = getAlgodClient(networkType);
    
    // Get suggested parameters
    const suggestedParams = await algodClient.getTransactionParams().do();
    
    // Create payment transaction
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: walletAddress,
      receiver: SUBSCRIPTION_WALLET,
      amount: amount,
      note: new Uint8Array(Buffer.from(`Gaius Loyalty Program - ${planDetails.name} Plan Subscription`)),
      suggestedParams
    });
    
    // Sign the transaction
    const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
    const signedTxns = await signTransactions([encodedTxn]);
    
    if (signedTxns && signedTxns[0]) {
      const signedTxnBytes = signedTxns.map(txn => txn ? new Uint8Array(txn) : null).filter(Boolean) as Uint8Array[];
      const response = await algodClient.sendRawTransaction(signedTxnBytes).do();
      
      // Wait for confirmation
      await algosdk.waitForConfirmation(
        algodClient,
        response.txid,
        4
      );
      
      // Store transaction details
      storeSubscriptionTransaction(walletAddress, response.txid, plan, amount);
      
      return {
        success: true,
        message: `Successfully subscribed to the ${planDetails.name} plan!`,
        txId: response.txid
      };
    } else {
      return { success: false, message: 'Failed to sign transaction' };
    }
  } catch (error: any) {
    console.error('Error processing subscription payment:', error);
    
    let errorMessage = error.message || 'Unknown error occurred';
    
    if (error.message?.includes('User rejected')) {
      errorMessage = 'Transaction was rejected by user.';
    }
    
    return {
      success: false,
      message: `Error processing payment: ${errorMessage}`
    };
  }
}

// Check if a wallet has reached its member limit
export function hasReachedMemberLimit(subscription: SubscriptionDetails | null, currentMemberCount: number): boolean {
  if (!subscription || !subscription.isActive) {
    return true; // No active subscription
  }
  
  return currentMemberCount >= subscription.memberLimit;
}

// Check if a wallet has reached its program limit
export function hasReachedProgramLimit(subscription: SubscriptionDetails | null, currentProgramCount: number): boolean {
  if (!subscription || !subscription.isActive) {
    return true; // No active subscription
  }
  
  return currentProgramCount >= subscription.programLimit;
}

// Get subscription plan details
export function getPlanDetails(plan: string) {
  return SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS];
}

// Format expiry date
export function formatExpiryDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Calculate days remaining in subscription
export function getDaysRemaining(expiryDate: Date): number {
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}