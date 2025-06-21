import { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { NFTMinter } from './NFTMinter';
import { algodClient, ALGORAND_NETWORK } from '../utils/algod';
import { getIPFSGatewayURL } from '../utils/pinata';

interface NFTInfo {
  id: number;
  name: string;
  unitName: string;
  url: string;
  total: number;
  decimals: number;
  imageUrl: string;
  mediaType?: 'image' | 'video' | 'audio' | 'model' | 'document' | 'other';
  metadata?: any;
}

// Helper to determine media type from metadata or URL
const getMediaType = (nft: NFTInfo): 'image' | 'video' | 'audio' | 'model' | 'document' | 'other' => {
  // First check if we have mediaType in the metadata
  if (nft.metadata?.mediaType) {
    return nft.metadata.mediaType;
  }
  
  // If not, try to determine from properties
  if (nft.metadata?.properties?.mimeType) {
    const mimeType = nft.metadata.properties.mimeType;
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('model/')) return 'model';
    if (mimeType === 'application/pdf') return 'document';
  }
  
  // If still not determined, try from URL extension
  const url = nft.url.toLowerCase();
  if (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || 
      url.endsWith('.gif') || url.endsWith('.webp') || url.endsWith('.svg')) {
    return 'image';
  }
  if (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg')) {
    return 'video';
  }
  if (url.endsWith('.mp3') || url.endsWith('.wav')) {
    return 'audio';
  }
  if (url.endsWith('.glb') || url.endsWith('.gltf')) {
    return 'model';
  }
  if (url.endsWith('.pdf')) {
    return 'document';
  }
  
  // Default to image if we can't determine
  return 'image';
};

