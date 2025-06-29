import { useState } from 'react';
import { supabase } from '../utils/supabase';
import { Eye, EyeOff, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ChangePasswordProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ChangePassword({ onSuccess, onCancel }: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [nonceSent, setNonceSent] = useState(false);
  const [nonce, setNonce] = useState('');

  // Request reauthentication nonce
  const requestNonce = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.reauthenticate();
      
      if (error) {
        throw error;
      }
      
      setNonceSent(true);
      setSuccess(false);
    } catch (error: any) {
      setError(error.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate passwords
    if (!newPassword || !confirmPassword || !nonce) {
      setError('Please fill in all fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Update the user's password with the nonce
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        nonce: nonce
      });
      
      if (error) {
        throw error;
      }
      
      // Clear form and show success message
      setNewPassword('');
      setConfirmPassword('');
      setNonce('');
      setCurrentPassword('');
      setNonceSent(false);
      setSuccess(true);
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 2000); // Give user time to see success message
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <div className="flex items-center justify-center mb-6">
        <Lock className="text-blue-500 mr-2" size={24} />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Change Password</h2>
      </div>

      {!nonceSent ? (
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            To change your password, we'll send a verification code to your email.
          </p>
          
          <button
            onClick={requestNonce}
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending verification code...
              </>
            ) : (
              'Send Verification Code'
            )}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Verification Code
            </label>
            <input
              type="text"
              value={nonce}
              onChange={(e) => setNonce(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter code sent to your email"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Enter the verification code sent to your email
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
              >
                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-green-700 dark:text-green-300 text-sm">
                Password changed successfully!
              </p>
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setNonceSent(false);
                if (onCancel) onCancel();
              }}
              className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={isLoading || !nonce || !newPassword || !confirmPassword}
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
                'Update Password'
              )}
            </button>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Didn't receive the code? <button 
              type="button" 
              onClick={requestNonce}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Resend code
            </button>
          </p>
        </form>
      )}
    </div>
  );
} 