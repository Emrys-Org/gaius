import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import { supabase } from '../utils/supabase';
import { WalletInfo } from '../components/WalletInfo';
import { LoyaltyProgramDashboard } from '../components/LoyaltyProgramDashboard';
import { checkSubscription } from '../utils/subscription';
import { useState } from 'react';

export function DashboardPage() {
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

  const handleNavigateToPricing = () => {
    navigate('/pricing');
  };

  // Get subscription plan name for display
  const getSubscriptionPlanName = () => {
    if (!subscription || !subscription.isActive) return null;
    return subscription.plan;
  };

  if (!activeAddress) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Please connect your wallet to access the dashboard
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <WalletInfo subscriptionPlan={getSubscriptionPlanName()} />
      <LoyaltyProgramDashboard 
        subscriptionPlan={getSubscriptionPlanName()}
        onNavigateToPricing={handleNavigateToPricing}
      />
    </div>
  );
} 