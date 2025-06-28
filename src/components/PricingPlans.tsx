import { useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { getAlgodClient } from '../utils/algod';
import { Check, AlertTriangle } from 'lucide-react';

// Wallet address to send payments to
const PAYMENT_WALLET_ADDRESS = 'NXZKJ5F74WOM5FI7KQQ4XQVAGAAXLGS6ROUEQJGDWXT6UNOQMTEC5UAAMU';

// Pricing plans
const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 5, // 5 ALGO per month
    features: [
      'Up to 100 members',
      '3 loyalty programs',
      'Basic analytics',
      'Email support'
    ],
    recommended: false
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 20, // 20 ALGO per month
    features: [
      'Up to 1,000 members',
      '10 loyalty programs',
      'Advanced analytics',
      'Priority support',
      'Custom branding'
    ],
    recommended: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 50, // 50 ALGO per month
    features: [
      'Unlimited members',
      'Unlimited loyalty programs',
      'Premium analytics',
      'Dedicated support',
      'Custom branding',
      'API access'
    ],
    recommended: false
  }
];

interface PricingPlansProps {
  onSubscriptionComplete?: (plan: string) => void;
}

export function PricingPlans({ onSubscriptionComplete }: PricingPlansProps) {
  const { activeAddress, signTransactions } = useWallet();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    message: string;
    txId?: string;
  } | null>(null);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    // Reset payment result when selecting a new plan
    setPaymentResult(null);
  };

  const handleSubscribe = async () => {
    if (!activeAddress || !signTransactions || !selectedPlan) {
      setPaymentResult({
        success: false,
        message: 'Please connect your wallet and select a plan'
      });
      return;
    }

    setIsProcessing(true);
    setPaymentResult(null);

    try {
      const plan = plans.find(p => p.id === selectedPlan);
      if (!plan) {
        throw new Error('Selected plan not found');
      }

      // Amount in microAlgos (1 ALGO = 1,000,000 microAlgos)
      const amount = plan.price * 1_000_000;

      // Get network-specific algod client
      const networkType = 'testnet'; // Default to testnet for safety
      const algodClient = getAlgodClient(networkType);
      
      // Get suggested parameters
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Create payment transaction
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: PAYMENT_WALLET_ADDRESS,
        amount: amount,
        note: new Uint8Array(Buffer.from(`Gaius Loyalty Program - ${plan.name} Plan Subscription`)),
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
        
        setPaymentResult({
          success: true,
          message: `Successfully subscribed to the ${plan.name} plan!`,
          txId: response.txid
        });

        // Call the callback if provided
        if (onSubscriptionComplete) {
          onSubscriptionComplete(selectedPlan);
        }
      } else {
        throw new Error('Failed to sign transaction');
      }
    } catch (error: any) {
      console.error('Error processing subscription payment:', error);
      
      let errorMessage = error.message || 'Unknown error occurred';
      
      if (error.message?.includes('User rejected')) {
        errorMessage = 'Transaction was rejected by user.';
      }
      
      setPaymentResult({
        success: false,
        message: `Error processing payment: ${errorMessage}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getPlanPrice = (plan: typeof plans[0]) => {
    return (
      <div>
        <span className="text-4xl font-bold">{plan.price}</span>
        <span className="text-gray-600 dark:text-gray-400"> ALGO</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
      </div>
    );
  };

  return (
    <div className="py-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">Choose Your Subscription Plan</h2>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Select the plan that best fits your organization's needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {plans.map((plan) => (
          <div 
            key={plan.id}
            className={`bg-white dark:bg-gray-800 rounded-2xl overflow-hidden transition-all duration-300 ${
              selectedPlan === plan.id 
                ? 'ring-4 ring-blue-500 transform scale-105' 
                : 'border border-gray-200 dark:border-gray-700 hover:shadow-lg'
            } ${plan.recommended ? 'relative' : ''}`}
          >
            {plan.recommended && (
              <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white text-center py-1 text-sm font-medium">
                Recommended
              </div>
            )}
            
            <div className={`p-6 ${plan.recommended ? 'pt-10' : ''}`}>
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-6">
                {getPlanPrice(plan)}
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check size={18} className="text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button
                onClick={() => handleSelectPlan(plan.id)}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  selectedPlan === plan.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-blue-50 dark:hover:bg-blue-900/30'
                }`}
              >
                {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedPlan && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4">Complete Your Subscription</h3>
          
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="font-medium">
              You've selected the {plans.find(p => p.id === selectedPlan)?.name} plan at {plans.find(p => p.id === selectedPlan)?.price} ALGO per month.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Click the button below to complete your payment. You'll be prompted to confirm the transaction in your wallet.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button
              onClick={handleSubscribe}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Processing...
                </>
              ) : (
                'Complete Subscription'
              )}
            </button>
            
            <button
              onClick={() => setSelectedPlan(null)}
              className="w-full sm:w-auto px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
          
          {paymentResult && (
            <div className={`mt-6 p-4 rounded-lg ${
              paymentResult.success 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
            }`}>
              <div className="flex items-start gap-3">
                {paymentResult.success ? (
                  <Check size={20} className="text-green-500 mt-0.5" />
                ) : (
                  <AlertTriangle size={20} className="text-red-500 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">{paymentResult.message}</p>
                  {paymentResult.txId && (
                    <p className="mt-2 text-sm">
                      Transaction ID: {paymentResult.txId.substring(0, 8)}...{paymentResult.txId.substring(paymentResult.txId.length - 8)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>All subscriptions are billed monthly and can be cancelled at any time.</p>
        <p className="mt-2">Need help? Contact our support team at support@gaiusloyalty.com</p>
      </div>
    </div>
  );
} 