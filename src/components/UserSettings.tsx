import { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { supabase } from '../utils/supabase';
import { ChangePassword } from './ChangePassword';
import { Settings, Lock, User, ChevronRight, ArrowLeft } from 'lucide-react';

interface UserSettingsProps {
  onClose?: () => void;
}

export function UserSettings({ onClose }: UserSettingsProps) {
  const { activeAddress } = useWallet();
  const [activeSection, setActiveSection] = useState<'main' | 'password'>('main');
  const [adminInfo, setAdminInfo] = useState<{name: string; email: string} | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch admin info
  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (!activeAddress) return;
      
      setIsLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('organization_admins')
          .select('full_name, email')
          .eq('wallet_address', activeAddress)
          .single();
        
        if (error) {
          console.error('Error fetching admin info:', error);
          return;
        }
        
        if (data) {
          setAdminInfo({
            name: data.full_name,
            email: data.email
          });
        }
      } catch (error) {
        console.error('Error fetching admin info:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAdminInfo();
  }, [activeAddress]);

  // Handle password change success
  const handlePasswordChangeSuccess = () => {
    setActiveSection('main');
  };

  // Render main settings menu
  const renderMainSettings = () => (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Settings className="text-blue-500 mr-2" size={24} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Account Settings</h2>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ArrowLeft size={20} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* User Info Section */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                <User className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{adminInfo?.name || 'Organization Admin'}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{adminInfo?.email || 'No email found'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                  {activeAddress ? `${activeAddress.substring(0, 8)}...${activeAddress.substring(activeAddress.length - 4)}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Settings Options */}
          <div className="space-y-2">
            <button
              onClick={() => setActiveSection('password')}
              className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center">
                <Lock className="text-gray-500 dark:text-gray-400 mr-3" size={20} />
                <div className="text-left">
                  <h3 className="font-medium text-gray-900 dark:text-white">Change Password</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Update your account password</p>
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={20} />
            </button>
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800/50 rounded-xl shadow-md p-6">
      {activeSection === 'main' ? (
        renderMainSettings()
      ) : activeSection === 'password' ? (
        <div>
          <button 
            onClick={() => setActiveSection('main')}
            className="mb-6 flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft size={18} className="mr-1" />
            <span>Back to Settings</span>
          </button>
          <ChangePassword 
            onSuccess={handlePasswordChangeSuccess}
            onCancel={() => setActiveSection('main')}
          />
        </div>
      ) : null}
    </div>
  );
} 