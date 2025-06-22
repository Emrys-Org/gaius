import { useState, useEffect } from 'react';
import { MemberRegistrationForm } from './MemberRegistrationForm';
import { Award, Users, Shield, Star } from 'lucide-react';

interface MemberRegistrationPageProps {
  loyaltyProgramId?: string;
  programName?: string;
  companyName?: string;
}

export function MemberRegistrationPage({ 
  loyaltyProgramId, 
  programName = "Loyalty Program", 
  companyName = "Our Company" 
}: MemberRegistrationPageProps) {
  const [registeredMember, setRegisteredMember] = useState<any>(null);
  const [showForm, setShowForm] = useState(true);

  // Extract program info from URL params if available
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const programParam = urlParams.get('program');
    const companyParam = urlParams.get('company');
    
    if (programParam) {
      // Update program name from URL
    }
    if (companyParam) {
      // Update company name from URL
    }
  }, []);

  const handleRegistrationSuccess = (member: any) => {
    setRegisteredMember(member);
    setShowForm(false);
  };

  const features = [
    {
      icon: <Award className="w-6 h-6" />,
      title: "Earn Rewards",
      description: "Collect points with every purchase and interaction"
    },
    {
      icon: <Star className="w-6 h-6" />,
      title: "Exclusive Benefits",
      description: "Access member-only deals and special offers"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "VIP Treatment",
      description: "Enjoy priority service and early access to new products"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Secure & Verified",
      description: "Your membership is secured on the blockchain"
    }
  ];

  if (!showForm && registeredMember) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <Award className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Welcome to {programName}!
              </h1>
              
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-6">
                Congratulations, <strong>{registeredMember.fullName}</strong>! 
                You're now a verified member of our loyalty program.
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Your Membership Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="text-left">
                    <p className="text-gray-500 dark:text-gray-400">Member ID</p>
                    <p className="font-medium">{registeredMember.id}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-gray-500 dark:text-gray-400">Status</p>
                    <p className="font-medium text-green-600">✓ Verified</p>
                  </div>
                  <div className="text-left">
                    <p className="text-gray-500 dark:text-gray-400">Join Date</p>
                    <p className="font-medium">{new Date(registeredMember.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-gray-500 dark:text-gray-400">Tier</p>
                    <p className="font-medium">Bronze</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">What's Next?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Start Earning</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Begin collecting points with your next purchase or interaction
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Explore Rewards</h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Check out available rewards and redemption options
                    </p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setShowForm(true);
                  setRegisteredMember(null);
                }}
                className="mt-6 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Register Another Member
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Join {programName}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Powered by {companyName} • Secure blockchain-based loyalty program
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left Column - Benefits */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Why Join Our Loyalty Program?
              </h2>
              <div className="space-y-6">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Secure & Transparent
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Blockchain-secured membership
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    SMS verification for security
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Algorand wallet integration
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Transparent point tracking
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Registration Form */}
          <div>
            <MemberRegistrationForm
              loyaltyProgramId={loyaltyProgramId}
              onSuccess={handleRegistrationSuccess}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              © 2024 {companyName}. Powered by Gaius Loyalty Platform.
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
              Secure blockchain-based loyalty program on Algorand
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
} 