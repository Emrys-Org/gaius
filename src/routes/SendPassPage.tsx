import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet, useNetwork } from '@txnlab/use-wallet-react';
import { supabase } from '../utils/supabase';
import { WalletInfo } from '../components/WalletInfo';
import { LoyaltyPassSender } from '../components/LoyaltyPassSender';
import { checkSubscription } from '../utils/subscription';
import { getAlgodClient } from '../utils/algod';
import { getIPFSGatewayURL } from '../utils/pinata';

export function SendPassPage() {
  const { activeAddress } = useWallet();
  const { activeNetwork } = useNetwork();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const [userLoyaltyPrograms, setUserLoyaltyPrograms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // Fetch user loyalty programs
  useEffect(() => {
    const fetchUserLoyaltyPrograms = async () => {
      if (!activeAddress) return;
      
      setIsLoading(true);
      
      try {
        const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
        const algodClient = getAlgodClient(networkType);
        
        const accountInfo = await algodClient.accountInformation(activeAddress).do();
        const assets = accountInfo.assets || [];
        
        const programsInfo: any[] = [];
        
        for (const asset of assets) {
          if (typeof asset.amount === 'bigint' ? asset.amount === 0n : asset.amount === 0) continue;
          
          try {
            const assetInfo = await algodClient.getAssetByID(asset.assetId).do();
            const params = assetInfo.params;
            
            const totalSupply = typeof params.total === 'bigint' ? Number(params.total) : Number(params.total);
            const isLoyaltyProgram = totalSupply === 1 && params.decimals === 0;
            
            if (isLoyaltyProgram) {
              let url = params.url || '';
              let imageUrl = url;
              let metadata = null;
              
              if (url && (url.startsWith('ipfs://') || url.includes('/ipfs/'))) {
                imageUrl = getIPFSGatewayURL(url);
                
                try {
                  const response = await fetch(imageUrl);
                  if (response.ok) {
                    metadata = await response.json();
                    if (metadata.image) {
                      imageUrl = getIPFSGatewayURL(metadata.image);
                    }
                  }
                } catch (e) {
                  console.warn(`Failed to fetch metadata for asset ${asset.assetId}`, e);
                }
              }
              
              programsInfo.push({
                id: typeof asset.assetId === 'bigint' ? Number(asset.assetId) : asset.assetId,
                name: params.name || 'Unnamed Loyalty Program',
                imageUrl,
                metadata
              });
            }
          } catch (error) {
            console.error(`Error fetching asset ${asset.assetId} info:`, error);
          }
        }
        
        setUserLoyaltyPrograms(programsInfo);
      } catch (error) {
        console.error('Error fetching loyalty programs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeAddress) {
      fetchUserLoyaltyPrograms();
    }
  }, [activeAddress, activeNetwork]);

  // Get subscription plan name for display
  const getSubscriptionPlanName = () => {
    if (!subscription || !subscription.isActive) return null;
    return subscription.plan;
  };

  const handlePassSent = (assetId: number) => {
    console.log('Pass sent with asset ID:', assetId);
    // You can add additional logic here, like showing a success message
  };

  if (!activeAddress) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Please connect your wallet to send loyalty passes
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
      <div className="mt-8">
        <LoyaltyPassSender 
          loyaltyPrograms={userLoyaltyPrograms}
          onPassSent={handlePassSent}
        />
      </div>
    </div>
  );
} 