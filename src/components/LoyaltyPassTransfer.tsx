import { useState } from 'react';
import { useWallet, useNetwork } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { getAlgodClient, getNetworkConfig } from '../utils/algod';
import { Send, CheckCircle, AlertCircle, Search, ArrowRight } from 'lucide-react';

interface LoyaltyPassTransferProps {
  onPassTransferred?: (assetId: number, recipient: string) => void;
}

export function LoyaltyPassTransfer({ onPassTransferred }: LoyaltyPassTransferProps) {
  const { activeAddress, signTransactions } = useWallet();
  const { activeNetwork } = useNetwork();
  
  const [assetId, setAssetId] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [assetInfo, setAssetInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isOptingIn, setIsOptingIn] = useState<boolean>(false);
  const [recipientOptedIn, setRecipientOptedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get network info
  const getNetworkInfo = () => {
    const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
    return getNetworkConfig(networkType);
  };
  
  const EXPLORER_URL = getNetworkInfo().explorerUrl;

  // Validate Algorand address
  const isValidAlgorandAddress = (address: string): boolean => {
    try {
      algosdk.decodeAddress(address);
      return true;
    } catch {
      return false;
    }
  };
  
  // Check if recipient has opted in to the asset
  const checkRecipientOptIn = async () => {
    if (!recipientAddress || !isValidAlgorandAddress(recipientAddress) || !assetId) {
      return;
    }
    
    setRecipientOptedIn(null);
    
    try {
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      
      const recipientInfo = await algodClient.accountInformation(recipientAddress).do();
      const recipientAssets = recipientInfo.assets || [];
      
      // Convert assetId to number for comparison
      const targetAssetId = Number(assetId);
      
      // Check if recipient has the asset in their account
      const hasOptedIn = recipientAssets.some((asset: any) => {
        // Convert asset ID to number regardless of type
        const assetIdValue = typeof asset.assetId === 'bigint' 
          ? Number(asset.assetId) 
          : Number(asset.assetId);
          
        // Compare as numbers
        return assetIdValue === targetAssetId;
      });
      
      setRecipientOptedIn(hasOptedIn);
      
      return hasOptedIn;
    } catch (error) {
      console.warn('Could not check if recipient has opted in:', error);
      setRecipientOptedIn(false);
      return false;
    }
  };
  
  // Handle opt-in for the recipient
  const handleOptIn = async () => {
    if (!activeAddress || !signTransactions) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!assetInfo) {
      setError('Please search for a valid asset first');
      return;
    }
    
    if (!recipientAddress || !isValidAlgorandAddress(recipientAddress)) {
      setError('Please enter a valid recipient wallet address');
      return;
    }
    
    setIsOptingIn(true);
    setError(null);
    
    try {
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      
      // Get suggested parameters
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Create opt-in transaction
      const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: recipientAddress,
        receiver: recipientAddress,
        assetIndex: Number(assetId),
        amount: 0, // Amount is 0 for opt-in transactions
        suggestedParams,
      });
      
      const encodedTxn = algosdk.encodeUnsignedTransaction(optInTxn);
      
      // Display the transaction for the user to sign with their wallet
      setSuccess(`Please sign the opt-in transaction with the recipient's wallet (${recipientAddress}). Once signed, the recipient will be opted in to the asset.`);
      
      // Note: In a real application, you would likely use a different approach to handle this
      // such as generating a QR code or deep link for the recipient to scan/click
      
      // For demonstration purposes, we're showing what the transaction would look like
      console.log('Opt-in transaction:', optInTxn);
      
      // After opt-in (in a real app this would happen after the recipient signs the transaction)
      await checkRecipientOptIn();
      
    } catch (error: any) {
      console.error('Error creating opt-in transaction:', error);
      setError(`Error creating opt-in transaction: ${error.message || 'Unknown error'}`);
    } finally {
      setIsOptingIn(false);
    }
  };

  // Search for asset by ID
  const searchAsset = async () => {
    if (!assetId || isNaN(Number(assetId))) {
      setError('Please enter a valid asset ID');
      setAssetInfo(null);
      return;
    }

    setIsSearching(true);
    setError(null);
    setAssetInfo(null);

    try {
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      
      // Get asset info
      const asset = await algodClient.getAssetByID(Number(assetId)).do();
      
      // Check if the current user is the manager of the asset
      if (asset.params.manager !== activeAddress) {
        setError('You are not the manager of this asset');
        setAssetInfo(null);
        return;
      }

      // Check if it's likely a loyalty pass (total supply of 1)
      const totalSupply = typeof asset.params.total === 'bigint' ? Number(asset.params.total) : Number(asset.params.total);
      if (totalSupply !== 1) {
        setError('This does not appear to be a loyalty pass (total supply should be 1)');
        setAssetInfo(null);
        return;
      }

      // Get the current holder of the asset
      const accountInfo = await algodClient.accountInformation(activeAddress).do();
      const assets = accountInfo.assets || [];
      const assetHolding = assets.find((a: any) => 
        (typeof a.assetId === 'bigint' ? Number(a.assetId) : a.assetId) === Number(assetId)
      );

      if (!assetHolding || assetHolding.amount === 0) {
        setError('You do not hold this loyalty pass');
        setAssetInfo(null);
        return;
      }

      setAssetInfo({
        id: Number(assetId),
        name: asset.params.name || 'Unnamed Asset',
        unitName: asset.params.unitName || '',
        url: asset.params.url || '',
        total: totalSupply,
        decimals: asset.params.decimals,
      });
      
      // If we have a valid recipient address, check if they've opted in to this asset
      if (recipientAddress && isValidAlgorandAddress(recipientAddress)) {
        await checkRecipientOptIn();
      }
      
    } catch (error: any) {
      console.error('Error searching for asset:', error);
      setError(`Error searching for asset: ${error.message || 'Unknown error'}`);
      setAssetInfo(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Transfer the asset
  const transferAsset = async () => {
    if (!activeAddress || !signTransactions) {
      setError('Please connect your wallet first');
      return;
    }

    if (!assetInfo) {
      setError('Please search for a valid asset first');
      return;
    }

    if (!recipientAddress) {
      setError('Please enter a recipient wallet address');
      return;
    }

    if (!isValidAlgorandAddress(recipientAddress)) {
      setError('Please enter a valid Algorand wallet address');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      
      // Check if recipient has opted in to the asset
      try {
        const hasOptedIn = await checkRecipientOptIn();
        
        if (hasOptedIn === false) {
          setError(`Recipient has not opted in to asset ${assetId}. They must opt in before you can transfer it.`);
          setIsLoading(false);
          
          // Show opt-in instructions
          const optInInstructions = `
To opt in to this asset, the recipient must:

1. Create an asset opt-in transaction:
   - Use the Algorand SDK or a wallet app
   - Asset ID: ${assetId}
   - Transaction type: Asset Opt-In (0 amount transfer to self)

2. Example code for opting in:
   await algorand.createTransaction.assetOptIn({
     recipient: "${recipientAddress}", // The recipient's address
     assetId: ${assetId}n, // The asset ID
   })
   
3. Once opted in, try transferring again
`;
          
          // Set success message with instructions
          setSuccess(optInInstructions);
          
          return;
        }
      } catch (error) {
        console.warn('Could not check if recipient has opted in:', error);
        // Continue anyway, the transaction will fail if they haven't opted in
      }
      
      // Create asset transfer transaction
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: recipientAddress,
        assetIndex: Number(assetId),
        amount: 1,
        suggestedParams,
      });

      const encodedTxn = algosdk.encodeUnsignedTransaction(transferTxn);
      const signedTxns = await signTransactions([encodedTxn]);
      
      if (signedTxns && signedTxns[0]) {
        const signedTxnBytes = signedTxns.map(txn => txn ? new Uint8Array(txn) : null).filter(Boolean) as Uint8Array[];
        const response = await algodClient.sendRawTransaction(signedTxnBytes).do();
        
        // Wait for confirmation
        await algosdk.waitForConfirmation(algodClient, response.txid, 4);
        
        setSuccess(`Successfully transferred ${assetInfo.name} (ID: ${assetId}) to ${recipientAddress}`);
        
        // Reset form
        setAssetId('');
        setRecipientAddress('');
        setAssetInfo(null);
        
        // Call callback if provided
        if (onPassTransferred) {
          onPassTransferred(Number(assetId), recipientAddress);
        }
      } else {
        throw new Error('Failed to sign transaction');
      }
    } catch (error: any) {
      console.error('Error transferring asset:', error);
      setError(`Error transferring asset: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <Send className="h-6 w-6 text-blue-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transfer Loyalty Pass</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="space-y-6">
          {/* Asset ID Search */}
          <div>
            <label className="block text-sm font-medium mb-2">Loyalty Pass Asset ID *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                placeholder="Enter asset ID number"
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={searchAsset}
                disabled={isSearching || !assetId}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSearching ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Search size={16} />
                )}
                Search
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter the asset ID of the loyalty pass you want to transfer
            </p>
          </div>

          {/* Asset Info */}
          {assetInfo && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Loyalty Pass Found</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Name:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{assetInfo.name}</span>
                </div>
                {assetInfo.unitName && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Unit Name:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{assetInfo.unitName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Asset ID:</span>
                  <a 
                    href={`${EXPLORER_URL}/asset/${assetInfo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {assetInfo.id}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Recipient Address */}
          <div>
            <label className="block text-sm font-medium mb-2">Recipient Wallet Address *</label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => {
                setRecipientAddress(e.target.value);
                // Reset opt-in status when address changes
                setRecipientOptedIn(null);
                // Check opt-in status if we have a valid address and asset
                if (isValidAlgorandAddress(e.target.value) && assetInfo) {
                  setTimeout(() => checkRecipientOptIn(), 500);
                }
              }}
              placeholder="Enter Algorand wallet address"
              className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                recipientAddress && !isValidAlgorandAddress(recipientAddress)
                  ? 'border-red-300 dark:border-red-600'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {recipientAddress && !isValidAlgorandAddress(recipientAddress) && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle size={16} />
                Invalid Algorand address
              </p>
            )}
            {recipientAddress && isValidAlgorandAddress(recipientAddress) && (
              <div className="flex items-center justify-between mt-1">
                <p className="text-green-500 text-sm flex items-center gap-1">
                  <CheckCircle size={16} />
                  Valid address
                </p>
                <button
                  onClick={checkRecipientOptIn}
                  className="text-blue-500 text-sm hover:text-blue-700 flex items-center gap-1"
                  type="button"
                >
                  Check opt-in status
                </button>
              </div>
            )}
            
            {recipientOptedIn !== null && recipientAddress && isValidAlgorandAddress(recipientAddress) && (
              <div className={`p-2 mt-2 rounded-lg ${
                recipientOptedIn 
                  ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200" 
                  : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200"
              }`}>
                {recipientOptedIn ? (
                  <p className="flex items-center gap-1 text-sm">
                    <CheckCircle size={16} />
                    Recipient has opted in to this asset
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1 text-sm">
                      <AlertCircle size={16} />
                      Recipient has not opted in to this asset
                    </p>
                    <p className="text-xs mb-2">The recipient must opt in before you can transfer the asset.</p>
                    <button
                      onClick={handleOptIn}
                      disabled={isOptingIn}
                      className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {isOptingIn ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                          Generating opt-in...
                        </>
                      ) : (
                        <>Generate opt-in instructions</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={20} className="mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle size={20} className="mt-0.5" />
              <p>{success}</p>
            </div>
          )}

          {/* Transfer Button */}
          <button
            onClick={transferAsset}
            disabled={isLoading || !assetInfo || !recipientAddress || !isValidAlgorandAddress(recipientAddress)}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Transferring...
              </>
            ) : (
              <>
                <Send size={16} />
                Transfer Loyalty Pass
              </>
            )}
          </button>
        </div>

        {/* Info Section */}
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">How to Transfer a Loyalty Pass</h3>
            <ol className="space-y-4">
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full text-white flex items-center justify-center font-medium">1</div>
                <div>
                  <p className="font-medium">Enter the Asset ID</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Find the Asset ID of the loyalty pass you want to transfer
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full text-white flex items-center justify-center font-medium">2</div>
                <div>
                  <p className="font-medium">Search and Verify</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Click Search to find and verify the loyalty pass details
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full text-white flex items-center justify-center font-medium">3</div>
                <div>
                  <p className="font-medium">Enter Recipient Address</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Enter the Algorand wallet address of the recipient
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full text-white flex items-center justify-center font-medium">4</div>
                <div>
                  <p className="font-medium">Transfer the Pass</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Click "Transfer Loyalty Pass" to complete the transfer
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
              <AlertCircle size={18} />
              Opt-In Requirement
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-200 mb-2">
              The recipient must have opted-in to the asset before you can transfer it to them. If they haven't opted in, the transfer will fail.
            </p>
            <div className="text-xs text-yellow-700 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
              <p className="font-medium mb-1">How Opt-In Works:</p>
              <ol className="list-decimal list-inside space-y-1 ml-1">
                <li>Recipient creates a special transaction to themselves with 0 amount</li>
                <li>This registers the asset ID in their account</li>
                <li>Once opted in, they can receive the asset</li>
              </ol>
              <p className="mt-2">Use the "Check opt-in status" button to verify if the recipient has already opted in.</p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-medium">Transfer Process</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  You → Recipient's Wallet
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 