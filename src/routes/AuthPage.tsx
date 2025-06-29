import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import { supabase } from '../utils/supabase';
import { OrganizationAuth } from '../components/OrganizationAuth';
import { ChangePassword } from '../components/ChangePassword';

export function AuthPage() {
  const { activeAddress } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  // Check if user is already authenticated and if we're in a password reset flow
  useEffect(() => {
    // Check if we're on the password reset page
    if (location.pathname === '/reset-password-update') {
      setIsPasswordReset(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && activeAddress && !isPasswordReset) {
        // User is already authenticated, redirect to dashboard
        navigate('/dashboard');
      }
    });
  }, [activeAddress, navigate, location.pathname, isPasswordReset]);

  const handleAuthSuccess = () => {
    navigate('/dashboard');
  };

  const handlePasswordUpdateSuccess = () => {
    // Redirect to login page after password is updated
    navigate('/auth');
  };

  // If we're in password reset flow, show the change password component
  if (isPasswordReset) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-center mb-8">Reset Your Password</h1>
          <ChangePassword onSuccess={handlePasswordUpdateSuccess} />
        </div>
      </div>
    );
  }

  if (!activeAddress) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Please connect your wallet to authenticate
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <OrganizationAuth onAuthSuccess={handleAuthSuccess} />
    </div>
  );
} 