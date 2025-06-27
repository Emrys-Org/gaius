import { useState } from 'react';
import { Award, TrendingUp, CreditCard, MessageSquare } from 'lucide-react';
import { XPTransaction } from '../utils/xp';

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
          {member.avatar ? (
            <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-full" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
              {member.name.charAt(0)}
            </div>
          )}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {member.name}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {member.address.substring(0, 8)}...{member.address.substring(member.address.length - 4)}
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
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {transaction.isRevocation ? (
                        <AlertTriangle className="text-red-500" size={20} />
                      ) : (
                        <TrendingUp className="text-green-500" size={20} />
                      )}
                      <span className={`text-lg font-bold ${
                        transaction.isRevocation ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {transaction.isRevocation ? '-' : '+'}{Math.abs(transaction.amount)} XP
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(transaction.timestamp)}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{formatTime(transaction.timestamp)}</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    {transaction.reason}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <Clock size={16} />
                      <span>Previous: {transaction.previousTotal}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <TrendingUp size={16} />
                      <span>New: {transaction.newTotal}</span>
                    </div>
                  </div>
                  
                  {transaction.tierChange && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                        <Award size={16} />
                        <span>Tier Change: {transaction.tierChange.from} → {transaction.tierChange.to}</span>
                      </div>
                    </div>
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