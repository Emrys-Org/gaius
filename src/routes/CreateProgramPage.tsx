import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import { supabase } from '../utils/supabase';
import { WalletInfo } from '../components/WalletInfo';
import { LoyaltyProgramMinter } from '../components/LoyaltyProgramMinter';
import { checkSubscription } from '../utils/subscription';

export function CreateProgramPage() {
  const { activeAddress } = useWallet();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);

  // Check if user is authenticated
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session && activeAddress) {
        navigate('/auth');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session && activeAddress) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [activeAddress, navigate]);

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

  // Get subscription plan name for display
  const getSubscriptionPlanName = () => {
    if (!subscription || !subscription.isActive) return null;
    return subscription.plan;
  };

  const handleLoyaltyProgramMinted = () => {
    navigate('/dashboard');
  };

  if (!activeAddress) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Please connect your wallet to create a loyalty program
          </p>
        </div>
      </div>
    );
  }

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
      <WalletInfo subscriptionPlan={getSubscriptionPlanName()} />
      <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 my-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Create Your Loyalty Program</h2>
        </div>
        <LoyaltyProgramMinter onLoyaltyProgramMinted={handleLoyaltyProgramMinted} />
      </div>
    </div>
  );
} 