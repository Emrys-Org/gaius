import { useState, useRef, ChangeEvent } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { algodClient } from '../utils/algod';
import { pinFileToIPFS } from '../utils/pinata';

interface NFTMinterProps {
  onNFTMinted?: () => void;
}

// Supported media types
const SUPPORTED_MEDIA_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
  model: ['model/gltf-binary', 'model/gltf+json'],
  document: ['application/pdf']
};

// Get all supported media types as a single array
const ALL_SUPPORTED_TYPES = Object.values(SUPPORTED_MEDIA_TYPES).flat();

// Helper to determine media type
const getMediaType = (mimeType: string): 'image' | 'video' | 'audio' | 'model' | 'document' | 'other' => {
  if (SUPPORTED_MEDIA_TYPES.image.includes(mimeType)) return 'image';
  if (SUPPORTED_MEDIA_TYPES.video.includes(mimeType)) return 'video';
  if (SUPPORTED_MEDIA_TYPES.audio.includes(mimeType)) return 'audio';
  if (SUPPORTED_MEDIA_TYPES.model.includes(mimeType)) return 'model';
  if (SUPPORTED_MEDIA_TYPES.document.includes(mimeType)) return 'document';
  return 'other';
};

export function NFTMinter({ onNFTMinted }: NFTMinterProps) {
  const { activeAddress, signTransactions } = useWallet();
  const [nftName, setNftName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'select' | 'uploading' | 'uploaded'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'model' | 'document' | 'other'>('image');
  const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);
  const [ipfsCid, setIpfsCid] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; assetId?: number }>(); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use Lora AlgoKit Explorer URL for TestNet
  const EXPLORER_URL = 'https://lora.algokit.io/testnet';

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Determine media type
      const type = getMediaType(file.type);
      setMediaType(type);
      
      // Create preview URL for supported types
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadToIPFS = async () => {
    if (!selectedFile) return;
    
    try {
      setUploadStep('uploading');
      const result = await pinFileToIPFS(selectedFile);
      
      if (result.success && result.cid) {
        setIpfsCid(result.cid);
        setIpfsUrl(`https://gateway.pinata.cloud/ipfs/${result.cid}`);
        setUploadStep('uploaded');
      } else {
        throw new Error(result.message || 'Failed to upload to IPFS');
      }
    } catch (error: any) {
      setResult({ 
        success: false, 
        message: `Error uploading to IPFS: ${error.message || JSON.stringify(error)}` 
      });
      setUploadStep('select');
    }
  };

  const mintNFT = async () => {
    if (!activeAddress || !signTransactions) {
      setResult({ success: false, message: 'Please connect your wallet first' });
      return;
    }

    if (!nftName || !unitName || !ipfsUrl) {
      setResult({ success: false, message: 'Please fill all required fields and upload a file' });
      return;
    }

    setIsLoading(true);
    setResult(undefined);

    try {
      // Get suggested parameters
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Create NFT metadata object
      const metadata = {
        name: nftName,
        description: description,
        image: ipfsUrl,
        mediaType: mediaType,
        properties: {
          ipfsCid: ipfsCid,
          mimeType: selectedFile?.type || '',
          fileSize: selectedFile?.size || 0,
          fileName: selectedFile?.name || '',
        }
      };

      // Convert metadata to Uint8Array for note field
      const metadataStr = JSON.stringify(metadata);
      const metadataBytes = new Uint8Array(Buffer.from(metadataStr));

      // Create asset creation transaction
      const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        total: 1,
        decimals: 0,
        assetName: nftName,
        unitName: unitName,
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
          message: `NFT created successfully!`, 
          assetId 
        });

        // Reset form after successful mint
        setNftName('');
        setUnitName('');
        setDescription('');
        setSelectedFile(null);
        setPreviewUrl(null);
        setIpfsUrl(null);
        setIpfsCid(null);
        setUploadStep('select');
        
        // Call the onNFTMinted callback if provided
        if (onNFTMinted) {
          onNFTMinted();
        }
      } else {
        throw new Error('Failed to sign transaction');
      }
    } catch (error: any) {
      setResult({ 
        success: false, 
        message: `Error creating NFT: ${error.message || JSON.stringify(error)}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Render preview based on media type
  const renderPreview = () => {
    if (!previewUrl) return null;

    switch (mediaType) {
      case 'image':
        return (
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="max-h-48 mx-auto rounded-lg"
          />
        );
      case 'video':
        return (
          <video 
            src={previewUrl} 
            controls 
            className="max-h-48 w-full mx-auto rounded-lg"
          />
        );
      case 'audio':
        return (
          <div className="text-center">
            <audio 
              src={previewUrl} 
              controls 
              className="mx-auto mb-2"
            />
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
              <p className="text-sm">Audio file</p>
            </div>
          </div>
        );
      case 'model':
        return (
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg flex items-center justify-center h-32">
            <p className="text-sm">3D Model (preview not available)</p>
          </div>
        );
      case 'document':
        return (
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg flex items-center justify-center h-32">
            <p className="text-sm">Document file</p>
          </div>
        );
      default:
        return (
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg flex items-center justify-center h-32">
            <p className="text-sm">File uploaded</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* File Upload Section */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <h3 className="text-lg font-medium mb-4">1. Upload Media to IPFS</h3>
        
        {uploadStep === 'select' && (
          <div className="space-y-4">
            <div 
              onClick={triggerFileInput}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={ALL_SUPPORTED_TYPES.join(',')}
                className="hidden"
              />
              
              {previewUrl ? (
                <div className="space-y-4">
                  {renderPreview()}
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <p>{selectedFile?.name}</p>
                    <p className="text-xs">{(selectedFile?.size || 0) / 1024 < 1024 ? 
                      `${Math.round((selectedFile?.size || 0) / 1024)} KB` : 
                      `${Math.round((selectedFile?.size || 0) / 1024 / 1024 * 10) / 10} MB`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-gray-500 dark:text-gray-400">Click to select a file</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Supported formats: Images, Videos, Audio, 3D Models, PDFs
                  </p>
                </div>
              )}
            </div>
            
            {selectedFile && (
              <button
                onClick={uploadToIPFS}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Upload to IPFS
              </button>
            )}
          </div>
        )}
        
        {uploadStep === 'uploading' && (
          <div className="text-center p-6">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Uploading to IPFS...</p>
          </div>
        )}
        
        {uploadStep === 'uploaded' && ipfsUrl && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                {mediaType === 'image' ? (
                  <img 
                    src={ipfsUrl} 
                    alt="IPFS Preview" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-center p-2">
                    <p className="text-xs font-medium">{mediaType.toUpperCase()}</p>
                    <p className="text-xs text-gray-500">File</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-green-600 dark:text-green-400 font-medium">Successfully uploaded to IPFS!</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 break-all">{ipfsUrl}</p>
              </div>
            </div>
            <button
              onClick={() => setUploadStep('select')}
              className="text-blue-500 hover:underline text-sm"
            >
              Upload a different file
            </button>
          </div>
        )}
      </div>
      
      {/* NFT Details Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium mb-2">2. Enter NFT Details</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            NFT Name*
          </label>
          <input
            type="text"
            value={nftName}
            onChange={(e) => setNftName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="My Awesome NFT"
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Unit Name* (3-8 characters)
          </label>
          <input
            type="text"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="MYNFT"
            maxLength={8}
            disabled={isLoading}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Description of your NFT"
            rows={3}
            disabled={isLoading}
          />
        </div>
      </div>
      
      {/* Mint Button */}
      <button
        onClick={mintNFT}
        disabled={isLoading || !nftName || !unitName || !ipfsUrl}
        className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
      >
        {isLoading ? 'Minting NFT...' : 'Mint NFT'}
      </button>
      
      {/* Result Message */}
      {result && (
        <div className={`mt-4 p-4 rounded-lg ${result.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
          <p>{result.message}</p>
          {result.assetId && (
            <p className="mt-2">
              Asset ID: {result.assetId} - View on{' '}
              <a 
                href={`${EXPLORER_URL}/asset/${result.assetId}`}
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