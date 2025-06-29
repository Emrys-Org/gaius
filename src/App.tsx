import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider,
  useWallet,
  useNetwork,
} from '@txnlab/use-wallet-react'
import { WalletUIProvider, WalletButton } from '@txnlab/use-wallet-ui-react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import algosdk from 'algosdk'
import { getAlgodClient } from './utils/algod'
import { getIPFSGatewayURL } from './utils/pinata'
import { User, LogOut } from 'lucide-react'
import { supabase } from './utils/supabase'
import { checkSubscription, SubscriptionDetails } from './utils/subscription'
import { NetworkProvider } from './utils/NetworkContext'

// Import route components
import {
  HomePage,
  DashboardPage,
  CreateProgramPage,
  SendPassPage,
  PricingPage,
  AuthPage,
  SettingsPage
} from './routes'

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
  const [session, setSession] = useState<any>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // Effect to fetch admin name when address changes
  useEffect(() => {
    if (activeAddress && session) {
      fetchAdminName();
    }
  }, [activeAddress, session]);

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
      navigate('/');
      
      // Show success message
      alert('You have been signed out successfully');
    } catch (error: any) {
      console.error('Error signing out:', error);
      alert(`Error signing out: ${error.message}`);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <NetworkProvider>
      <div className="min-h-screen bg-white dark:bg-[#001324] text-gray-900 dark:text-gray-100">
        {/* Header */}
        <header className="w-full bg-white dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700/50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-8">
                <Link to="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
                  Gaius
                </Link>
                <nav className="hidden md:flex space-x-4">
                  <Link 
                    to="/" 
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === '/' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
                  >
                    Home
                  </Link>
                  {!session && (
                    <Link 
                      to="/auth" 
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === '/auth' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
                    >
                      Sign In / Sign Up
                    </Link>
                  )}
                  {session && (
                    <Link 
                      to="/dashboard" 
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === '/dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
                    >
                      Dashboard
                    </Link>
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
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/create-program" element={<CreateProgramPage />} />
            <Route path="/send-pass" element={<SendPassPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/reset-password-update" element={<AuthPage />} />
          </Routes>
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
    </NetworkProvider>
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