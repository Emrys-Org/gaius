import { useState } from 'react';
import { useWallet, useNetwork } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { getAlgodClient, getNetworkConfig } from '../utils/algod';
import { TrendingUp, Award, Check, AlertTriangle, CreditCard } from 'lucide-react';
import { MemberCard } from './MemberCard';

interface Member {
  id: string;
  address: string;
  name: string;
  email: string;
  joinDate: string;
  totalPoints: number;
  currentTier: string;
  avatar?: string;
  assetIds: number[]; // IDs of loyalty passes owned
}

interface XPManagerProps {
  members: Member[];
  onXPUpdated: (updatedMember: Member) => void;
  programTiers?: {
    id: string;
    name: string;
    pointsRequired: number;
    description: string;
  }[];
}

// Helper function to ensure address is valid
const ensureValidAddress = (address: string): string => {
  if (!address) throw new Error('Address is empty');
  
  try {
    // Try to decode and re-encode to ensure valid format
    const decoded = algosdk.decodeAddress(address);
    return algosdk.encodeAddress(decoded.publicKey);
  } catch (error) {
    console.error('Address validation error:', error);
    throw new Error('Invalid Algorand address format');
  }
};

export function XPManager({ members, onXPUpdated, programTiers = [] }: XPManagerProps) {
  const { activeAddress, signTransactions } = useWallet();
  const { activeNetwork } = useNetwork();
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedPassId, setSelectedPassId] = useState<number | null>(null);
  const [xpAmount, setXpAmount] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Default tiers if none provided
  const defaultTiers = [
    { id: '1', name: 'Bronze', pointsRequired: 0, description: 'Basic rewards' },
    { id: '2', name: 'Silver', pointsRequired: 500, description: 'Enhanced rewards' },
    { id: '3', name: 'Gold', pointsRequired: 1000, description: 'Premium rewards' },
    { id: '4', name: 'Platinum', pointsRequired: 2500, description: 'Elite rewards' }
  ];

  const tiers = programTiers.length > 0 ? programTiers : defaultTiers;

  // Filter members based on search query
  const filteredMembers = searchQuery 
    ? members.filter(member => 
        member.address.toLowerCase().includes(searchQuery.toLowerCase()))
    : members;

  // Determine tier based on points
  const determineTier = (points: number): string => {
    // Sort tiers by points required (ascending)
    const sortedTiers = [...tiers].sort((a, b) => a.pointsRequired - b.pointsRequired);
    
    // Find the highest tier the member qualifies for
    for (let i = sortedTiers.length - 1; i >= 0; i--) {
      if (points >= sortedTiers[i].pointsRequired) {
        return sortedTiers[i].name;
      }
    }
    
    // Default to the lowest tier if no match
    return sortedTiers[0]?.name || 'Bronze';
  };

  // Check if member qualifies for tier upgrade
  const checkTierUpgrade = (member: Member, newPoints: number): { upgraded: boolean; oldTier: string; newTier: string } => {
    const oldTier = member.currentTier;
    const newTier = determineTier(newPoints);
    
    return {
      upgraded: oldTier !== newTier,
      oldTier,
      newTier
    };
  };

  // When a member is selected, automatically select their first pass if they have one
  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member);
    if (member.assetIds.length > 0) {
      setSelectedPassId(member.assetIds[0]);
    } else {
      setSelectedPassId(null);
    }
  };

  // Handle assigning XP to member
  const assignXP = async () => {
    if (!selectedMember || !activeAddress || !signTransactions || xpAmount <= 0) {
      setResult({ success: false, message: 'Please select a member and enter a valid XP amount' });
      return;
    }

    // Validate member address
    if (!selectedMember.address || selectedMember.address.trim() === '') {
      setResult({ success: false, message: 'Selected member has an invalid address' });
      return;
    }

    // Validate that a pass is selected if the member has passes
    if (selectedMember.assetIds.length > 0 && !selectedPassId) {
      setResult({ success: false, message: 'Please select a loyalty pass to update' });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      // Log for debugging
      console.log('Member address:', selectedMember.address);
      console.log('Active address:', activeAddress);
      console.log('Selected pass ID:', selectedPassId);
      
      // Get network-specific algod client
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      const networkConfig = getNetworkConfig(networkType);
      
      // Calculate new points total
      const newPointsTotal = selectedMember.totalPoints + xpAmount;
      
      // Check for tier upgrade
      const tierChange = checkTierUpgrade(selectedMember, newPointsTotal);
      
      // Create a note with the XP transaction details
      const xpNote = {
        type: 'xp_transaction',
        sender: activeAddress,
        receiver: selectedMember.address,
        amount: xpAmount,
        reason: reason || 'XP reward',
        previousTotal: selectedMember.totalPoints,
        newTotal: newPointsTotal,
        timestamp: new Date().toISOString(),
        passId: selectedPassId,
        tierChange: tierChange.upgraded ? {
          from: tierChange.oldTier,
          to: tierChange.newTier
        } : undefined
      };

      // Convert note to Uint8Array for transaction
      const noteBytes = new Uint8Array(Buffer.from(JSON.stringify(xpNote)));
      
      // Get suggested parameters for transaction
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Create a payment transaction with the XP note
      // We'll send a minimal amount of Algos (0.001) as the transaction vehicle
      try {
        // Create payment transaction
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender: activeAddress,
          receiver: ensureValidAddress(selectedMember.address),
          amount: 1000, // 0.001 Algos in microAlgos
          note: noteBytes,
          suggestedParams
        });

        // Sign the transaction
        const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
        const signedTxns = await signTransactions([encodedTxn]);
        
        if (signedTxns && signedTxns[0]) {
          const signedTxnBytes = signedTxns.map(txn => txn ? new Uint8Array(txn) : null).filter(Boolean) as Uint8Array[];
          const response = await algodClient.sendRawTransaction(signedTxnBytes).do();
          
          // Wait for confirmation
          await algosdk.waitForConfirmation(
            algodClient,
            response.txid,
            4
          );
          
          // Update the member with new XP and tier
          const updatedMember: Member = {
            ...selectedMember,
            totalPoints: newPointsTotal,
            currentTier: tierChange.newTier
          };
          
          // Call the callback to update the parent component
          onXPUpdated(updatedMember);
          
          // Set success message
          let successMessage = `Successfully assigned ${xpAmount} XP to ${selectedMember.address.substring(0, 6)}...${selectedMember.address.substring(selectedMember.address.length - 4)}`;
          if (tierChange.upgraded) {
            successMessage += ` Member upgraded from ${tierChange.oldTier} to ${tierChange.newTier}!`;
          }
          
          if (selectedPassId) {
            const explorerUrl = `${networkConfig.explorerUrl}/asset/${selectedPassId}`;
            successMessage += ` Pass #${selectedPassId} updated. <a href="${explorerUrl}" target="_blank" class="underline text-blue-500">View on Explorer</a>`;
          }
          
          setResult({ 
            success: true, 
            message: successMessage
          });
          
          // Reset form
          setXpAmount(0);
          setReason('');
        } else {
          throw new Error('Failed to sign transaction');
        }
      } catch (txError: any) {
        console.error('Transaction error:', txError);
        throw new Error(`Transaction creation failed: ${txError.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error assigning XP:', error);
      setResult({ 
        success: false, 
        message: `Error assigning XP: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle revoking XP from member
  const revokeXP = async () => {
    if (!selectedMember || !activeAddress || !signTransactions || xpAmount <= 0) {
      setResult({ success: false, message: 'Please select a member and enter a valid XP amount to revoke' });
      return;
    }

    // Validate member address
    if (!selectedMember.address || selectedMember.address.trim() === '') {
      setResult({ success: false, message: 'Selected member has an invalid address' });
      return;
    }

    // Validate that a pass is selected if the member has passes
    if (selectedMember.assetIds.length > 0 && !selectedPassId) {
      setResult({ success: false, message: 'Please select a loyalty pass to update' });
      return;
    }

    // Validate that member has enough XP to revoke
    if (xpAmount > selectedMember.totalPoints) {
      setResult({ success: false, message: `Cannot revoke more XP than the member has (${selectedMember.totalPoints} XP available)` });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      // Get network-specific algod client
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      
      // Calculate new points total
      const newPointsTotal = selectedMember.totalPoints - xpAmount;
      
      // Check for tier change
      const tierChange = checkTierUpgrade(selectedMember, newPointsTotal);
      
      // Create a note with the XP revocation details
      const xpNote = {
        type: 'xp_transaction',
        sender: activeAddress,
        receiver: selectedMember.address,
        amount: -xpAmount, // Negative amount for revocation
        reason: reason || 'XP revocation',
        previousTotal: selectedMember.totalPoints,
        newTotal: newPointsTotal,
        timestamp: new Date().toISOString(),
        passId: selectedPassId,
        tierChange: tierChange.upgraded ? {
          from: tierChange.oldTier,
          to: tierChange.newTier
        } : undefined,
        isRevocation: true
      };

      // Convert note to Uint8Array for transaction
      const noteBytes = new Uint8Array(Buffer.from(JSON.stringify(xpNote)));
      
      // Get suggested parameters for transaction
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Create payment transaction
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: ensureValidAddress(selectedMember.address),
        amount: 1000, // 0.001 Algos in microAlgos
        note: noteBytes,
        suggestedParams
      });

      // Sign the transaction
      const encodedTxn = algosdk.encodeUnsignedTransaction(txn);
      const signedTxns = await signTransactions([encodedTxn]);
      
      if (signedTxns && signedTxns[0]) {
        const signedTxnBytes = signedTxns.map(txn => txn ? new Uint8Array(txn) : null).filter(Boolean) as Uint8Array[];
        const response = await algodClient.sendRawTransaction(signedTxnBytes).do();
        
        // Wait for confirmation
        await algosdk.waitForConfirmation(
          algodClient,
          response.txid,
          4
        );
        
        // Update the member with new XP and tier
        const updatedMember: Member = {
          ...selectedMember,
          totalPoints: newPointsTotal,
          currentTier: tierChange.newTier
        };
        
        // Call the onXPUpdated callback with the updated member
        onXPUpdated(updatedMember);
        
        setResult({ 
          success: true, 
          message: `Successfully revoked ${xpAmount} XP from ${selectedMember.address.substring(0, 6)}...${selectedMember.address.substring(selectedMember.address.length - 4)}${tierChange.upgraded ? `. Member moved from ${tierChange.oldTier} to ${tierChange.newTier} tier.` : ''}`
        });
        
        // Reset form
        setXpAmount(0);
        setReason('');
      }
    } catch (error: any) {
      console.error('Error revoking XP:', error);
      setResult({ 
        success: false, 
        message: `Error revoking XP: ${error.message}` 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Render tier progress for a member
  const renderTierProgress = (member: Member) => {
    // Sort tiers by points required (ascending)
    const sortedTiers = [...tiers].sort((a, b) => a.pointsRequired - b.pointsRequired);
    
    // Find current tier object
    const currentTierObj = sortedTiers.find(t => t.name === member.currentTier) || 
                          sortedTiers.find(t => member.totalPoints >= t.pointsRequired && 
                                              (!sortedTiers[sortedTiers.indexOf(t) + 1] || 
                                               member.totalPoints < sortedTiers[sortedTiers.indexOf(t) + 1].pointsRequired));
    
    // Find the index of the current tier
    const currentTierIndex = currentTierObj ? sortedTiers.indexOf(currentTierObj) : -1;
    
    // Get next tier (if any)
    const nextTierObj = currentTierIndex < sortedTiers.length - 1 ? sortedTiers[currentTierIndex + 1] : null;
    
    const currentPoints = member.totalPoints;
    const currentTierPoints = currentTierObj?.pointsRequired || 0;
    const nextTierPoints = nextTierObj?.pointsRequired || currentTierPoints;
    
    const pointsToNextTier = Math.max(0, nextTierPoints - currentPoints);
    const progress = nextTierPoints > currentTierPoints 
      ? Math.min(100, Math.max(0, ((currentPoints - currentTierPoints) / (nextTierPoints - currentTierPoints)) * 100))
      : 100;
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="font-medium">{currentTierObj?.name || 'Bronze'}</span>
          {nextTierObj && <span className="text-gray-500">{nextTierObj.name}</span>}
        </div>
        
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>{currentPoints} points</span>
          {nextTierObj && <span>{pointsToNextTier} points to {nextTierObj.name}</span>}
          {!nextTierObj && <span>Maximum tier reached!</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-6 w-6 text-blue-500" />
        <h2 className="text-2xl font-bold">XP Manager</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Member Selection */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search Members</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or address..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
              <h3 className="font-medium">Select Member</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No members found
                </div>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredMembers.map((member) => (
                    <li 
                      key={member.id}
                      onClick={() => handleMemberSelect(member)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        selectedMember?.id === member.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium font-mono">
                            {member.address.substring(0, 8)}...{member.address.substring(member.address.length - 4)}
                          </p>
                          <div className="mt-1">
                            <span className="text-xs text-gray-500">
                              {member.assetIds.length} {member.assetIds.length === 1 ? 'pass' : 'passes'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{member.totalPoints.toLocaleString()} XP</p>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            member.currentTier === 'Platinum' ? 'bg-purple-100 text-purple-800' :
                            member.currentTier === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                            member.currentTier === 'Silver' ? 'bg-gray-100 text-gray-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {member.currentTier}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        
        {/* Right Column - XP Assignment & Tier Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* XP Assignment Form */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-medium mb-4">Assign XP</h3>
            
            {selectedMember ? (
              <div className="space-y-4">
                <MemberCard
                  member={selectedMember}
                  tiers={tiers}
                  showActions={false}
                  showTierProgress={true}
                  showXPHistory={false}
                />
                
                {/* Loyalty Pass Selection - only show if member has passes */}
                {selectedMember.assetIds.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-1">
                      <CreditCard size={16} />
                      Select Loyalty Pass to Update
                    </label>
                    <select
                      value={selectedPassId || ''}
                      onChange={(e) => setSelectedPassId(Number(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {selectedMember.assetIds.map((assetId) => (
                        <option key={assetId} value={assetId}>
                          Pass #{assetId}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium mb-2">XP Amount</label>
                  <input
                    type="number"
                    value={xpAmount}
                    onChange={(e) => setXpAmount(parseInt(e.target.value) || 0)}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Reason (Optional)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Purchase, Referral, Special event"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                {/* Preview tier change */}
                {xpAmount > 0 && (
                  <div className="p-3 bg-gray-100 dark:bg-gray-600 rounded-lg">
                    <p className="font-medium mb-2">After assigning {xpAmount} XP:</p>
                    <div className="flex justify-between">
                      <span>New total:</span>
                      <span className="font-bold">{(selectedMember.totalPoints + xpAmount).toLocaleString()} XP</span>
                    </div>
                    
                    {/* Show tier change if applicable */}
                    {(() => {
                      const tierChange = checkTierUpgrade(selectedMember, selectedMember.totalPoints + xpAmount);
                      if (tierChange.upgraded) {
                        return (
                          <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg">
                            <p className="flex items-center gap-1">
                              <Award size={16} />
                              <span>Tier upgrade: {tierChange.oldTier} → {tierChange.newTier}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Show projected tier progress */}
                    <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-500">
                      <p className="text-sm font-medium mb-2">Projected Tier Progress:</p>
                      {renderTierProgress({
                        ...selectedMember,
                        totalPoints: selectedMember.totalPoints + xpAmount,
                        currentTier: determineTier(selectedMember.totalPoints + xpAmount)
                      })}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-4">
                  <button
                    onClick={assignXP}
                    disabled={isProcessing || !selectedMember || xpAmount <= 0}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <TrendingUp size={20} />
                        Award XP
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={revokeXP}
                    disabled={isProcessing || !selectedMember || xpAmount <= 0 || (selectedMember && xpAmount > selectedMember.totalPoints)}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={20} />
                        Revoke XP
                      </>
                    )}
                  </button>
                </div>
                
                {/* Result message */}
                {result && (
                  <div className={`p-3 rounded-lg ${
                    result.success 
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
                      : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {result.success ? <Check size={16} /> : <AlertTriangle size={16} />}
                      <div dangerouslySetInnerHTML={{ __html: result.message }}></div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-4 text-gray-500">
                Please select a member from the list
              </div>
            )}
          </div>
          
          {/* Tier Information */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-medium mb-4">Tier Progression</h3>
            <div className="space-y-3">
              {tiers.map((tier, index) => (
                <div 
                  key={tier.id} 
                  className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div 
                    className={`w-3 h-3 rounded-full ${
                      tier.name === 'Platinum' ? 'bg-purple-500' :
                      tier.name === 'Gold' ? 'bg-yellow-500' :
                      tier.name === 'Silver' ? 'bg-gray-400' :
                      'bg-orange-500'
                    }`}
                  ></div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="font-medium">{tier.name}</p>
                      <p className="font-bold">{tier.pointsRequired.toLocaleString()} XP</p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{tier.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 