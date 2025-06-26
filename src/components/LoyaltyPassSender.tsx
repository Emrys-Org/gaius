import { useState } from 'react';
import { useWallet, useNetwork } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { getAlgodClient, getNetworkConfig } from '../utils/algod';
import { Send, CreditCard, User, Wallet, CheckCircle, AlertCircle, Copy, QrCode } from 'lucide-react';
import * as QRCode from 'qrcode';

interface LoyaltyProgram {
  id: number;
  name: string;
  imageUrl: string;
  metadata?: any;
}

interface Member {
  id: string;
  name: string;
  email?: string;
  tier: string;
  points: number;
}

interface LoyaltyPassSenderProps {
  loyaltyPrograms: LoyaltyProgram[];
  onPassSent?: (assetId: number) => void;
}

export function LoyaltyPassSender({ loyaltyPrograms, onPassSent }: LoyaltyPassSenderProps) {
  const { activeAddress, signTransactions } = useWallet();
  const { activeNetwork } = useNetwork();
  
  const [selectedProgramId, setSelectedProgramId] = useState(loyaltyPrograms[0]?.id || 0);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [memberInfo, setMemberInfo] = useState<Member>({
    id: '',
    name: '',
    email: '',
    tier: 'Bronze',
    points: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; assetId?: number } | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // Generate QR code for the pass
  const generatePassQRCode = async (passData: any): Promise<string> => {
    try {
      const qrData = {
        type: 'loyalty-pass',
        assetId: passData.assetId,
        member: passData.member,
        program: passData.program,
        network: activeNetwork,
        timestamp: new Date().toISOString(),
      };

      const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 200,
        margin: 2,
        color: {
          dark: '#3B82F6',
          light: '#FFFFFF'
        }
      });

      return qrCodeUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  // Send loyalty pass
  const sendLoyaltyPass = async () => {
    if (!activeAddress || !signTransactions) {
      setResult({ success: false, message: 'Please connect your wallet first' });
      return;
    }

    if (!recipientAddress) {
      setResult({ success: false, message: 'Please enter a recipient wallet address' });
      return;
    }

    if (!isValidAlgorandAddress(recipientAddress)) {
      setResult({ success: false, message: 'Please enter a valid Algorand wallet address' });
      return;
    }

    if (!memberInfo.name) {
      setResult({ success: false, message: 'Please enter member name' });
      return;
    }

    const selectedProgram = loyaltyPrograms.find(p => p.id === selectedProgramId);
    if (!selectedProgram) {
      setResult({ success: false, message: 'Please select a loyalty program' });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Get network-specific algod client
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      
      // Get suggested parameters
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Create Loyalty Program Pass metadata
      const passMetadata = {
        program: {
          id: selectedProgram.id,
          name: selectedProgram.name,
        },
        member: {
          ...memberInfo,
          joinDate: new Date().toISOString()
        },
        type: 'loyalty_pass',
        version: '1.0',
        created: new Date().toISOString()
      };
      
      // Convert metadata to Uint8Array for note field
      const metadataStr = JSON.stringify(passMetadata);
      const metadataBytes = new Uint8Array(Buffer.from(metadataStr));
      
      // Create asset creation transaction for the Loyalty Program Pass
      const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        total: 1,
        decimals: 0,
        assetName: `${selectedProgram.name} Pass - ${memberInfo.name}`,
        unitName: 'PASS',
        assetURL: selectedProgram.imageUrl || '',
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
        
        // Transfer the Loyalty Program Pass to recipient if different from sender
        if (recipientAddress && recipientAddress !== activeAddress) {
          try {
            const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
              sender: activeAddress,
              receiver: recipientAddress,
              amount: 1,
              assetIndex: assetId,
              suggestedParams: await algodClient.getTransactionParams().do(),
            });

            const encodedTransferTxn = algosdk.encodeUnsignedTransaction(transferTxn);
            const signedTransferTxns = await signTransactions([encodedTransferTxn]);
            
            if (signedTransferTxns && signedTransferTxns[0]) {
              const signedTransferTxnBytes = signedTransferTxns.map(txn => txn ? new Uint8Array(txn) : null).filter(Boolean) as Uint8Array[];
              await algodClient.sendRawTransaction(signedTransferTxnBytes).do();
              
              setResult({ 
                success: true, 
                message: `Loyalty Program Pass sent successfully to ${recipientAddress}!`, 
                assetId 
              });
            }
          } catch (transferError) {
            setResult({ 
              success: true, 
              message: `Loyalty Program Pass created (Asset ID: ${assetId}) but transfer failed. You can manually transfer it later.`, 
              assetId 
            });
          }
        } else {
          setResult({ 
            success: true, 
            message: `Loyalty Program Pass created successfully! Asset ID: ${assetId}`, 
            assetId 
          });
        }

        // Generate QR code for the pass
        const qrCode = await generatePassQRCode({
          assetId,
          member: passMetadata.member,
          program: passMetadata.program
        });
        setQrCodeUrl(qrCode);

        // Call callback if provided
        if (onPassSent) {
          onPassSent(assetId);
        }

        // Reset form
        setMemberInfo({
          id: '',
          name: '',
          email: '',
          tier: 'Bronze',
          points: 0
        });
        setRecipientAddress('');
      } else {
        throw new Error('Failed to sign transaction');
      }
    } catch (error: any) {
      console.error('Error sending loyalty pass:', error);
      setResult({ 
        success: false, 
        message: `Error sending loyalty pass: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loyaltyPrograms.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
        <CreditCard className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
          No Loyalty Programs Found
        </h3>
        <p className="text-yellow-700 dark:text-yellow-300">
          You need to create a loyalty program first before you can send loyalty passes.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <Send className="h-6 w-6 text-blue-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Send Loyalty Pass</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="space-y-6">
          {/* Program Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Loyalty Program *</label>
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {loyaltyPrograms.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name} (ID: {program.id})
                </option>
              ))}
            </select>
          </div>

          {/* Recipient Address */}
          <div>
            <label className="block text-sm font-medium mb-2">Recipient Wallet Address *</label>
            <div className="relative">
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Enter Algorand wallet address (58 characters)"
                className={`w-full px-4 py-3 pr-12 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  recipientAddress && !isValidAlgorandAddress(recipientAddress)
                    ? 'border-red-300 dark:border-red-600'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              <Wallet className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
            {recipientAddress && !isValidAlgorandAddress(recipientAddress) && (
              <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                <AlertCircle size={16} />
                Invalid Algorand address format
              </p>
            )}
            {recipientAddress && isValidAlgorandAddress(recipientAddress) && (
              <p className="text-green-500 text-sm mt-1 flex items-center gap-1">
                <CheckCircle size={16} />
                Valid Algorand address
              </p>
            )}
          </div>

          {/* Member Information */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User size={18} />
              Member Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Member Name *</label>
                <input
                  type="text"
                  value={memberInfo.name}
                  onChange={(e) => setMemberInfo({ ...memberInfo, name: e.target.value })}
                  placeholder="e.g., John Doe"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Tier</label>
                <select
                  value={memberInfo.tier}
                  onChange={(e) => setMemberInfo({ ...memberInfo, tier: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="Bronze">Bronze</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                  <option value="Diamond">Diamond</option>
                </select>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="mt-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-blue-500 hover:text-blue-700 text-sm font-medium"
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </button>
              
              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={memberInfo.email}
                      onChange={(e) => setMemberInfo({ ...memberInfo, email: e.target.value })}
                      placeholder="member@example.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Points</label>
                    <input
                      type="number"
                      value={memberInfo.points}
                      onChange={(e) => setMemberInfo({ ...memberInfo, points: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Send Button */}
          <button
            onClick={sendLoyaltyPass}
            disabled={isLoading || !recipientAddress || !memberInfo.name || !isValidAlgorandAddress(recipientAddress)}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                Sending Pass...
              </>
            ) : (
              <>
                <Send size={16} />
                Send Loyalty Pass
              </>
            )}
          </button>
        </div>

        {/* Preview Section */}
        <div className="space-y-6">
          {/* Pass Preview */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-semibold mb-4">Pass Preview</h3>
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-lg">
                    {loyaltyPrograms.find(p => p.id === selectedProgramId)?.name || 'Loyalty Program'}
                  </h4>
                  <p className="text-blue-100 text-sm">
                    {loyaltyPrograms.find(p => p.id === selectedProgramId)?.metadata?.co || 'Company'}
                  </p>
                </div>
                <CreditCard size={24} className="text-blue-200" />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-blue-100 text-xs">MEMBER</p>
                  <p className="font-medium">{memberInfo.name || 'Member Name'}</p>
                </div>
                <div className="text-right">
                  <p className="text-blue-100 text-xs">TIER</p>
                  <p className="font-bold text-yellow-300">{memberInfo.tier}</p>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code */}
          {qrCodeUrl && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <QrCode size={16} />
                Pass QR Code
              </h3>
              <div className="text-center">
                <div className="bg-white p-4 rounded-lg inline-block shadow-sm">
                  <img 
                    src={qrCodeUrl} 
                    alt="Pass QR Code" 
                    className="w-32 h-32"
                  />
                </div>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = qrCodeUrl;
                    link.download = `loyalty-pass-qr-${Date.now()}.png`;
                    link.click();
                  }}
                  className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mx-auto"
                >
                  <QrCode size={16} />
                  Download QR Code
                </button>
              </div>
            </div>
          )}

          {/* Result Message */}
          {result && (
            <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
              <div className="flex items-start gap-2">
                {result.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <div className="flex-1">
                  <p>{result.message}</p>
                  {result.assetId && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Asset ID: {result.assetId}</span>
                        <button
                          onClick={() => copyToClipboard(result.assetId!.toString())}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <a 
                        href={`${EXPLORER_URL}/asset/${result.assetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-sm underline hover:no-underline"
                      >
                        View on Explorer
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 