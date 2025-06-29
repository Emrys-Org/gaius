import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { OrganizationSignup } from './OrganizationSignup';
import { OrganizationSignin } from './OrganizationSignin';
import { PasswordReset } from './PasswordReset';

interface OrganizationAuthProps {
  onAuthSuccess?: () => void;
}

export function OrganizationAuth({ onAuthSuccess }: OrganizationAuthProps = {}) {
  const [authMode, setAuthMode] = useState<'signup' | 'signin' | 'reset'>('signup');
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const renderAuthComponent = () => {
    switch (authMode) {
      case 'signup':
        return <OrganizationSignup onSignUpSuccess={onAuthSuccess} />;
      case 'signin':
        return <OrganizationSignin onSignInSuccess={onAuthSuccess} />;
      case 'reset':
        return <PasswordReset 
          onCancel={() => setAuthMode('signin')} 
          onSuccess={() => setAuthMode('signin')} 
        />;
      default:
        return <OrganizationSignup onSignUpSuccess={onAuthSuccess} />;
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {authMode === 'signup' ? 'Create Organization Account' : 
           authMode === 'signin' ? 'Sign In to Your Organization' :
           'Reset Your Password'}
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {authMode === 'signup'
            ? 'Connect your wallet and create your organization account'
            : authMode === 'signin'
            ? 'Welcome back! Please sign in to continue'
            : 'Enter your email to receive a password reset link'}
        </p>
      </div>

      {renderAuthComponent()}

      <div className="mt-6 text-center">
        {authMode === 'signup' && (
          <button
            onClick={() => setAuthMode('signin')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            Already have an account? Sign in
          </button>
        )}
        
        {authMode === 'signin' && (
          <div className="space-y-2">
            <button
              onClick={() => setAuthMode('signup')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors block w-full"
            >
              Don't have an account? Sign up
            </button>
            <button
              onClick={() => setAuthMode('reset')}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors block w-full"
            >
              Forgot your password?
            </button>
          </div>
        )}
        
        {authMode === 'reset' && (
          <button
            onClick={() => setAuthMode('signin')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            Back to Sign In
          </button>
        )}
      </div>
    </div>
  );
} 