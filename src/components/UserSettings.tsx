import { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { supabase } from '../utils/supabase';
import { WalletInfo } from './WalletInfo';
import { ChangePassword } from './ChangePassword';
import { PasswordReset } from './PasswordReset';
import { Settings, KeyRound, Mail, User, AlertTriangle } from 'lucide-react';

interface UserSettingsProps {
  onBack?: () => void;
}

export function UserSettings({ onBack }: UserSettingsProps) {
  const { activeAddress } = useWallet();
  const [activeTab, setActiveTab] = useState<'account' | 'security'>('account');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!activeAddress) return;
      
      setIsLoading(true);
      
      try {
        // Get user data from Supabase
        const { data: userData, error: userError } = await supabase
          .from('organization_admins')
          .select('email, full_name, subscription_plan')
          .eq('wallet_address', activeAddress)
          .single();
        
        if (userError) {
          console.error('Error fetching user data:', userError);
          return;
        }
        
        if (userData) {
          setUserEmail(userData.email);
          setUserName(userData.full_name);
          setSubscriptionPlan(userData.subscription_plan);
          setIsAdmin(true);
        }
        
        // Also check current auth session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      } catch (error) {
        console.error('Error in fetchUserData:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [activeAddress]);

  const handlePasswordResetSuccess = () => {
    setShowPasswordReset(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-8">
        <Settings className="text-blue-500 mr-3" size={28} />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
      </div>
      
      {!activeAddress ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-300">Wallet not connected</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                Please connect your wallet to access your account settings.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <WalletInfo subscriptionPlan={subscriptionPlan} />
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('account')}
                  className={`px-6 py-4 text-sm font-medium flex items-center gap-2 ${
                    activeTab === 'account'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <User size={18} />
                  Account
                </button>
                
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-6 py-4 text-sm font-medium flex items-center gap-2 ${
                    activeTab === 'security'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <KeyRound size={18} />
                  Security
                </button>
              </nav>
            </div>
            
            <div className="p-6">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                </div>
              ) : (
                <>
                  {activeTab === 'account' && (
                    <div className="space-y-6">
                      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Account Information</h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Full Name
                          </label>
                          <div className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-md px-4 py-3">
                            <User size={18} className="text-gray-400 mr-2" />
                            <span>{userName || 'Not available'}</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email Address
                          </label>
                          <div className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-md px-4 py-3">
                            <Mail size={18} className="text-gray-400 mr-2" />
                            <span>{userEmail || 'Not available'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Wallet Address
                        </label>
                        <div className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-md px-4 py-3">
                          <span className="font-mono text-sm break-all">{activeAddress}</span>
                        </div>
                      </div>
                      
                      {isAdmin && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Subscription Plan
                          </label>
                          <div className="flex items-center bg-gray-50 dark:bg-gray-700 rounded-md px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              subscriptionPlan === 'free' ? 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200' : 
                              subscriptionPlan === 'basic' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                              subscriptionPlan === 'pro' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' :
                              'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                            }`}>
                              {subscriptionPlan ? subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1) : 'No Plan'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {activeTab === 'security' && (
                    <div className="space-y-6">
                      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Security Settings</h2>
                      
                      {showPasswordReset ? (
                        <PasswordReset 
                          onCancel={() => setShowPasswordReset(false)} 
                          onSuccess={handlePasswordResetSuccess} 
                        />
                      ) : (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                          <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">Password</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Change your password or reset it if you've forgotten it.
                          </p>
                          
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => setShowPasswordReset(true)}
                              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                            >
                              <KeyRound size={16} />
                              Reset Password
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {onBack && (
            <div className="mt-6">
              <button
                onClick={onBack}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 