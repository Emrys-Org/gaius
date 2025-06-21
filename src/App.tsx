import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider,
} from '@txnlab/use-wallet-react'
import { WalletUIProvider, WalletButton } from '@txnlab/use-wallet-ui-react'
import { WalletInfo } from './components/WalletInfo'
import { TextWithCopy } from './components/TextWithCopy'
import { NFTDashboard } from './components/NFTDashboard'
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
      options: { projectId: 'fcfde0713d43baa0d23be0773c80a72b' },
    },
  ],
  defaultNetwork: NetworkId.TESTNET,
})

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'nft-dashboard'>('home');

  return (
    <WalletProvider manager={walletManager}>
      <WalletUIProvider>
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
                      onClick={() => setCurrentPage('home')} 
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPage === 'home' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
                    >
                      Home
                    </button>
                    <button 
                      onClick={() => setCurrentPage('nft-dashboard')} 
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPage === 'nft-dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
                    >
                      NFT Dashboard
                    </button>
                  </nav>
                </div>
                <div>
                  <WalletButton />
                </div>
              </div>
            </div>
          </header>
          {/* Main content area */}
          <main>
            {currentPage === 'home' ? (
              <HomePage />
            ) : (
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <WalletInfo />
                <NFTDashboard />
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
      </WalletUIProvider>
    </WalletProvider>
  )
}

export default App