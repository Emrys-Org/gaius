import { useWallet, useNetwork } from '@txnlab/use-wallet-react';
import { useAccountInfo, useNfd, NfdAvatar } from '@txnlab/use-wallet-ui-react';
import { formatNumber, formatShortAddress } from '@txnlab/utils-ts';
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { User, LogOut } from 'lucide-react';

interface WalletInfoProps {
  subscriptionPlan?: string | null;
}

export function WalletInfo({ subscriptionPlan = null }: WalletInfoProps) {
  const { activeAddress } = useWallet();
  const { activeNetwork } = useNetwork();
  const nfdQuery = useNfd();
  const accountQuery = useAccountInfo();
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Fetch admin info when address changes
  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (!activeAddress) return;
      
      try {
        const { data, error } = await supabase
          .from('organization_admins')
          .select('full_name, email')
          .eq('wallet_address', activeAddress)
          .single();
        
        if (error) {
          console.log('Not an admin or error fetching admin info:', error);
          setIsAdmin(false);
          return;
        }
        
        if (data) {
          setAdminName(data.full_name);
          setAdminEmail(data.email);
          setIsAdmin(true);
        }
      } catch (error) {
        console.error('Error fetching admin info:', error);
      }
    };
    
    fetchAdminInfo();
  }, [activeAddress]);

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
      
      // Redirect to home page or refresh
      window.location.href = '/';
      
    } catch (error: any) {
      console.error('Error signing out:', error);
      alert(`Error signing out: ${error.message}`);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (!activeAddress) {
    return (
      <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Connect Your Wallet
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Connect your Algorand wallet to view your NFD profile and balance
        </p>
      </div>
    );
  }

  if (nfdQuery.isLoading || accountQuery.isLoading) {
    return (
      <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
        <p className="text-gray-600 dark:text-gray-300">
          Loading wallet data...
        </p>
      </div>
    );
  }

  const nfd = nfdQuery.data ?? null;
  const accountInfo = accountQuery.data;
  const algoBalance = accountInfo ? Number(accountInfo.amount) / 1_000_000 : 0;

  return (
    <div className="p-8 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <NfdAvatar nfd={nfd} size={64} className="rounded-xl" />
          <div>
            {isAdmin && adminName ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <User size={16} className="text-blue-500" />
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Organization Admin
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {adminName}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  {formatShortAddress(activeAddress)}
                </p>
                {adminEmail && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {adminEmail}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    activeNetwork === 'mainnet' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                  }`}>
                    {activeNetwork === 'mainnet' ? 'MainNet' : 'TestNet'}
                  </div>
                  {subscriptionPlan && (
                    <div className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 rounded-full text-xs font-medium">
                      {subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1)} Plan
                    </div>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="mt-3 flex items-center gap-2 px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                >
                  {isSigningOut ? (
                    <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></div>
                  ) : (
                    <LogOut size={16} />
                  )}
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {nfd?.name || formatShortAddress(activeAddress)}
            </h2>
            {nfd?.name && (
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {formatShortAddress(activeAddress)}
              </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">Balance</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formatNumber(algoBalance, { fractionDigits: 4 })} ALGO
          </p>
        </div>
      </div>

      {nfd?.properties?.userDefined &&
        Object.keys(nfd.properties.userDefined).length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              NFD Properties
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(nfd.properties.userDefined).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg"
                  >
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      {key}
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {value}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        )}
    </div>
  );
}
