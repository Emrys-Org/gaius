import { NetworkId, useWallet, useNetwork } from '@txnlab/use-wallet-react'
import { WalletButton } from '@txnlab/use-wallet-ui-react'
import React from 'react'
import { useNavigate, useLocation } from 'react-router'

const Navbar = () => {
  const { activeAddress, activeWallet } = useWallet()
  const { activeNetwork, setActiveNetwork } = useNetwork()
  const navigate = useNavigate()
  const location = useLocation()

  // Handle network switching
  const handleNetworkChange = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const networkId = event.target.value as NetworkId
    try {
      // Disconnect wallet before switching networks to avoid connection issues
      if (activeWallet?.isConnected) {
        await activeWallet.disconnect()
      }

      await setActiveNetwork(networkId)

      // Show a message to the user to reconnect their wallet
      if (activeAddress) {
        alert(
          'Network switched successfully. Please reconnect your wallet for the new network.',
        )
      }
    } catch (error) {
      console.error('Failed to switch network:', error)
      alert('Failed to switch network. Please try again.')
    }
  }

  return (
    <header className="w-full bg-white dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
              Gaius
            </span>
            <nav className="hidden md:flex space-x-4">
              <button
                onClick={() => navigate('/')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === '/' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
              >
                Home
              </button>
              <button
                onClick={() => activeAddress && navigate('/loyalty-dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  !activeAddress
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                    : location.pathname === '/loyalty-dashboard'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
                disabled={!activeAddress}
                title={
                  !activeAddress
                    ? 'Connect your wallet to access the organization dashboard'
                    : ''
                }
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
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Network:
                </span>
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
  )
}

export default Navbar
