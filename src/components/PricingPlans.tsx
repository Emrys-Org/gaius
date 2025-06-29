import { useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { Check, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { processSubscription, SUBSCRIPTION_PLANS, SubscriptionDetails, formatExpiryDate, getDaysRemaining } from '../utils/subscription';

interface PricingPlansProps {
  onSubscriptionComplete?: (plan: string) => void;
  currentSubscription?: SubscriptionDetails | null;
}

export function PricingPlans({ onSubscriptionComplete, currentSubscription }: PricingPlansProps) {
  const { activeAddress, signTransactions } = useWallet();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    message: string;
    txId?: string;
  } | null>(null);

  // Convert subscription plans object to array for rendering
  const plansArray = Object.values(SUBSCRIPTION_PLANS);

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
      // Process subscription using our utility
      const result = await processSubscription(
        activeAddress,
        selectedPlan,
        signTransactions
      );
      
      setPaymentResult(result);

      // Call the callback if provided and subscription was successful
      if (result.success && onSubscriptionComplete) {
        onSubscriptionComplete(selectedPlan);
      }
    } catch (error: any) {
      console.error('Error processing subscription payment:', error);
      
      setPaymentResult({
        success: false,
        message: `Error processing payment: ${error.message || 'Unknown error occurred'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isUpgrade = (planId: string): boolean => {
    if (!currentSubscription) return false;
    
    const currentPlanPrice = SUBSCRIPTION_PLANS[currentSubscription.plan as keyof typeof SUBSCRIPTION_PLANS]?.price || 0;
    const newPlanPrice = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS]?.price || 0;
    
    return newPlanPrice > currentPlanPrice;
  };

  const isCurrentPlan = (planId: string): boolean => {
    return currentSubscription?.plan === planId && currentSubscription.isActive;
  };

  return (
    <div className="py-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">Choose Your Subscription Plan</h2>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Select the plan that best fits your organization's needs
        </p>
        
        {currentSubscription && currentSubscription.isActive && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg inline-flex items-center gap-3 text-blue-800 dark:text-blue-300">
            <Clock size={20} />
            <span>
              Your <strong>{SUBSCRIPTION_PLANS[currentSubscription.plan as keyof typeof SUBSCRIPTION_PLANS]?.name}</strong> subscription is active until {formatExpiryDate(currentSubscription.expiryDate)} ({getDaysRemaining(currentSubscription.expiryDate)} days remaining)
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {plansArray.map((plan) => (
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
            
            {isCurrentPlan(plan.id) && (
              <div className="absolute top-0 left-0 right-0 bg-green-500 text-white text-center py-1 text-sm font-medium">
                Current Plan
              </div>
            )}
            
            <div className={`p-6 ${(plan.recommended || isCurrentPlan(plan.id)) ? 'pt-10' : ''}`}>
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-gray-600 dark:text-gray-400"> ALGO</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
              </div>
              
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <Check size={18} className="text-green-500 flex-shrink-0" />
                  <span>{plan.memberLimit === Infinity ? 'Unlimited' : plan.memberLimit} members</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={18} className="text-green-500 flex-shrink-0" />
                  <span>{plan.programLimit === Infinity ? 'Unlimited' : plan.programLimit} loyalty programs</span>
                </li>
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check size={18} className="text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={isCurrentPlan(plan.id)}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  isCurrentPlan(plan.id)
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 cursor-not-allowed'
                    : selectedPlan === plan.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-blue-50 dark:hover:bg-blue-900/30'
                }`}
              >
                {isCurrentPlan(plan.id) 
                  ? 'Current Plan' 
                  : isUpgrade(plan.id) 
                    ? 'Upgrade Plan' 
                    : selectedPlan === plan.id 
                      ? 'Selected' 
                      : 'Select Plan'}
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
              You've selected the {SUBSCRIPTION_PLANS[selectedPlan as keyof typeof SUBSCRIPTION_PLANS]?.name} plan at {SUBSCRIPTION_PLANS[selectedPlan as keyof typeof SUBSCRIPTION_PLANS]?.price} ALGO per month.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Click the button below to complete your payment. You'll be prompted to confirm the transaction in your wallet.
            </p>
            
            {currentSubscription && currentSubscription.isActive && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-300">
                      You already have an active subscription
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                      {isUpgrade(selectedPlan) 
                        ? "This will upgrade your current plan. Your subscription period will restart from today."
                        : "This will replace your current plan. Your subscription period will restart from today."}
                    </p>
                  </div>
                </div>
              </div>
            )}
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
              ) : isUpgrade(selectedPlan) ? (
                <>
                  Upgrade Subscription
                  <ArrowRight size={18} />
                </>
              ) : currentSubscription && currentSubscription.isActive ? (
                <>
                  Change Subscription
                  <ArrowRight size={18} />
                </>
              ) : (
                'Complete Subscription'
              )}
            </button>
            
            <button
              onClick={() => setSelectedPlan(null)}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <p className="font-medium">{paymentResult.message}</p>
              {paymentResult.success && paymentResult.txId && (
                <p className="mt-2 text-sm">
                  Transaction ID: <span className="font-mono">{paymentResult.txId.substring(0, 8)}...{paymentResult.txId.substring(paymentResult.txId.length - 8)}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 