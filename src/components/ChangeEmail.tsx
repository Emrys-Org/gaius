import { useState } from 'react';
import { supabase } from '../utils/supabase';
import { AlertTriangle, CheckCircle2, Mail } from 'lucide-react';

interface ChangeEmailProps {
  currentEmail: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ChangeEmail({ currentEmail, onSuccess, onCancel }: ChangeEmailProps) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!newEmail) {
      setError('Please enter your new email address');
      return;
    }

    if (!password) {
      setError('Please enter your password for verification');
      return;
    }

    if (newEmail === currentEmail) {
      setError('New email is the same as your current email');
      return;
    }

    setIsLoading(true);

    try {
      // First verify the user's password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail || '',
        password
      });

      if (signInError) {
        throw new Error('Incorrect password. Please try again.');
      }

      // Update the email in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (updateError) {
        throw updateError;
      }

      // Update the email in the organization_admins table
      if (currentEmail) {
        const { error: dbUpdateError } = await supabase
          .from('organization_admins')
          .update({ email: newEmail })
          .eq('email', currentEmail);

        if (dbUpdateError) {
          console.error('Error updating email in database:', dbUpdateError);
          // Continue anyway since the auth email was updated successfully
        }
      }

      setSuccess(true);
      setNewEmail('');
      setPassword('');
      
      // Call success callback after a delay
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 3000);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <div className="flex items-center justify-center mb-6">
        <Mail className="text-blue-500 mr-2" size={24} />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Change Email Address</h2>
      </div>
      
      {!success ? (
        <form onSubmit={handleChangeEmail} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Email
            </label>
            <input
              type="email"
              value={currentEmail || ''}
              disabled
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Email Address
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter your new email address"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password Verification
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter your current password"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              For security reasons, please enter your current password
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !newEmail || !password}
              className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                'Update Email'
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Verification Email Sent</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            We've sent a verification link to <span className="font-medium">{newEmail}</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Please check your email and click the verification link to complete the process
          </p>
          <button
            onClick={onCancel}
            className="mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back to Settings
          </button>
        </div>
      )}
    </div>
  );
} 