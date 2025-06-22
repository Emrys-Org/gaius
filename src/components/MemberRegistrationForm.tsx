import { useState } from 'react';
import { User, Phone, Mail, Wallet, Shield, Check, AlertCircle } from 'lucide-react';

// For now, we'll create mock functions until the API is set up
const mockRegisterMemberAndSendOTP = async (data: any) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate success response
  return {
    success: true,
    message: "OTP sent successfully",
    userId: "mock-user-id",
    otp: "000000" // Mock OTP for development
  };
};

const mockVerifyOTPAndCreateMember = async (data: any) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate success response
  return {
    success: true,
    message: "Member registered successfully",
    member: {
      id: "mock-member-id",
      walletAddress: data.memberData.walletAddress,
      email: data.memberData.email,
      phone: data.memberData.phone,
      fullName: data.memberData.fullName,
      isVerified: true,
      createdAt: new Date().toISOString()
    }
  };
};

interface MemberRegistrationData {
  walletAddress: string;
  email: string;
  phone: string;
  fullName: string;
  loyaltyProgramId?: string;
}

interface MemberRegistrationFormProps {
  loyaltyProgramId?: string;
  onSuccess?: (member: any) => void;
  onCancel?: () => void;
}

type Step = 'registration' | 'otp-verification' | 'success';

export function MemberRegistrationForm({ loyaltyProgramId, onSuccess, onCancel }: MemberRegistrationFormProps) {
  const [currentStep, setCurrentStep] = useState<Step>('registration');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<MemberRegistrationData>({
    walletAddress: '',
    email: '',
    phone: '',
    fullName: '',
    loyaltyProgramId: loyaltyProgramId || '',
  });
  
  // OTP data
  const [otpCode, setOtpCode] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  
  // Created member
  const [createdMember, setCreatedMember] = useState<any>(null);

  const handleInputChange = (field: keyof MemberRegistrationData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.walletAddress.trim()) {
      setError('Wallet address is required');
      return false;
    }
    
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Valid email address is required');
      return false;
    }
    
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    
    if (!formData.fullName.trim()) {
      setError('Full name is required');
      return false;
    }
    
    // Basic wallet address validation (Algorand addresses are 58 characters)
    if (formData.walletAddress.length !== 58) {
      setError('Invalid Algorand wallet address format');
      return false;
    }
    
    return true;
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await mockRegisterMemberAndSendOTP(formData);
      
      if (result.success) {
        setUserId(result.userId);
        setSuccess('OTP sent to your phone number!');
        
        // In development mode, show the OTP
        if (result.otp) {
          setDevOtp(result.otp);
        }
        
        setCurrentStep('otp-verification');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpCode.trim()) {
      setError('Please enter the OTP code');
      return;
    }
    
    if (otpCode.length !== 6) {
      setError('OTP code must be 6 digits');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const verificationData = {
        phone: formData.phone,
        otpCode: otpCode,
        memberData: formData,
      };
      
      const result = await mockVerifyOTPAndCreateMember(verificationData);
      
      if (result.success) {
        setCreatedMember(result.member);
        setCurrentStep('success');
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess(result.member);
        }
      }
    } catch (error: any) {
      setError(error.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await mockRegisterMemberAndSendOTP(formData);
      
      if (result.success) {
        setSuccess('New OTP sent to your phone number!');
        
        // In development mode, show the new OTP
        if (result.otp) {
          setDevOtp(result.otp);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderRegistrationStep = () => (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Join Loyalty Program</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Register to become a member and start earning rewards
        </p>
      </div>

      <form onSubmit={handleRegistration} className="space-y-6">
        {/* Wallet Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Wallet className="w-4 h-4 inline mr-2" />
            Algorand Wallet Address *
          </label>
          <input
            type="text"
            value={formData.walletAddress}
            onChange={(e) => handleInputChange('walletAddress', e.target.value)}
            placeholder="Enter your Algorand wallet address"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            Email Address *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="Enter your email address"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Phone className="w-4 h-4 inline mr-2" />
            Phone Number *
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="Enter your phone number (e.g., +1234567890)"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +1 for US)</p>
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Full Name *
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => handleInputChange('fullName', e.target.value)}
            placeholder="Enter your full name"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-green-700 dark:text-green-300 text-sm">{success}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Sending OTP...
              </>
            ) : (
              'Send Verification Code'
            )}
          </button>
        </div>
      </form>
    </div>
  );

  const renderOTPStep = () => (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verify Your Phone</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          We sent a 6-digit code to <strong>{formData.phone}</strong>
        </p>
      </div>

      {/* Development mode OTP display */}
      {devOtp && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            <strong>Development Mode:</strong> Your OTP is <strong>{devOtp}</strong>
          </p>
        </div>
      )}

      <form onSubmit={handleOTPVerification} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Verification Code
          </label>
          <input
            type="text"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit code"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
            maxLength={6}
            required
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <Check className="w-5 h-5 text-green-500" />
            <span className="text-green-700 dark:text-green-300 text-sm">{success}</span>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <button
            type="submit"
            disabled={loading || otpCode.length !== 6}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Verifying...
              </>
            ) : (
              'Verify & Complete Registration'
            )}
          </button>

          <button
            type="button"
            onClick={handleResendOTP}
            disabled={loading}
            className="w-full px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Resend Code
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep('registration')}
            className="text-blue-500 hover:text-blue-700 text-sm"
          >
            ← Back to Registration
          </button>
        </div>
      </form>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Registration Successful!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Welcome to the loyalty program, <strong>{createdMember?.fullName}</strong>!
        </p>
        
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Member Details:</h3>
          <div className="space-y-2 text-sm">
            <p><strong>Name:</strong> {createdMember?.fullName}</p>
            <p><strong>Email:</strong> {createdMember?.email}</p>
            <p><strong>Phone:</strong> {createdMember?.phone}</p>
            <p><strong>Wallet:</strong> {createdMember?.walletAddress.slice(0, 8)}...{createdMember?.walletAddress.slice(-8)}</p>
            <p><strong>Status:</strong> <span className="text-green-600">Verified</span></p>
          </div>
        </div>

        <button
          onClick={() => {
            // Reset form for new registration
            setCurrentStep('registration');
            setFormData({
              walletAddress: '',
              email: '',
              phone: '',
              fullName: '',
              loyaltyProgramId: loyaltyProgramId || '',
            });
            setOtpCode('');
            setError(null);
            setSuccess(null);
            setCreatedMember(null);
          }}
          className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Register Another Member
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      {currentStep === 'registration' && renderRegistrationStep()}
      {currentStep === 'otp-verification' && renderOTPStep()}
      {currentStep === 'success' && renderSuccessStep()}
    </div>
  );
} 