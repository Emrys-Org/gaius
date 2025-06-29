import { useState, useRef, ChangeEvent, useEffect } from 'react';
import { useWallet, useNetwork } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { getAlgodClient, getNetworkConfig } from '../utils/algod';
import { pinFileToIPFS } from '../utils/pinata';
import { ChevronLeft, ChevronRight, Upload, X, Plus, Trash2, Eye, Palette, Award, Building2, QrCode, AlertTriangle } from 'lucide-react';
import * as QRCode from 'qrcode';
import { checkSubscription, hasReachedProgramLimit, SUBSCRIPTION_PLANS } from '../utils/subscription';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner';

interface LoyaltyProgramMinterProps {
  onLoyaltyProgramMinted?: () => void;
}

interface RewardTier {
  id: string;
  name: string;
  description: string;
  pointsRequired: number;
}

interface LoyaltyProgramData {
  // Step 1: Basics
  programName: string;
  description: string;
  companyName: string;
  bannerFile: File | null;
  bannerUrl: string;

  // Step 2: Rewards
  rewardTiers: RewardTier[];
  pointsPerAction: number;

  // Step 3: Appearance
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  cardStyle: 'modern' | 'classic' | 'gradient';
}

const defaultColors = [
  '#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#6366F1', '#84CC16', '#F97316'
];

const cardStyles = [
  { id: 'modern', name: 'Modern', preview: 'rounded-2xl shadow-lg' },
  { id: 'classic', name: 'Classic', preview: 'rounded-lg border-2' },
  { id: 'gradient', name: 'Gradient', preview: 'rounded-2xl bg-gradient-to-br' }
];

