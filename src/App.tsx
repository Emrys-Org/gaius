import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider,
  useWallet,
  useNetwork,
} from '@txnlab/use-wallet-react'
import { WalletUIProvider, WalletButton } from '@txnlab/use-wallet-ui-react'
import { WalletInfo } from './components/WalletInfo'
import { TextWithCopy } from './components/TextWithCopy'
import { LoyaltyProgramDashboard } from './components/LoyaltyProgramDashboard'
import { LoyaltyProgramMinter } from './components/LoyaltyProgramMinter'
import { LoyaltyPassSender } from './components/LoyaltyPassSender'
import { PricingPlans } from './components/PricingPlans'
import { HomePage } from './components/HomePage'
import { useState, useEffect } from 'react'
import algosdk from 'algosdk'
import { getAlgodClient } from './utils/algod'
import { getIPFSGatewayURL } from './utils/pinata'
import { Check, User, LogOut } from 'lucide-react'
import { OrganizationAuth } from './components/OrganizationAuth'
import { supabase } from './utils/supabase'
import { checkSubscription, SubscriptionDetails } from './utils/subscription'

const walletManager = new WalletManager({
  wallets: [
    WalletId.PERA,
    WalletId.DEFLY,
    WalletId.LUTE,
    WalletId.EXODUS,
    {
      id: WalletId.WALLETCONNECT,
      options: { projectId: import.meta.env.VITE_PROJECT_ID },
    },
  ],
  defaultNetwork: NetworkId.TESTNET,
})

