import { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { motion } from 'framer-motion';
import { LoyaltyProgramCreator } from './LoyaltyProgramCreator';
import { algodClient, ALGORAND_NETWORK } from '../utils/algod';
import { getIPFSGatewayURL } from '../utils/pinata';

interface LoyaltyProgram {
  id: number;
  name: string;
  companyName: string;
  description: string;
  bannerUrl: string;
  tiers: Array<{
    name: string;
    pointsRequired: number;
    rewards: string;
  }>;
  pointsPerAction: Array<{
    action: string;
    points: number;
  }>;
  appearance: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
}

export function LoyaltyProgramDashboard() {
  const { activeAddress } = useWallet();
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyProgram[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'view'>('create');
  const [error, setError] = useState<string | null>(null);

  // Use Lora AlgoKit Explorer URL for TestNet
  const EXPLORER_URL = ALGORAND_NETWORK.explorerUrl;

  useEffect(() => {
    if (activeAddress && activeTab === 'view') {
      fetchLoyaltyPrograms();
    }
  }, [activeAddress, activeTab]);

  const fetchLoyaltyPrograms = async () => {
    if (!activeAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get account information including assets
      const accountInfo = await algodClient.accountInformation(activeAddress).do();
      
      // Filter for assets (NFTs) owned by the user
      const assets = accountInfo.assets || [];
      
      // Create an array to store loyalty program information
      const programs: LoyaltyProgram[] = [];
      
      // Process each asset
      for (const asset of assets) {
        // Skip assets with amount 0 (not owned)
        if (asset.amount === 0) continue;
        
        try {
          // Get detailed asset information
          const assetInfo = await algodClient.getAssetByID(asset.assetId).do();
          
          // Check if it's an NFT (total supply of 1 and decimals of 0)
          const params = assetInfo.params;
          
          // Handle bigint total supply
          const totalSupply = typeof params.total === 'bigint' ? Number(params.total) : Number(params.total);
          
          const isNFT = totalSupply === 1 && params.decimals === 0;
          
          if (isNFT) {
            // Get the asset URL
            let url = params.url || '';
            let bannerUrl = url;
            let metadata = null;
            
            // Handle IPFS URLs
            if (url && (url.startsWith('ipfs://') || url.includes('/ipfs/'))) {
              bannerUrl = getIPFSGatewayURL(url);
              
              // Try to fetch metadata if it's an IPFS URL
              try {
                const response = await fetch(bannerUrl);
                if (response.ok) {
                  metadata = await response.json();
                  // If metadata has an image field that's IPFS, use that as the banner URL
                  if (metadata.image) {
                    bannerUrl = getIPFSGatewayURL(metadata.image);
                  }
                }
              } catch (e) {
                console.warn(`Failed to fetch metadata for asset ${asset.assetId}`, e);
              }
            }
            
            // Check if it's a loyalty program by looking for specific properties
            if (metadata && 
                metadata.properties && 
                metadata.properties.tiers && 
                metadata.properties.pointsPerAction) {
              
              // It's a loyalty program
              const program: LoyaltyProgram = {
                id: asset.assetId,
                name: metadata.name || params.name || 'Unnamed Program',
                companyName: metadata.company || 'Unknown Company',
                description: metadata.description || '',
                bannerUrl,
                tiers: metadata.properties.tiers || [],
                pointsPerAction: metadata.properties.pointsPerAction || [],
                appearance: metadata.properties.appearance || {
                  primaryColor: '#3b82f6',
                  secondaryColor: '#8b5cf6',
                  accentColor: '#f59e0b'
                }
              };
              
              programs.push(program);
            }
          }
        } catch (error) {
          console.error(`Error fetching asset ${asset.assetId} info:`, error);
        }
      }
      
      setLoyaltyPrograms(programs);
    } catch (error: any) {
      console.error('Error fetching loyalty programs:', error);
      setError(`Error fetching loyalty programs: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProgramCreated = () => {
    // Refresh the program list and switch to view tab
    setActiveTab('view');
    fetchLoyaltyPrograms();
  };

  // Render loyalty program card
  const renderProgramCard = (program: LoyaltyProgram) => {
    const { primaryColor, secondaryColor, accentColor } = program.appearance;
    
    return (
      <motion.div
        whileHover={{ y: -5, transition: { duration: 0.2 } }}
        className="rounded-xl overflow-hidden shadow-lg"
      >
        {/* Banner */}
        <div 
          className="h-40 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${program.bannerUrl})`,
            backgroundColor: primaryColor
          }}
        >
          <div className="h-full w-full bg-gradient-to-t from-black/70 to-transparent p-4 flex flex-col justify-end">
            <h3 className="text-2xl font-bold text-white">{program.name}</h3>
            <p className="text-white/80">{program.companyName}</p>
          </div>
        </div>
        
        {/* Program details */}
        <div className="p-5 bg-white dark:bg-gray-800">
          <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
            {program.description}
          </p>
          
          {/* Tiers */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              TIERS
            </h4>
            <div className="flex flex-wrap gap-2">
              {program.tiers.map((tier, index) => (
                <span 
                  key={index}
                  className="px-2 py-1 text-xs rounded-full text-white"
                  style={{ backgroundColor: index === 0 ? primaryColor : index === 1 ? secondaryColor : accentColor }}
                >
                  {tier.name}
                </span>
              ))}
            </div>
          </div>
          
          {/* Actions */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              POINT ACTIONS
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {program.pointsPerAction.slice(0, 4).map((action, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{action.action}</span>
                  <span className="font-medium">{action.points} pts</span>
                </div>
              ))}
              {program.pointsPerAction.length > 4 && (
                <div className="text-sm text-gray-500 col-span-2 text-center">
                  +{program.pointsPerAction.length - 4} more actions
                </div>
              )}
            </div>
          </div>
          
          {/* View details link */}
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <a
              href={`${EXPLORER_URL}/asset/${program.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              View on Explorer
            </a>
            
            <button
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Manage Program
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Loyalty Programs</h2>
      </div>
      
      {!activeAddress ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Connect your wallet to create and manage loyalty programs
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              className={`py-3 px-6 font-medium text-lg ${
                activeTab === 'create'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => setActiveTab('create')}
            >
              Create Program
            </button>
            <button
              className={`py-3 px-6 font-medium text-lg ${
                activeTab === 'view'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => {
                setActiveTab('view');
                fetchLoyaltyPrograms();
              }}
            >
              My Programs
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'create' ? (
            <LoyaltyProgramCreator onProgramCreated={handleProgramCreated} />
          ) : (
            <div className="mt-6">
              {isLoading ? (
                <div className="text-center p-8">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-300">Loading your loyalty programs...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 rounded-lg">
                  {error}
                </div>
              ) : loyaltyPrograms.length === 0 ? (
                <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-gray-600 dark:text-gray-300">
                    You haven't created any loyalty programs yet.
                  </p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Create Your First Program
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {loyaltyPrograms.map((program) => (
                    <div key={program.id}>
                      {renderProgramCard(program)}
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-6 text-center">
                <button
                  onClick={fetchLoyaltyPrograms}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Refresh Programs
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 