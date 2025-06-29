import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import { PricingPlans } from '../components/PricingPlans';
import { checkSubscription } from '../utils/subscription';

export function PricingPage() {
  const { activeAddress } = useWallet();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<any>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);

  // Fetch subscription status
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!activeAddress) {
        setSubscription(null);
        return;
      }
      
      setIsLoadingSubscription(true);
      
      try {
        const subscriptionDetails = await checkSubscription(activeAddress);
        setSubscription(subscriptionDetails);
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setSubscription(null);
      } finally {
        setIsLoadingSubscription(false);
      }
    };
    
    fetchSubscription();
  }, [activeAddress]);

  const handleSubscriptionComplete = (plan: string) => {
    // Refresh subscription data from blockchain
    if (activeAddress) {
      checkSubscription(activeAddress).then(subscriptionDetails => {
        setSubscription(subscriptionDetails);
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          ← Back to Home
        </button>
      </div>
      {isLoadingSubscription ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading subscription details...</p>
        </div>
      ) : (
        <PricingPlans 
          onSubscriptionComplete={handleSubscriptionComplete} 
          currentSubscription={subscription}
        />
      )}
    </div>
  );
} 