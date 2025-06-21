import { useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { motion } from 'framer-motion';
import { algodClient } from '../utils/algod';
import { pinFileToIPFS } from '../utils/pinata';
import algosdk from 'algosdk';

interface LoyaltyProgramCreatorProps {
  onProgramCreated?: () => void;
}

// Animation variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5 }
  }
};

export function LoyaltyProgramCreator({ onProgramCreated }: LoyaltyProgramCreatorProps) {
  const { activeAddress, signTransactions } = useWallet();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; assetId?: number }>();

  // Form state
  // Step 1: Basics
  const [programName, setProgramName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [bannerImage, setBannerImage] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  
  // Step 2: Rewards
  const [tiers, setTiers] = useState([
    { name: 'Bronze', pointsRequired: 0, rewards: 'Basic rewards' },
    { name: 'Silver', pointsRequired: 100, rewards: 'Enhanced rewards' },
    { name: 'Gold', pointsRequired: 500, rewards: 'Premium rewards' }
  ]);
  const [pointsPerAction, setPointsPerAction] = useState([
    { action: 'Purchase', points: 10 },
    { action: 'Review', points: 5 },
    { action: 'Referral', points: 25 }
  ]);

  // Step 3: Appearance
  const [primaryColor, setPrimaryColor] = useState('#3b82f6'); // Default blue
  const [secondaryColor, setSecondaryColor] = useState('#8b5cf6'); // Default purple
  const [accentColor, setAccentColor] = useState('#f59e0b'); // Default amber

  // Handle banner image upload
  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBannerImage(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle tier changes
  const handleTierChange = (index: number, field: 'name' | 'pointsRequired' | 'rewards', value: string | number) => {
    const updatedTiers = [...tiers];
    updatedTiers[index] = { ...updatedTiers[index], [field]: value };
    setTiers(updatedTiers);
  };

  // Handle points per action changes
  const handlePointsActionChange = (index: number, field: 'action' | 'points', value: string | number) => {
    const updatedActions = [...pointsPerAction];
    updatedActions[index] = { ...updatedActions[index], [field]: value };
    setPointsPerAction(updatedActions);
  };

  // Add new tier
  const addTier = () => {
    setTiers([...tiers, { name: `Tier ${tiers.length + 1}`, pointsRequired: 0, rewards: '' }]);
  };

  // Add new action
  const addAction = () => {
    setPointsPerAction([...pointsPerAction, { action: 'New Action', points: 0 }]);
  };

  // Remove tier
  const removeTier = (index: number) => {
    if (tiers.length > 1) {
      setTiers(tiers.filter((_, i) => i !== index));
    }
  };

  // Remove action
  const removeAction = (index: number) => {
    if (pointsPerAction.length > 1) {
      setPointsPerAction(pointsPerAction.filter((_, i) => i !== index));
    }
  };

  // Next step
  const goToNextStep = () => {
    if (currentStep === 1) {
      if (!programName || !companyName || !description || !bannerImage) {
        setResult({ success: false, message: 'Please fill all required fields in the Basics section' });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
    // Clear any previous error messages
    setResult(undefined);
  };

  // Previous step
  const goToPreviousStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    }
    // Clear any previous error messages
    setResult(undefined);
  };

  // Create loyalty program (mint NFT)
  const createLoyaltyProgram = async () => {
    if (!activeAddress || !signTransactions) {
      setResult({ success: false, message: 'Please connect your wallet first' });
      return;
    }

    setIsLoading(true);
    setResult(undefined);

    try {
      // Upload banner to IPFS
      let ipfsUrl = '';
      let ipfsCid = '';
      
      if (bannerImage) {
        const uploadResult = await pinFileToIPFS(bannerImage);
        if (!uploadResult.success || !uploadResult.cid) {
          throw new Error('Failed to upload banner image to IPFS');
        }
        ipfsCid = uploadResult.cid;
        ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsCid}`;
      }

      // Create loyalty program metadata
      const metadata = {
        name: programName,
        description: description,
        company: companyName,
        image: ipfsUrl,
        properties: {
          tiers: tiers,
          pointsPerAction: pointsPerAction,
          appearance: {
            primaryColor,
            secondaryColor,
            accentColor
          }
        }
      };

      // Get suggested parameters
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Convert metadata to Uint8Array for note field
      const metadataStr = JSON.stringify(metadata);
      const metadataBytes = new Uint8Array(Buffer.from(metadataStr));

      // Create asset creation transaction
      const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        total: 1,
        decimals: 0,
        assetName: programName,
        unitName: 'LOYALTY',
        assetURL: ipfsUrl,
        note: metadataBytes,
        defaultFrozen: false,
        suggestedParams,
        manager: activeAddress,
        reserve: activeAddress,
        freeze: activeAddress,
        clawback: activeAddress
      });

      // Sign and send transaction
      const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
      const signedTxns = await signTransactions([encodedTxn]);
      
      if (signedTxns && signedTxns[0]) {
        // Convert the signed transaction to Uint8Array before sending
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
          message: `Loyalty program created successfully!`, 
          assetId 
        });

        // Reset form after successful creation
        setProgramName('');
        setCompanyName('');
        setDescription('');
        setBannerImage(null);
        setBannerPreview(null);
        setCurrentStep(1);
        
        // Call the onProgramCreated callback if provided
        if (onProgramCreated) {
          onProgramCreated();
        }
      } else {
        throw new Error('Failed to sign transaction');
      }
    } catch (error: any) {
      setResult({ 
        success: false, 
        message: `Error creating loyalty program: ${error.message || JSON.stringify(error)}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render step indicators
  const renderStepIndicators = () => {
    return (
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                currentStep === step 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              {step}
            </div>
            
            {step < 3 && (
              <div 
                className={`w-16 h-1 ${
                  step < currentStep 
                    ? 'bg-blue-600' 
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              ></div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render step 1: Basics
  const renderBasicsStep = () => {
    return (
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        className="space-y-6"
      >
        <h3 className="text-xl font-semibold mb-4">Program Basics</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Program Name*
          </label>
          <input
            type="text"
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Gold Member Rewards"
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Company Name*
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Your Company"
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description*
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Describe your loyalty program"
            rows={3}
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Program Banner*
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md">
            <div className="space-y-1 text-center">
              {bannerPreview ? (
                <div>
                  <img 
                    src={bannerPreview} 
                    alt="Banner Preview" 
                    className="mx-auto h-32 object-cover rounded-md"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      setBannerImage(null);
                      setBannerPreview(null);
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex text-sm text-gray-600 dark:text-gray-400">
                    <label
                      htmlFor="banner-upload"
                      className="relative cursor-pointer bg-white dark:bg-gray-700 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none"
                    >
                      <span>Upload a banner</span>
                      <input
                        id="banner-upload"
                        name="banner-upload"
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        onChange={handleBannerUpload}
                        disabled={isLoading}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Render step 2: Rewards
  const renderRewardsStep = () => {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        className="space-y-8"
      >
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Loyalty Tiers</h3>
            <button
              type="button"
              onClick={addTier}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
            >
              + Add Tier
            </button>
          </div>
          
          <div className="space-y-4">
            {tiers.map((tier, index) => (
              <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Tier {index + 1}</h4>
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tier Name
                    </label>
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => handleTierChange(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Points Required
                    </label>
                    <input
                      type="number"
                      value={tier.pointsRequired}
                      onChange={(e) => handleTierChange(index, 'pointsRequired', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="0"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Rewards Description
                    </label>
                    <textarea
                      value={tier.rewards}
                      onChange={(e) => handleTierChange(index, 'rewards', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Points Per Action</h3>
            <button
              type="button"
              onClick={addAction}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
            >
              + Add Action
            </button>
          </div>
          
          <div className="space-y-4">
            {pointsPerAction.map((action, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-grow">
                  <input
                    type="text"
                    value={action.action}
                    onChange={(e) => handlePointsActionChange(index, 'action', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Action name"
                  />
                </div>
                
                <div className="w-24">
                  <input
                    type="number"
                    value={action.points}
                    onChange={(e) => handlePointsActionChange(index, 'points', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Points"
                    min="0"
                  />
                </div>
                
                {pointsPerAction.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAction(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  // Render step 3: Appearance
  const renderAppearanceStep = () => {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        className="space-y-8"
      >
        <h3 className="text-xl font-semibold mb-4">Program Appearance</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Primary Color
            </label>
            <div className="flex items-center">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-12 h-12 rounded border-0 p-0"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="ml-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Secondary Color
            </label>
            <div className="flex items-center">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-12 h-12 rounded border-0 p-0"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="ml-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Accent Color
            </label>
            <div className="flex items-center">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-12 h-12 rounded border-0 p-0"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="ml-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
        
        <div className="mt-8">
          <h4 className="font-medium mb-4">Preview</h4>
          <div 
            className="p-6 rounded-lg shadow-lg"
            style={{ 
              background: `linear-gradient(to bottom right, ${primaryColor}, ${secondaryColor})`,
              color: 'white'
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold">{programName || 'Loyalty Program'}</h3>
                <p className="text-sm opacity-90">{companyName || 'Company Name'}</p>
              </div>
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                style={{ backgroundColor: accentColor }}
              >
                G
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-white/10 backdrop-blur-sm rounded">
              <div className="flex justify-between">
                <div>
                  <p className="text-xs opacity-80">CURRENT TIER</p>
                  <p className="font-bold">{tiers[0]?.name || 'Bronze'}</p>
                </div>
                <div>
                  <p className="text-xs opacity-80">POINTS</p>
                  <p className="font-bold">0</p>
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full"
                  style={{ 
                    width: '30%',
                    backgroundColor: accentColor
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span>{tiers[0]?.name || 'Bronze'}</span>
                <span>{tiers[1]?.name || 'Silver'}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Render navigation buttons
  const renderNavigationButtons = () => {
    return (
      <div className="flex justify-between mt-8">
        {currentStep > 1 ? (
          <button
            type="button"
            onClick={goToPreviousStep}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            disabled={isLoading}
          >
            Previous
          </button>
        ) : (
          <div></div>
        )}
        
        {currentStep < 3 ? (
          <button
            type="button"
            onClick={goToNextStep}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={isLoading}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={createLoyaltyProgram}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Program...' : 'Create Loyalty Program'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      {/* Step indicators */}
      {renderStepIndicators()}
      
      {/* Current step content */}
      <div className="mt-6">
        {currentStep === 1 && renderBasicsStep()}
        {currentStep === 2 && renderRewardsStep()}
        {currentStep === 3 && renderAppearanceStep()}
      </div>
      
      {/* Navigation buttons */}
      {renderNavigationButtons()}
      
      {/* Result message */}
      {result && (
        <div className={`mt-6 p-4 rounded-lg ${result.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
          <p>{result.message}</p>
          {result.assetId && (
            <p className="mt-2">
              Program ID: {result.assetId} - View on{' '}
              <a 
                href={`https://lora.algokit.io/testnet/asset/${result.assetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Lora Explorer
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
} 