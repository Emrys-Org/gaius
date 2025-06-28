import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { OrganizationSignup } from './OrganizationSignup';
import { OrganizationSignin } from './OrganizationSignin';

interface OrganizationAuthProps {
  onAuthSuccess?: () => void;
}

export function OrganizationAuth({ onAuthSuccess }: OrganizationAuthProps = {}) {
  const [isSignup, setIsSignup] = useState(true);
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

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isSignup ? 'Create Organization Account' : 'Sign In to Your Organization'}
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {isSignup
            ? 'Connect your wallet and create your organization account'
            : 'Welcome back! Please sign in to continue'}
        </p>
      </div>

      {isSignup ? 
        <OrganizationSignup onSignUpSuccess={onAuthSuccess} /> : 
        <OrganizationSignin onSignInSuccess={onAuthSuccess} />
      }

      <div className="mt-6 text-center">
        <button
          onClick={() => setIsSignup(!isSignup)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
        >
          {isSignup
            ? 'Already have an account? Sign in'
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
} 