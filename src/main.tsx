import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import About from './components/About.tsx'
import Onboarding from './components/Onboarding.tsx'
import { MainLayout, MinimalLayout } from './components/Layout.tsx'
import { HomePage } from './components/HomePage.tsx'
import { LoyaltyProgramDashboard } from './components/LoyaltyProgramDashboard.tsx'
import { LoyaltyProgramMinter } from './components/LoyaltyProgramMinter.tsx'
import {
  WalletProvider,
  useWallet,
  NetworkId,
  WalletId,
  WalletManager,
} from '@txnlab/use-wallet-react'
import { WalletUIProvider } from '@txnlab/use-wallet-ui-react'

// Protected route wrapper
function RequireWallet({ children }: { children: JSX.Element }) {
  const { activeAddress } = useWallet()
  if (!activeAddress) {
    return <Navigate to="/onboarding" replace />
  }
  return children
}

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

const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'loyalty-dashboard',
        element: (
          <RequireWallet>
            <LoyaltyProgramDashboard />
          </RequireWallet>
        ),
      },
      {
        path: 'create-program',
        element: (
          <RequireWallet>
            <LoyaltyProgramMinter />
          </RequireWallet>
        ),
      },
    ],
  },
  {
    element: <MinimalLayout />,
    children: [
      { path: 'about', element: <About /> },
      { path: 'onboarding', element: <Onboarding /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider manager={walletManager}>
      <WalletUIProvider>
        <div className="min-h-screen bg-white dark:bg-[#001324] text-gray-900 dark:text-gray-100">
          <RouterProvider router={router} />
        </div>
      </WalletUIProvider>
    </WalletProvider>
  </StrictMode>,
)