export function NFTDashboard() {
  const { activeAddress } = useWallet();
  const [userNFTs, setUserNFTs] = useState<NFTInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'mint' | 'view'>('mint');
  const [error, setError] = useState<string | null>(null);

  // Use Lora AlgoKit Explorer URL for TestNet
  const EXPLORER_URL = ALGORAND_NETWORK.explorerUrl;

  useEffect(() => {
    if (activeAddress && activeTab === 'view') {
      fetchUserNFTs();
    }
  }, [activeAddress, activeTab]);

  const fetchUserNFTs = async () => {
    if (!activeAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get account information including assets
      const accountInfo = await algodClient.accountInformation(activeAddress).do();
      
      // Filter for assets (NFTs) owned by the user
      const assets = accountInfo.assets || [];
      
      // Create an array to store NFT information
      const nftsInfo: NFTInfo[] = [];
      
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
            let imageUrl = url;
            let metadata = null;
            
            // Handle IPFS URLs
            if (url && (url.startsWith('ipfs://') || url.includes('/ipfs/'))) {
              imageUrl = getIPFSGatewayURL(url);
              
              // Try to fetch metadata if it's an IPFS URL
              try {
                const response = await fetch(imageUrl);
                if (response.ok) {
                  metadata = await response.json();
                  // If metadata has an image field that's IPFS, use that as the image URL
                  if (metadata.image) {
                    imageUrl = getIPFSGatewayURL(metadata.image);
                  }
                }
              } catch (e) {
                console.warn(`Failed to fetch metadata for asset ${asset.assetId}`, e);
              }
            }
            
            const nftInfo: NFTInfo = {
              id: asset.assetId,
              name: params.name || 'Unnamed NFT',
              unitName: params.unitName || '',
              url: url,
              total: totalSupply,
              decimals: params.decimals,
              imageUrl,
              metadata
            };
            
            // Determine media type
            nftInfo.mediaType = getMediaType(nftInfo);
            
            nftsInfo.push(nftInfo);
          }
        } catch (error) {
          console.error(`Error fetching asset ${asset.assetId} info:`, error);
        }
      }
      
      setUserNFTs(nftsInfo);
    } catch (error: any) {
      console.error('Error fetching NFTs:', error);
      setError(`Error fetching NFTs: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNFTMinted = () => {
    // Refresh the NFT list and switch to view tab
    setActiveTab('view');
    fetchUserNFTs();
  };

  // Render media based on type
  const renderNFTMedia = (nft: NFTInfo) => {
    const mediaType = nft.mediaType || 'image';
    
    switch (mediaType) {
      case 'image':
        return (
          <img
            src={nft.imageUrl}
            alt={nft.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // If image fails to load, show fallback
              (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=No+Image';
            }}
          />
        );
      case 'video':
        return (
          <video
            src={nft.imageUrl}
            controls
            className="w-full h-full object-cover"
            onError={() => console.error('Video failed to load')}
          />
        );
      case 'audio':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700 p-4">
            <div className="text-center mb-2">
              <p className="text-sm font-medium">Audio NFT</p>
              <p className="text-xs text-gray-500">{nft.name}</p>
            </div>
            <audio
              src={nft.imageUrl}
              controls
              className="w-full mt-2"
              onError={() => console.error('Audio failed to load')}
            />
          </div>
        );
      case 'model':
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
            <div className="text-center p-4">
              <p className="text-sm font-medium">3D Model</p>
              <p className="text-xs text-gray-500 mt-1">{nft.name}</p>
              <a 
                href={nft.imageUrl} 
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-blue-500 hover:underline"
              >
                View 3D Model
              </a>
            </div>
          </div>
        );
      case 'document':
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
            <div className="text-center p-4">
              <p className="text-sm font-medium">Document</p>
              <p className="text-xs text-gray-500 mt-1">{nft.name}</p>
              <a 
                href={nft.imageUrl} 
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-blue-500 hover:underline"
              >
                View Document
              </a>
            </div>
          </div>
        );
      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
            <div className="text-center p-4">
              <p className="text-sm font-medium">NFT</p>
              <p className="text-xs text-gray-500 mt-1">{nft.name}</p>
              <a 
                href={nft.imageUrl} 
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-blue-500 hover:underline"
              >
                View Content
              </a>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 my-8">
      <h2 className="text-3xl font-bold mb-8">NFT Dashboard</h2>
      
      {!activeAddress ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Connect your wallet to mint and view your NFTs
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            <button
              className={`py-3 px-6 font-medium text-lg ${
                activeTab === 'mint'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => setActiveTab('mint')}
            >
              Mint NFT 
            </button>
            <button
              className={`py-3 px-6 font-medium text-lg ${
                activeTab === 'view'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => {
                setActiveTab('view');
                fetchUserNFTs();
              }}
            >
              View My NFTs
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'mint' ? (
            <NFTMinter onNFTMinted={handleNFTMinted} />
          ) : (
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-4">My NFTs</h3>
              
              {isLoading ? (
                <div className="text-center p-8">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-300">Loading your NFTs...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 rounded-lg">
                  {error}
                </div>
              ) : userNFTs.length === 0 ? (
                <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-gray-600 dark:text-gray-300">
                    You don't have any NFTs yet. Mint one to get started!
                  </p>
                  <button
                    onClick={() => setActiveTab('mint')}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    Mint an NFT
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {userNFTs.map((nft) => (
                    <div
                      key={nft.id}
                      className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col"
                    >
                      <div className="h-48 bg-gray-200 dark:bg-gray-700 relative flex items-center justify-center overflow-hidden">
                        {renderNFTMedia(nft)}
                        
                        {/* Media type badge */}
                        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          {nft.mediaType || 'image'}
                        </div>
                      </div>
                      
                      <div className="p-4 flex-grow">
                        <h4 className="text-lg font-semibold mb-1 truncate">{nft.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          {nft.unitName ? `${nft.unitName} • ` : ''}ID: {nft.id}
                        </p>
                        
                        {nft.metadata && nft.metadata.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                            {nft.metadata.description}
                          </p>
                        )}
                      </div>
                      
                      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                        <a
                          href={`${EXPLORER_URL}/asset/${nft.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-sm"
                        >
                          View on Lora Explorer
                        </a>
                        
                        <a
                          href={nft.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-sm"
                        >
                          View Media
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-6 text-center">
                <button
                  onClick={fetchUserNFTs}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Refresh NFTs
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 