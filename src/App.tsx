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
import { HomePage } from './components/HomePage'
import { useState } from 'react'

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
  const [currentPage, setCurrentPage] = useState<'home' | 'loyalty-dashboard' | 'create-program'>('home');

  // Redirect to home if trying to access dashboard without wallet
  const handleNavigation = (page: 'home' | 'loyalty-dashboard' | 'create-program') => {
    if ((page === 'loyalty-dashboard' || page === 'create-program') && !activeAddress) {
      // Don't navigate to dashboard or create program without wallet connection
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
                <button 
                  onClick={() => handleNavigation('loyalty-dashboard')} 
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    !activeAddress 
                      ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50' 
                      : currentPage === 'loyalty-dashboard' 
                        ? 'text-blue-600 dark:text-blue-400' 
                        : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                  disabled={!activeAddress}
                  title={!activeAddress ? 'Connect your wallet to access the organization dashboard' : ''}
                >
                  Organization Dashboard
                  {!activeAddress && <span className="ml-1 text-xs">🔒</span>}
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
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
            {currentPage === 'home' ? (
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
                <WalletInfo />
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
            ) : (
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <WalletInfo />
                <LoyaltyProgramDashboard />
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