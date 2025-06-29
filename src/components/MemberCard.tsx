import { useState, useEffect } from 'react';
import { Award, TrendingUp, CreditCard, MessageSquare } from 'lucide-react';
import { XPTransaction } from '../utils/xp';
import { TextWithCopy } from './TextWithCopy';
import { getFirstLoyaltyPassDate } from '../utils/algod';
import { useNetwork } from '@txnlab/use-wallet-react';

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
  xpHistory?: XPTransaction[];
  hasUnreadMessages?: boolean;
}

interface Tier {
  id: string;
  name: string;
  pointsRequired: number;
  description: string;
}

interface MemberCardProps {
  member: Member;
  tiers: Tier[];
  onSendMessage?: (member: Member) => void;
  onIssueLoyaltyPass?: (member: Member) => void;
  onUpdateXP?: (member: Member) => void;
  showActions?: boolean;
  showTierProgress?: boolean;
  showXPHistory?: boolean;
}

export function MemberCard({ 
  member, 
  tiers,
  onSendMessage, 
  onIssueLoyaltyPass,
  onUpdateXP,
  showActions = true,
  showTierProgress = true,
  showXPHistory = false
}: MemberCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [actualJoinDate, setActualJoinDate] = useState<string | null>(null);
  const { activeNetwork } = useNetwork();

  useEffect(() => {
    const fetchJoinDate = async () => {
      const network = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const date = await getFirstLoyaltyPassDate(member.address, member.assetIds, network);
      if (date) {
        setActualJoinDate(date);
      }
    };

    fetchJoinDate();
  }, [member.address, member.assetIds, activeNetwork]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
  };

  // Determine tier progress
  const renderTierProgress = () => {
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
    <div className="bg-white dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
            {member.address.substring(0, 2)}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white font-mono">
              {formatAddress(member.address)}
              <button 
                onClick={() => navigator.clipboard.writeText(member.address)}
                className="ml-2 text-blue-500 hover:text-blue-600 transition-colors"
                title="Copy wallet address"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Member since {actualJoinDate ? new Date(actualJoinDate).toLocaleDateString() : 'Loading...'}
            </p>
          </div>
        </div>
        
        {showActions && (
          <div className="flex items-center gap-2">
            {onSendMessage && (
              <button
                onClick={() => onSendMessage(member)}
                className="text-blue-500 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                title="Send message"
              >
                <MessageSquare size={20} />
              </button>
            )}
            {onUpdateXP && (
              <button
                onClick={() => onUpdateXP(member)}
                className="text-green-500 hover:text-green-600 transition-colors p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20"
                title="Update XP"
              >
                <TrendingUp size={20} />
              </button>
            )}
            {onIssueLoyaltyPass && (
              <button
                onClick={() => onIssueLoyaltyPass(member)}
                className="text-blue-500 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                title="Issue loyalty pass"
              >
                <CreditCard size={20} />
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400">Total XP</span>
          <span className="font-medium text-gray-900 dark:text-white">{member.totalPoints}</span>
        </div>
        
        <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400">Current Tier</span>
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            member.currentTier === 'Platinum' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' :
            member.currentTier === 'Gold' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300' :
            member.currentTier === 'Silver' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
            'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300'
          }`}>
            {member.currentTier}
          </span>
        </div>
        
        <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-700">
          <span className="text-gray-600 dark:text-gray-400">Loyalty Passes</span>
          <span className="font-medium text-gray-900 dark:text-white">{member.assetIds.length}</span>
        </div>
        
        {showTierProgress && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-gray-900 dark:text-white">Tier Progress</h5>
              <Award size={16} className="text-blue-500" />
            </div>
            {renderTierProgress()}
          </div>
        )}
        
        {member.assetIds.length > 0 && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-blue-500 hover:text-blue-700 transition-colors"
            >
              {expanded ? 'Hide passes' : 'Show loyalty passes'}
            </button>
            
            {expanded && (
              <div className="mt-2 space-y-2">
                {member.assetIds.map(assetId => (
                  <div key={assetId} className="text-sm bg-gray-50 dark:bg-gray-800 rounded p-2 flex justify-between items-center">
                    <span className="font-medium">Pass #{assetId}</span>
                    <a 
                      href={`https://lora.algokit.io/${member.currentTier === 'mainnet' ? 'mainnet' : 'testnet'}/asset/${assetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {member.xpHistory && member.xpHistory.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors mb-2 flex items-center justify-between"
          >
            <span>XP History</span>
            <span className="text-gray-400">{showHistory ? '▼' : '▶'}</span>
          </button>
          
          {showHistory && (
            <div className="space-y-3 mt-4">
              {member.xpHistory.map((transaction) => (
                <div 
                  key={transaction.txId}
                  className={`p-4 rounded-lg ${
                    transaction.isRevocation
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium">
                        {transaction.isRevocation ? 'XP Revoked' : 'XP Earned'}: {transaction.amount} points
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(transaction.timestamp)} at {formatTime(transaction.timestamp)}
                      </p>
                    </div>
                    <span className={`text-sm font-medium ${
                      transaction.isRevocation ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {transaction.isRevocation ? '-' : '+'}{transaction.amount}
                    </span>
                  </div>
                  {transaction.reason && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {transaction.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 