function AppContent() {
  const { activeAddress, activeWallet } = useWallet();
  const { activeNetwork, setActiveNetwork } = useNetwork();
  const [currentPage, setCurrentPage] = useState<'home' | 'loyalty-dashboard' | 'create-program' | 'send-pass' | 'pricing' | 'auth'>('home');
  const [userLoyaltyPrograms, setUserLoyaltyPrograms] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [session, setSession] = useState<any>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);

  // Listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && activeAddress) {
        fetchAdminName();
        // Immediate redirect to dashboard if signed in
        setCurrentPage('loyalty-dashboard');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session && activeAddress) {
        fetchAdminName();
        // Immediate redirect to dashboard if signed in
        setCurrentPage('loyalty-dashboard');
      } else if (!session) {
        setAdminName(null);
        // Redirect to home if signed out
        setCurrentPage('home');
      }
    });

    return () => subscription.unsubscribe();
  }, [activeAddress]);

  // Fetch admin name from Supabase
  const fetchAdminName = async () => {
    if (!activeAddress) return;
    
    try {
      const { data, error } = await supabase
        .from('organization_admins')
        .select('full_name')
        .eq('wallet_address', activeAddress)
        .single();
      
      if (error) {
        console.error('Error fetching admin name:', error);
        return;
      }
      
      if (data) {
        setAdminName(data.full_name);
      }
    } catch (error) {
      console.error('Error fetching admin name:', error);
    }
  };

  // Fetch subscription status from blockchain when address or network changes
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
  }, [activeAddress, activeNetwork]);

  // Redirect to auth if trying to access protected pages without being authenticated
  useEffect(() => {
    if (!session && (currentPage === 'loyalty-dashboard' || currentPage === 'create-program' || currentPage === 'send-pass')) {
      setCurrentPage('auth');
    }
  }, [session, currentPage]);

  // Fetch user loyalty programs
  const fetchUserLoyaltyPrograms = async () => {
    if (!activeAddress) return;
    
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
    }
  };

  // Fetch loyalty programs when user navigates to send-pass page
  useEffect(() => {
    if (activeAddress && currentPage === 'send-pass') {
      fetchUserLoyaltyPrograms();
    }
  }, [activeAddress, currentPage, activeNetwork]);

  // Effect to fetch admin name when address changes
  useEffect(() => {
    if (activeAddress && session) {
      fetchAdminName();
    }
  }, [activeAddress, session]);

  // Redirect to home if trying to access dashboard without wallet
  const handleNavigation = (page: 'home' | 'loyalty-dashboard' | 'create-program' | 'send-pass' | 'pricing' | 'auth') => {
    if ((page === 'loyalty-dashboard' || page === 'create-program' || page === 'send-pass') && !activeAddress) {
      return;
    }
    
    if ((page === 'loyalty-dashboard' || page === 'create-program' || page === 'send-pass') && !session) {
      setCurrentPage('auth');
      return;
    }
    
    setCurrentPage(page);
  };

  // Handle network switching
  const handleNetworkChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const networkId = event.target.value as NetworkId;
    try {
      // Disconnect wallet before switching networks to avoid connection issues
      if (activeWallet?.isConnected) {
        await activeWallet.disconnect();
      }
      
      await setActiveNetwork(networkId);
      
      // Show a message to the user to reconnect their wallet
      if (activeAddress) {
        alert('Network switched successfully. Please reconnect your wallet for the new network.');
      }
    } catch (error) {
      console.error('Failed to switch network:', error);
      alert('Failed to switch network. Please try again.');
    }
  };

  // Handle subscription completion
  const handleSubscriptionComplete = (plan: string) => {
    // Refresh subscription data from blockchain
    if (activeAddress) {
      checkSubscription(activeAddress).then(subscriptionDetails => {
        setSubscription(subscriptionDetails);
      });
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Sign out from all devices
      });
      
      if (error) {
        throw error;
      }
      
      // Reset state
      setAdminName(null);
      setSession(null);
      
      // Redirect to home page
      setCurrentPage('home');
      
      // Show success message
      alert('You have been signed out successfully');
    } catch (error: any) {
      console.error('Error signing out:', error);
      alert(`Error signing out: ${error.message}`);
    } finally {
      setIsSigningOut(false);
    }
  };

  // Get subscription plan name for display
  const getSubscriptionPlanName = () => {
    if (!subscription || !subscription.isActive) return null;
    return subscription.plan;
  };

  return (
        <div className="min-h-screen bg-white dark:bg-[#001324] text-gray-900 dark:text-gray-100">
          {/* Header */}
          <header className="w-full bg-white dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700/50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
                Gaius
                  </span>
              <nav className="hidden md:flex space-x-4">
                <button 
                  onClick={() => handleNavigation('home')} 
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPage === 'home' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
                >
                  Home
                </button>
                {!session && (
                  <button 
                    onClick={() => handleNavigation('auth')} 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPage === 'auth' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
                  >
                    Sign In / Sign Up
                  </button>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {/* Admin Name Display */}
              {session && adminName && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full">
                  <User size={16} />
                  <span className="text-sm font-medium">{adminName}</span>
                </div>
              )}
              
              {/* Sign Out Button - only show when signed in */}
              {session && (
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  title="Sign out"
                >
                  {isSigningOut ? (
                    <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                  ) : (
                    <LogOut size={16} />
                  )}
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              )}
              
              {/* Network Selector - only show when wallet is connected */}
              {activeAddress && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Network:</span>
                  <select 
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={activeNetwork}
                    onChange={handleNetworkChange}
                  >
                    <option value={NetworkId.TESTNET}>TestNet</option>
                    <option value={NetworkId.MAINNET}>MainNet</option>
                  </select>
                </div>
              )}
                  <WalletButton />
                </div>
              </div>
            </div>
          </header>
          {/* Main content area */}
          <main>
            {currentPage === 'auth' ? (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <OrganizationAuth 
                  onAuthSuccess={() => handleNavigation('loyalty-dashboard')} 
                />
              </div>
            ) : currentPage === 'home' ? (
              <HomePage onNavigate={handleNavigation} />
            ) : currentPage === 'create-program' ? (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-6">
                  <button
                    onClick={() => handleNavigation('home')}
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    ← Back to Home
                  </button>
                </div>
            <WalletInfo subscriptionPlan={getSubscriptionPlanName()} />
                <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 my-8">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold">Create Your Loyalty Program</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Network:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        activeNetwork === 'mainnet' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                      }`}>
                        {activeNetwork === 'mainnet' ? 'MainNet' : 'TestNet'}
                      </span>
              </div>  
                </div>
                  <LoyaltyProgramMinter onLoyaltyProgramMinted={() => handleNavigation('loyalty-dashboard')} />
                </div>
              </div>
            ) : currentPage === 'send-pass' ? (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-6">
                  <button
                    onClick={() => handleNavigation('home')}
                    className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    ← Back to Home
                  </button>
                </div>
                <WalletInfo subscriptionPlan={getSubscriptionPlanName()} />
                <div className="mt-8">
                  <LoyaltyPassSender 
                    loyaltyPrograms={userLoyaltyPrograms}
                    onPassSent={(assetId) => {
                      console.log('Pass sent with asset ID:', assetId);
                      // You can add additional logic here, like refreshing the dashboard
                    }}
                  />
                </div>
              </div>
            ) : currentPage === 'pricing' ? (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-6">
                  <button
                    onClick={() => handleNavigation('home')}
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
            ) : (
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <WalletInfo subscriptionPlan={getSubscriptionPlanName()} />
                <LoyaltyProgramDashboard 
                  subscriptionPlan={getSubscriptionPlanName()}
                  onNavigateToPricing={() => handleNavigation('pricing')}
                />
              </div>
            )}
          </main>
      
      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700/50 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
                Gaius
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                All-in-One Loyalty Program
              </p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                Terms
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                Privacy
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <WalletProvider manager={walletManager}>
      <WalletUIProvider>
        <AppContent />
      </WalletUIProvider>
    </WalletProvider>
  );
}

export default App