export function LoyaltyProgramMinter({ onLoyaltyProgramMinted }: LoyaltyProgramMinterProps) {
  const { activeAddress, signTransactions } = useWallet();
  const { activeNetwork } = useNetwork();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; assetId?: number }>(); 
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [userProgramCount, setUserProgramCount] = useState(0);

  const [formData, setFormData] = useState<LoyaltyProgramData>({
    // Step 1: Basics
    programName: '',
    description: '',
    companyName: '',
    bannerFile: null,
    bannerUrl: '',
    
    // Step 2: Rewards
    rewardTiers: [
      { id: '1', name: 'Bronze', description: 'Basic rewards', pointsRequired: 100 },
      { id: '2', name: 'Silver', description: 'Enhanced rewards', pointsRequired: 500 },
      { id: '3', name: 'Gold', description: 'Premium rewards', pointsRequired: 1000 }
    ],
    pointsPerAction: 10,
    
    // Step 3: Appearance
    primaryColor: '#3B82F6',
    secondaryColor: '#8B5CF6',
    accentColor: '#F59E0B',
    cardStyle: 'modern'
  });

  // Fetch user's subscription and program count
  useEffect(() => {
    const fetchSubscriptionAndPrograms = async () => {
      if (!activeAddress) return;
      
      setIsCheckingSubscription(true);
      
      try {
        // Check subscription status
        const subscriptionDetails = await checkSubscription(activeAddress);
        setSubscription(subscriptionDetails);
        
        // Count user's existing programs
        const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
        const algodClient = getAlgodClient(networkType);
        
        const accountInfo = await algodClient.accountInformation(activeAddress).do();
        const assets = accountInfo.assets || [];
        
        // Count loyalty programs (simplified approach)
        let programCount = 0;
        
        for (const asset of assets) {
          if (typeof asset.amount === 'bigint' ? asset.amount === 0n : asset.amount === 0) continue;
          
          try {
            const assetInfo = await algodClient.getAssetByID(asset.assetId).do();
            const params = assetInfo.params;
            
            const totalSupply = typeof params.total === 'bigint' ? Number(params.total) : Number(params.total);
            const isLoyaltyProgram = totalSupply === 1 && params.decimals === 0;
            
            if (isLoyaltyProgram) {
              programCount++;
            }
          } catch (error) {
            console.error(`Error fetching asset ${asset.assetId} info:`, error);
          }
        }
        
        setUserProgramCount(programCount);
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setIsCheckingSubscription(false);
      }
    };
    
    fetchSubscriptionAndPrograms();
  }, [activeAddress, activeNetwork]);

  // Check if user has reached program limit
  const hasReachedLimit = () => {
    if (!subscription || !subscription.isActive) return true;
    
    const planDetails = SUBSCRIPTION_PLANS[subscription.plan as keyof typeof SUBSCRIPTION_PLANS];
    if (!planDetails) return true;
    
    return userProgramCount >= planDetails.programLimit;
  };

  // Get remaining program slots
  const getRemainingSlots = () => {
    if (!subscription || !subscription.isActive) return 0;
    
    const planDetails = SUBSCRIPTION_PLANS[subscription.plan as keyof typeof SUBSCRIPTION_PLANS];
    if (!planDetails) return 0;
    
    if (planDetails.programLimit === Infinity) return Infinity;
    return Math.max(0, planDetails.programLimit - userProgramCount);
  };

  // Get network-specific configuration
  const getNetworkInfo = () => {
    const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
    return getNetworkConfig(networkType);
  };
  
  const EXPLORER_URL = getNetworkInfo().explorerUrl;

  const updateFormData = (updates: Partial<LoyaltyProgramData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Generate QR code when form data changes
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        // Create QR code data with loyalty program information
        const qrData = {
          type: 'loyalty-program',
          programName: formData.programName || 'Loyalty Program',
          company: formData.companyName || 'Company',
          wallet: activeAddress,
          timestamp: new Date().toISOString(),
          // Add more data as needed
          website: `${EXPLORER_URL}/account/${activeAddress}`,
        };

        const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
          width: 200,
          margin: 2,
          color: {
            dark: formData.primaryColor,
            light: '#FFFFFF'
          }
        });
        
        setQrCodeDataUrl(qrCodeUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    if (formData.programName || formData.companyName) {
      generateQRCode();
    }
  }, [formData.programName, formData.companyName, formData.primaryColor, activeAddress]);

  const handleBannerUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file for the banner');
        return;
    }
      
      setUploadingBanner(true);
    
    try {
        // Upload to IPFS
        const result = await pinFileToIPFS(file);
      
      if (result.success && result.cid) {
          const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${result.cid}`;
          updateFormData({
            bannerFile: file,
            bannerUrl: ipfsUrl
          });
      } else {
          throw new Error(result.message || 'Failed to upload banner');
      }
    } catch (error: unknown) {
      console.error('Error uploading banner:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error uploading banner: ${errorMessage}`);
    } finally {
      setUploadingBanner(false);
    }
  };

  const addRewardTier = () => {
    const newTier: RewardTier = {
      id: Date.now().toString(),
      name: '',
      description: '',
      pointsRequired: 0
    };
    updateFormData({
      rewardTiers: [...formData.rewardTiers, newTier]
    });
  };

  const updateRewardTier = (id: string, updates: Partial<RewardTier>) => {
    updateFormData({
      rewardTiers: formData.rewardTiers.map(tier => 
        tier.id === id ? { ...tier, ...updates } : tier
      )
    });
  };

  const removeRewardTier = (id: string) => {
    if (formData.rewardTiers.length > 1) {
      updateFormData({
        rewardTiers: formData.rewardTiers.filter(tier => tier.id !== id)
      });
    }
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.programName && formData.companyName && formData.bannerUrl;
      case 2:
        return formData.rewardTiers.every(tier => tier.name && tier.description && tier.pointsRequired > 0);
      case 3:
        return true;
      default:
        return false;
    }
  };

  const createLoyaltyProgram = async () => {
    if (!activeAddress || !signTransactions) {
      setResult({ success: false, message: 'Please connect your wallet first' });
      return;
    }

    // Check subscription status
    if (hasReachedLimit()) {
      setResult({ 
        success: false, 
        message: 'You have reached the maximum number of loyalty programs for your subscription plan. Please upgrade your plan to create more programs.' 
      });
      return;
    }

    console.log('Creating loyalty program...', { activeAddress, activeNetwork });
    setIsLoading(true);
    setResult(undefined);

    try {
      // Get network-specific algod client
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      console.log('Using network:', networkType);
      const algodClient = getAlgodClient(networkType);
      
      // Get suggested parameters
      console.log('Getting transaction parameters...');
      const suggestedParams = await algodClient.getTransactionParams().do();
      console.log('Transaction parameters:', suggestedParams);
      
      // Generate final QR code with asset information (will be updated after creation)
      const qrData = {
        type: 'loyalty-program',
        programName: formData.programName,
        company: formData.companyName,
        wallet: activeAddress,
        timestamp: new Date().toISOString(),
        website: `${EXPLORER_URL}/account/${activeAddress}`,
      };

      // Create optimized metadata (shortened keys to stay under 1024 byte limit)
      const metadata = {
        name: formData.programName,
        desc: formData.description,
        img: formData.bannerUrl,
        co: formData.companyName,
        tiers: formData.rewardTiers.map(tier => ({
          id: tier.id,
          n: tier.name,
          d: tier.description,
          p: tier.pointsRequired
        })),
        ppa: formData.pointsPerAction,
        style: {
          p: formData.primaryColor,
          s: formData.secondaryColor,
          a: formData.accentColor,
          cs: formData.cardStyle
        },
        qr: qrData,
        type: 'loyalty',
        v: '1.0'
      };

      // Convert metadata to Uint8Array for note field
      const metadataStr = JSON.stringify(metadata);
      const metadataBytes = new Uint8Array(Buffer.from(metadataStr));
      
      // Check if metadata is within Algorand's 1024 byte limit
      if (metadataBytes.length > 1024) {
        throw new Error(`Metadata too large: ${metadataBytes.length} bytes (max: 1024 bytes). Please reduce description length or number of reward tiers.`);
      }

      // Create asset creation transaction
      const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        total: 1,
        decimals: 0,
        assetName: formData.programName,
        unitName: formData.programName.substring(0, 8).toUpperCase(),
        assetURL: formData.bannerUrl,
        note: metadataBytes,
        defaultFrozen: false,
        suggestedParams,
        manager: activeAddress,
        reserve: activeAddress,
        freeze: activeAddress,
        clawback: activeAddress
      });

      // Sign and send transaction
      console.log('Encoding transaction...');
      const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
      console.log('Signing transaction with wallet...');
      const signedTxns = await signTransactions([encodedTxn]);
      
      if (signedTxns && signedTxns[0]) {
        const signedTxnBytes = signedTxns.map(txn => txn ? new Uint8Array(txn) : null).filter(Boolean) as Uint8Array[];
        const response = await algodClient.sendRawTransaction(signedTxnBytes).do();
        
        // Wait for confirmation
        const confirmedTxn = await algosdk.waitForConfirmation(
          algodClient,
          response.txid,
          4
        );
        
        // Get the asset ID from the confirmed transaction
        const assetId = Number(confirmedTxn.assetIndex);
        
        setResult({ 
          success: true, 
          message: `Loyalty Program "${formData.programName}" created successfully!`, 
          assetId 
        });

        // Reset form after successful creation
        setFormData({
          programName: '',
          description: '',
          companyName: '',
          bannerFile: null,
          bannerUrl: '',
          rewardTiers: [
            { id: '1', name: 'Bronze', description: 'Basic rewards', pointsRequired: 100 },
            { id: '2', name: 'Silver', description: 'Enhanced rewards', pointsRequired: 500 },
            { id: '3', name: 'Gold', description: 'Premium rewards', pointsRequired: 1000 }
          ],
          pointsPerAction: 10,
          primaryColor: '#3B82F6',
          secondaryColor: '#8B5CF6',
          accentColor: '#F59E0B',
          cardStyle: 'modern'
        });
        setCurrentStep(1);
        
        // Call the callback if provided
        if (onLoyaltyProgramMinted) {
          onLoyaltyProgramMinted();
        }
      } else {
        throw new Error('Failed to sign transaction');
      }
    } catch (error: unknown) {
      console.error('Error creating loyalty program:', error);
      
      // Check for specific Pera Wallet errors
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (error.message?.includes('PeraWalletConnect was not initialized correctly')) {
          errorMessage = 'Pera Wallet connection issue. Please try disconnecting and reconnecting your wallet, then try again.';
        } else if (error.message?.includes('User rejected')) {
          errorMessage = 'Transaction was rejected by user.';
        } else if (error.message?.includes('Network error')) {
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
        }
      }
      
      setResult({ 
        success: false, 
        message: `Error creating Loyalty Program: ${errorMessage}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderPreview = () => {
    const getCardStyle = () => {
      const baseStyle = "w-full h-64 p-6 text-white relative overflow-hidden";
      
      switch (formData.cardStyle) {
        case 'modern':
          return `${baseStyle} rounded-2xl shadow-2xl`;
        case 'classic':
          return `${baseStyle} rounded-lg border-2 border-white/20`;
        case 'gradient':
          return `${baseStyle} rounded-2xl bg-gradient-to-br shadow-xl`;
        default:
          return `${baseStyle} rounded-2xl shadow-2xl`;
      }
    };

    const getBackgroundStyle = () => {
      if (formData.cardStyle === 'gradient') {
        return {
          background: `linear-gradient(135deg, ${formData.primaryColor}, ${formData.secondaryColor})`
        };
      }
      return {
        backgroundColor: formData.primaryColor
      };
    };

        return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Eye size={20} />
          Live Preview
        </h3>
        
        <div className="space-y-4">
          {/* Loyalty Card Preview */}
          <div 
            className={getCardStyle()}
            style={getBackgroundStyle()}
          >
            {/* Banner Image Background */}
            {formData.bannerUrl && (
              <div className="absolute inset-0">
                <img 
                  src={formData.bannerUrl} 
                  alt="Card Background" 
                  className="w-full h-full object-cover opacity-30"
          />
                <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-black/40"></div>
              </div>
            )}
            
            {/* Background Pattern (only show if no banner) */}
            {!formData.bannerUrl && (
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white transform translate-x-16 -translate-y-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white transform -translate-x-12 translate-y-12"></div>
              </div>
            )}
            
            {/* Card Content */}
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <h4 className="text-xl font-bold drop-shadow-lg">{formData.programName || 'Your Loyalty Program'}</h4>
                <p className="text-sm opacity-90 drop-shadow-md">{formData.companyName || 'Company Name'}</p>
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs opacity-80 drop-shadow-sm">MEMBER SINCE</p>
                  <p className="text-sm font-medium drop-shadow-sm">{new Date().getFullYear()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-80 drop-shadow-sm">POINTS</p>
                  <p className="text-2xl font-bold drop-shadow-lg" style={{ color: formData.accentColor }}>1,250</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Reward Tiers Preview */}
          {formData.rewardTiers.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Reward Tiers</h4>
              <div className="space-y-2">
                {formData.rewardTiers.slice(0, 3).map((tier, index) => (
                  <div key={tier.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: formData.primaryColor }}
                    ></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{tier.name || `Tier ${index + 1}`}</p>
                      <p className="text-xs text-gray-500">{tier.pointsRequired} points</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Banner Preview */}
          {formData.bannerUrl && (
            <div>
              <h4 className="font-medium mb-2">Program Banner</h4>
              <img 
                src={formData.bannerUrl} 
                alt="Banner Preview" 
                className="w-full h-24 object-cover rounded-lg"
              />
            </div>
          )}
          
          {/* QR Code Preview */}
          {qrCodeDataUrl && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <QrCode size={16} />
                Program QR Code
              </h4>
              <div className="bg-white p-4 rounded-lg inline-block">
                <img 
                  src={qrCodeDataUrl} 
                  alt="Program QR Code" 
                  className="w-32 h-32"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Scan to access loyalty program information
              </p>
          </div>
          )}
          </div>
          </div>
        );
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Building2 className="mx-auto mb-4 text-blue-500" size={48} />
        <h3 className="text-2xl font-bold">Program Basics</h3>
        <p className="text-gray-600 dark:text-gray-400">Set up the foundation of your loyalty program</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Program Name *</label>
          <input
            type="text"
            value={formData.programName}
            onChange={(e) => updateFormData({ programName: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., VIP Rewards Program"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Company Name *</label>
          <input
            type="text"
            value={formData.companyName}
            onChange={(e) => updateFormData({ companyName: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Your Company Inc."
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => updateFormData({ description: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Describe your loyalty program and its benefits..."
          rows={3}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">Program Banner *</label>
          <div className="space-y-4">
          {!formData.bannerUrl ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleBannerUpload}
                accept="image/*"
                className="hidden"
              />
              
              {uploadingBanner ? (
                <div className="space-y-2">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                  <p className="text-gray-600 dark:text-gray-400">Uploading banner...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto text-gray-400" size={32} />
                  <p className="text-gray-600 dark:text-gray-400">Click to upload banner image</p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <img 
                src={formData.bannerUrl} 
                alt="Banner Preview" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                onClick={() => updateFormData({ bannerUrl: '', bannerFile: null })}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            )}
          </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Award className="mx-auto mb-4 text-blue-500" size={48} />
        <h3 className="text-2xl font-bold">Reward Structure</h3>
        <p className="text-gray-600 dark:text-gray-400">Define your reward tiers and point system</p>
      </div>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Points Per Action</label>
        <input
          type="number"
          value={formData.pointsPerAction}
          onChange={(e) => updateFormData({ pointsPerAction: parseInt(e.target.value) || 0 })}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="10"
          min="1"
        />
        <p className="text-xs text-gray-500 mt-1">Points earned per customer action (purchase, referral, etc.)</p>
      </div>
      
      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-lg font-semibold">Reward Tiers</h4>
          <button
            onClick={addRewardTier}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={16} />
            Add Tier
          </button>
          </div>
        
          <div className="space-y-4">
          {formData.rewardTiers.map((tier, index) => (
            <div key={tier.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <h5 className="font-medium">Tier {index + 1}</h5>
                {formData.rewardTiers.length > 1 && (
                  <button
                    onClick={() => removeRewardTier(tier.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tier Name *</label>
                  <input
                    type="text"
                    value={tier.name}
                    onChange={(e) => updateRewardTier(tier.id, { name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Bronze, Silver, Gold"
                  />
                </div>
                
              <div>
                  <label className="block text-sm font-medium mb-1">Points Required *</label>
                  <input
                    type="number"
                    value={tier.pointsRequired}
                    onChange={(e) => updateRewardTier(tier.id, { pointsRequired: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="100"
                    min="0"
                  />
                </div>
                
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium mb-1">Description *</label>
                  <input
                    type="text"
                    value={tier.description}
                    onChange={(e) => updateRewardTier(tier.id, { description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Describe the rewards for this tier"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
          </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Palette className="mx-auto mb-4 text-blue-500" size={48} />
        <h3 className="text-2xl font-bold">Appearance & Style</h3>
        <p className="text-gray-600 dark:text-gray-400">Customize the look and feel of your loyalty program</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Primary Color</label>
          <div className="space-y-2">
          <input
              type="color"
              value={formData.primaryColor}
              onChange={(e) => updateFormData({ primaryColor: e.target.value })}
              className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
            />
            <div className="grid grid-cols-5 gap-2">
              {defaultColors.map((color) => (
                <button
                  key={color}
                  onClick={() => updateFormData({ primaryColor: color })}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
          />
              ))}
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Secondary Color</label>
          <div className="space-y-2">
          <input
              type="color"
              value={formData.secondaryColor}
              onChange={(e) => updateFormData({ secondaryColor: e.target.value })}
              className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
            />
            <div className="grid grid-cols-5 gap-2">
              {defaultColors.map((color) => (
                <button
                  key={color}
                  onClick={() => updateFormData({ secondaryColor: color })}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
          />
              ))}
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Accent Color</label>
          <div className="space-y-2">
            <input
              type="color"
              value={formData.accentColor}
              onChange={(e) => updateFormData({ accentColor: e.target.value })}
              className="w-full h-12 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
            />
            <div className="grid grid-cols-5 gap-2">
              {defaultColors.map((color) => (
                <button
                  key={color}
                  onClick={() => updateFormData({ accentColor: color })}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
          />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-4">Card Style</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cardStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => updateFormData({ cardStyle: style.id as 'modern' | 'classic' | 'gradient' })}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                formData.cardStyle === style.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-300'
              }`}
            >
              <div className={`w-full h-16 mb-2 ${style.preview}`} style={{
                backgroundColor: formData.primaryColor,
                ...(style.id === 'gradient' && {
                  background: `linear-gradient(135deg, ${formData.primaryColor}, ${formData.secondaryColor})`
                })
              }}></div>
              <h4 className="font-medium">{style.name}</h4>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Add subscription warning component
  const renderSubscriptionWarning = () => {
    if (isCheckingSubscription) {
      return (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
          <p className="text-blue-800 dark:text-blue-300">Checking subscription status...</p>
        </div>
      );
    }

    if (!subscription || !subscription.isActive) {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-300">No active subscription</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                You don't have an active subscription plan. Your ability to create loyalty programs may be limited.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (hasReachedLimit()) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-red-800 dark:text-red-300">Program limit reached</p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                You've reached the maximum number of loyalty programs ({userProgramCount}) for your {subscription.plan} plan. 
                Please upgrade your subscription to create more programs.
              </p>
            </div>
          </div>
        </div>
      );
    }

    const remainingSlots = getRemainingSlots();
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Award className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-green-800 dark:text-green-300">{subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} plan active</p>
            <p className="text-sm text-green-700 dark:text-green-400 mt-1">
              {remainingSlots === Infinity 
                ? "You can create unlimited loyalty programs with your current plan." 
                : `You can create ${remainingSlots} more loyalty program${remainingSlots !== 1 ? 's' : ''} with your current plan.`}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Add subscription warning component
  const renderSubscriptionWarning = () => {
    if (isCheckingSubscription) {
      return (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
          <p className="text-blue-800 dark:text-blue-300">Checking subscription status...</p>
        </div>
      );
    }

    if (!subscription || !subscription.isActive) {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-300">No active subscription</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                You don't have an active subscription plan. Your ability to create loyalty programs may be limited.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (hasReachedLimit()) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-red-800 dark:text-red-300">Program limit reached</p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                You've reached the maximum number of loyalty programs ({userProgramCount}) for your {subscription.plan} plan. 
                Please upgrade your subscription to create more programs.
              </p>
            </div>
          </div>
        </div>
      );
    }

    const remainingSlots = getRemainingSlots();
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Award className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-green-800 dark:text-green-300">{subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} plan active</p>
            <p className="text-sm text-green-700 dark:text-green-400 mt-1">
              {remainingSlots === Infinity 
                ? "You can create unlimited loyalty programs with your current plan." 
                : `You can create ${remainingSlots} more loyalty program${remainingSlots !== 1 ? 's' : ''} with your current plan.`}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Form Section */}
      <div className="lg:col-span-2">
        {/* Subscription Status */}
        {renderSubscriptionWarning()}
        
        {/* Progress Bar */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Step {currentStep} of 3
            </span>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {Math.round((currentStep / 3) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <motion.div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / 3) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </motion.div>

        {/* Step Content */}
        <motion.div 
          className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg card-hover"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
            </motion.div>
          </AnimatePresence>
          
          {/* Navigation Buttons */}
          <motion.div 
            className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
              whileHover={currentStep !== 1 ? { scale: 1.02 } : {}}
              whileTap={currentStep !== 1 ? { scale: 0.98 } : {}}
            >
              <ChevronLeft size={20} />
              Previous
            </motion.button>
            
            {currentStep < 3 ? (
              <motion.button
                onClick={nextStep}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-lg hover:shadow-xl"
                whileHover={canProceed() ? { scale: 1.02 } : {}}
                whileTap={canProceed() ? { scale: 0.98 } : {}}
              >
                Next
                <ChevronRight size={20} />
              </motion.button>
            ) : (
              <motion.button
                onClick={createLoyaltyProgram}
                disabled={isLoading || !canProceed()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-lg hover:shadow-xl"
                whileHover={!isLoading && canProceed() ? { scale: 1.02 } : {}}
                whileTap={!isLoading && canProceed() ? { scale: 0.98 } : {}}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Award size={20} />
                    Create Program
                  </>
                )}
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      
        {/* Result Message */}
        <AnimatePresence>
          {result && (
            <motion.div 
              className={`mt-6 p-4 rounded-lg border ${
                result.success 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
              }`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <p className="font-medium">{result.message}</p>
              {result.assetId && (
                <motion.p 
                  className="mt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  Asset ID: {result.assetId} - View on{' '}
                  <a 
                    href={`${EXPLORER_URL}/asset/${result.assetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-600 dark:hover:text-green-300 transition-colors"
                  >
                    Lora Explorer
                  </a>
                </motion.p>
              )}
              
              {/* Troubleshooting for Pera Wallet errors */}
              {!result.success && result.message.includes('Pera Wallet connection issue') && (
                <motion.div 
                  className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Troubleshooting Steps:</h4>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    <li>1. Disconnect your Pera Wallet from the app</li>
                    <li>2. Close and reopen the Pera Wallet app</li>
                    <li>3. Reconnect your wallet to this app</li>
                    <li>4. Make sure you're on the correct network ({activeNetwork === 'mainnet' ? 'MainNet' : 'TestNet'})</li>
                    <li>5. Try the transaction again</li>
                  </ul>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preview Section */}
      <motion.div 
        className="lg:col-span-1"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="sticky top-8">
          {renderPreview()}
        </div>
      </motion.div>
    </motion.div>
  );
} }
