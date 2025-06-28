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
import { LoadingSpinner } from './components/LoadingSpinner'
import { useState, useEffect, useCallback } from 'react'
import { getAlgodClient } from './utils/algod'
import { getIPFSGatewayURL } from './utils/pinata'
import { Check, User } from 'lucide-react'
import { OrganizationAuth } from './components/OrganizationAuth'
import { supabase } from './utils/supabase'
import { motion, AnimatePresence } from 'framer-motion'

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

interface LoyaltyProgram {
  id: number
  name: string
  imageUrl: string
  metadata: Record<string, unknown> | null
}

function AppContent() {
  const { activeAddress, activeWallet } = useWallet()
  const { activeNetwork, setActiveNetwork } = useNetwork()
  const [currentPage, setCurrentPage] = useState<
    | 'home'
    | 'loyalty-dashboard'
    | 'create-program'
    | 'send-pass'
    | 'pricing'
    | 'auth'
  >('home')
  const [userLoyaltyPrograms, setUserLoyaltyPrograms] = useState<any[]>([])
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null)
  const [session, setSession] = useState<any>(null)
  const [adminName, setAdminName] = useState<string | null>(null)

  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false)
  const [isPageTransitioning, setIsPageTransitioning] = useState(false)

  // Listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchAdminName()
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchAdminName()
      } else {
        setAdminName(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch admin name from Supabase
  const fetchAdminName = async () => {
    if (!activeAddress) return

    try {
      const { data, error } = await supabase
        .from('organization_admins')
        .select('full_name')
        .eq('wallet_address', activeAddress)
        .single()

      if (error) {
        console.error('Error fetching admin name:', error)
        return
      }

      if (data) {
        setAdminName(data.full_name)
      }
    } catch (error) {
      console.error('Error fetching admin name:', error)
    }
  }

  // Redirect to auth if trying to access protected pages without being authenticated
  useEffect(() => {
    if (
      !session &&
      (currentPage === 'loyalty-dashboard' ||
        currentPage === 'create-program' ||
        currentPage === 'send-pass')
    ) {
      setCurrentPage('auth')
    }
  }, [session, currentPage])

  // Fetch user loyalty programs
  const fetchUserLoyaltyPrograms = useCallback(async () => {
    if (!activeAddress) return

    setIsLoadingPrograms(true)
    try {
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet'
      const algodClient = getAlgodClient(networkType)

      const accountInfo = await algodClient
        .accountInformation(activeAddress)
        .do()
      const assets = accountInfo.assets || []

      const programsInfo: LoyaltyProgram[] = []

      for (const asset of assets) {
        if (
          typeof asset.amount === 'bigint'
            ? asset.amount === 0n
            : asset.amount === 0
        )
          continue

        try {
          const assetInfo = await algodClient.getAssetByID(asset.assetId).do()
          const params = assetInfo.params

          const totalSupply =
            typeof params.total === 'bigint'
              ? Number(params.total)
              : Number(params.total)
          const isLoyaltyProgram = totalSupply === 1 && params.decimals === 0

          if (isLoyaltyProgram) {
            const url = params.url || ''
            let imageUrl = url
            let metadata = null

            if (url && (url.startsWith('ipfs://') || url.includes('/ipfs/'))) {
              imageUrl = getIPFSGatewayURL(url)

              try {
                const response = await fetch(imageUrl)
                if (response.ok) {
                  metadata = await response.json()
                  if (metadata.image) {
                    imageUrl = getIPFSGatewayURL(metadata.image)
                  }
                }
              } catch (e) {
                console.warn(
                  `Failed to fetch metadata for asset ${asset.assetId}`,
                  e,
                )
              }
            }

            programsInfo.push({
              id:
                typeof asset.assetId === 'bigint'
                  ? Number(asset.assetId)
                  : asset.assetId,
              name: params.name || 'Unnamed Loyalty Program',
              imageUrl,
              metadata,
            })
          }
        } catch (error) {
          console.error(`Error fetching asset ${asset.assetId} info:`, error)
        }
      }

      setUserLoyaltyPrograms(programsInfo)
    } catch (error) {
      console.error('Error fetching loyalty programs:', error)
    } finally {
      setIsLoadingPrograms(false)
    }
  }, [activeAddress, activeNetwork])

  // Fetch loyalty programs when user navigates to send-pass page
  useEffect(() => {
    if (activeAddress && currentPage === 'send-pass') {
      fetchUserLoyaltyPrograms()
    }
  }, [activeAddress, currentPage, activeNetwork])

  // Effect to fetch admin name when address changes
  useEffect(() => {
    if (activeAddress && session) {
      fetchAdminName()
    }
  }, [activeAddress, session])

  // Redirect to home if trying to access dashboard without wallet
  const handleNavigation = (
    page:
      | 'home'
      | 'loyalty-dashboard'
      | 'create-program'
      | 'send-pass'
      | 'pricing'
      | 'auth',
  ) => {
    if (
      (page === 'loyalty-dashboard' ||
        page === 'create-program' ||
        page === 'send-pass') &&
      !activeAddress
    ) {
      return
    }

    if (
      (page === 'loyalty-dashboard' ||
        page === 'create-program' ||
        page === 'send-pass') &&
      !session
    ) {
      setCurrentPage('auth')
      return
    }

    setIsPageTransitioning(true)
    // Add a small delay for smooth transition
    setTimeout(() => {
      setCurrentPage(page)
      setIsPageTransitioning(false)
    }, 150)
  }

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

  // Page transition variants
  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -20 },
  }

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.3,
  }

  // Handle subscription completion
  const handleSubscriptionComplete = (plan: string) => {
    setSubscriptionPlan(plan)
    // You could store this in localStorage or a database in a real application
    console.log(`Subscription completed for plan: ${plan}`)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#001324] text-gray-900 dark:text-gray-100">
      {/* Header */}
      <motion.header
        className="w-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700/50 sticky top-0 z-50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <div className="flex items-center space-x-3">
                <motion.img
                  src="/gaiuslogo-app.png"
                  alt="Gaius Logo"
                  className="h-10 w-auto logo-bounce"
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                />
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
                  Gaius
                </span>
              </div>

              <nav className="hidden md:flex space-x-1">
                <motion.button
                  onClick={() => handleNavigation('home')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-ring ${
                    currentPage === 'home'
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Home
                </motion.button>
                <motion.button
                  onClick={() => handleNavigation('loyalty-dashboard')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-ring ${
                    !activeAddress
                      ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                      : currentPage === 'loyalty-dashboard'
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  disabled={!activeAddress}
                  title={
                    !activeAddress
                      ? 'Connect your wallet to access the organization dashboard'
                      : ''
                  }
                  whileHover={activeAddress ? { scale: 1.05 } : {}}
                  whileTap={activeAddress ? { scale: 0.95 } : {}}
                >
                  Organization Dashboard
                  {!activeAddress && <span className="ml-1 text-xs">🔒</span>}
                </motion.button>
                <motion.button
                  onClick={() => handleNavigation('send-pass')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-ring ${
                    !activeAddress
                      ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                      : currentPage === 'send-pass'
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  disabled={!activeAddress}
                  title={
                    !activeAddress
                      ? 'Connect your wallet to send loyalty passes'
                      : ''
                  }
                  whileHover={activeAddress ? { scale: 1.05 } : {}}
                  whileTap={activeAddress ? { scale: 0.95 } : {}}
                >
                  Send Pass
                  {!activeAddress && <span className="ml-1 text-xs">🔒</span>}
                </motion.button>
                <button
                  onClick={() => handleNavigation('pricing')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPage === 'pricing' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
                >
                  Pricing
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
            </motion.div>

            <motion.div
              className="flex items-center gap-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              {/* Network Selector - only show when wallet is connected */}
              {activeAddress && (
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.4 }}
                >
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Network:
                  </span>
                  <select
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus-ring transition-all duration-200 hover:border-blue-500 dark:hover:border-blue-400"
                    value={activeNetwork}
                    onChange={handleNetworkChange}
                  >
                    <option value={NetworkId.TESTNET}>TestNet</option>
                    <option value={NetworkId.MAINNET}>MainNet</option>
                  </select>
                </motion.div>
              )}
              <WalletButton />
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Main content area */}
      <main className="relative">
        <AnimatePresence mode="wait">
          {isPageTransitioning ? (
            <motion.div
              key="loading"
              className="flex items-center justify-center min-h-[60vh]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <LoadingSpinner size="xl" />
            </motion.div>
          ) : currentPage === 'home' ? (
            <motion.div
              key="home"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              transition={pageTransition}
            >
              <HomePage onNavigate={handleNavigation} />
            </motion.div>
          ) : currentPage === 'create-program' ? (
            <motion.div
              key="create-program"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              transition={pageTransition}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
            >
              <motion.div
                className="mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.button
                  onClick={() => handleNavigation('home')}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all duration-200 hover:gap-3"
                  whileHover={{ x: -5 }}
                >
                  ← Back to Home
                </motion.button>
              </motion.div>
              <WalletInfo />
              <motion.div
                className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 my-8 card-hover"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-bold">
                    Create Your Loyalty Program
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Network:
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
                        activeNetwork === 'mainnet'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                      }`}
                    >
                      {activeNetwork === 'mainnet' ? 'MainNet' : 'TestNet'}
                    </span>
                  </div>
                </div>
                <LoyaltyProgramMinter
                  onLoyaltyProgramMinted={() =>
                    handleNavigation('loyalty-dashboard')
                  }
                />
              </motion.div>
            </motion.div>
          ) : currentPage === 'send-pass' ? (
            <motion.div
              key="send-pass"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              transition={pageTransition}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
            >
              <motion.div
                className="mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.button
                  onClick={() => handleNavigation('home')}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all duration-200 hover:gap-3"
                  whileHover={{ x: -5 }}
                >
                  ← Back to Home
                </motion.button>
              </motion.div>
              <WalletInfo />
              <motion.div
                className="mt-8"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {isLoadingPrograms ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner
                      size="lg"
                      text="Loading your loyalty programs..."
                    />
                  </div>
                ) : (
                  <LoyaltyPassSender
                    loyaltyPrograms={userLoyaltyPrograms}
                    onPassSent={(assetId) => {
                      console.log('Pass sent with asset ID:', assetId)
                      // You can add additional logic here, like refreshing the dashboard
                    }}
                  />
                )}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="loyalty-dashboard"
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              transition={pageTransition}
              className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
            >
              <WalletInfo />
              <LoyaltyProgramDashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <motion.footer
        className="bg-white dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700/50 py-8"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <motion.div
              className="mb-4 md:mb-0"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center space-x-2">
                <img
                  src="/gaiuslogo-app.png"
                  alt="Gaius Logo"
                  className="h-6 w-auto"
                />
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
                  Gaius
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                All-in-One Loyalty Program
              </p>
            </motion.div>
            <motion.div
              className="flex space-x-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <a
                href="#"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors duration-200"
              >
                Terms
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors duration-200"
              >
                Privacy
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors duration-200"
              >
                Support
              </a>
            </motion.div>
          </div>
        </div>
      </motion.footer>
    </div>
  )
}

function App() {
  return (
    <WalletProvider manager={walletManager}>
      <WalletUIProvider>
        <AppContent />
      </WalletUIProvider>
    </WalletProvider>
  )
}

export default App
