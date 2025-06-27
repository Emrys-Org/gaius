import { useState, useEffect } from 'react';
import { useWallet, useNetwork } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { getAlgodClient, getNetworkConfig } from '../utils/algod';
import { getIPFSGatewayURL } from '../utils/pinata';
import { 
  Users, 
  Award, 
  TrendingUp, 
  Activity, 
  CreditCard, 
  RefreshCw,
  Eye,
  Send,
  Calendar,
  Zap,
  BarChart3,
  Globe,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoyaltyProgram {
  id: number;
  name: string;
  description: string;
  company: string;
  imageUrl: string;
  metadata: any;
  createdAt: number;
  totalMembers: number;
  totalTransactions: number;
  lastActivity: number;
  tiers: any[];
  style: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    cardStyle: string;
  };
}

interface Member {
  address: string;
  name?: string;
  joinDate: number;
  totalXP: number;
  tier: string;
  passIds: number[];
  lastActivity: number;
}

interface RealtimeStats {
  totalPrograms: number;
  totalMembers: number;
  totalTransactions: number;
  totalXPAwarded: number;
  activePrograms: number;
  recentActivity: number;
  networkHealth: 'excellent' | 'good' | 'fair' | 'poor';
  avgResponseTime: number;
}

interface Transaction {
  id: string;
  type: 'program_created' | 'pass_issued' | 'xp_awarded' | 'message_sent';
  timestamp: number;
  amount?: number;
  from: string;
  to?: string;
  programId?: number;
  description: string;
}

export function LoyaltyProgramDashboard() {
  const { activeAddress } = useWallet();
  const { activeNetwork } = useNetwork();
  
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyProgram[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [realtimeStats, setRealtimeStats] = useState<RealtimeStats>({
    totalPrograms: 0,
    totalMembers: 0,
    totalTransactions: 0,
    totalXPAwarded: 0,
    activePrograms: 0,
    recentActivity: 0,
    networkHealth: 'good',
    avgResponseTime: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  // Get network info
  const getNetworkInfo = () => {
    const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
    return getNetworkConfig(networkType);
  };

  const EXPLORER_URL = getNetworkInfo().explorerUrl;

  // Fetch all data from blockchain
  const fetchBlockchainData = async () => {
    if (!activeAddress) return;

    const startTime = Date.now();
    
    try {
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      const networkConfig = getNetworkConfig(networkType);

      // Create indexer client for transaction history
      const indexerClient = new algosdk.Indexer(
        networkConfig.algodToken,
        networkConfig.indexerUrl,
        networkConfig.algodPort
      );

      // Fetch account information
      const accountInfo = await algodClient.accountInformation(activeAddress).do();
      const assets = accountInfo.assets || [];
      
      const programs: LoyaltyProgram[] = [];
      const allMembers: Member[] = [];
      const transactions: Transaction[] = [];
      let totalXP = 0;
      let totalTransactionCount = 0;

      // Process each asset to find loyalty programs
      for (const asset of assets) {
        if (typeof asset.amount === 'bigint' ? asset.amount === 0n : asset.amount === 0) continue;
        
        try {
          const assetInfo = await algodClient.getAssetByID(asset.assetId).do();
          const params = assetInfo.params;
          
          const totalSupply = typeof params.total === 'bigint' ? Number(params.total) : Number(params.total);
          const isLoyaltyProgram = totalSupply === 1 && params.decimals === 0 && params.manager === activeAddress;
          
          if (isLoyaltyProgram) {
            let metadata = null;
            let imageUrl = params.url || '';
            
            // Try to fetch metadata
            if (params.url && (params.url.startsWith('ipfs://') || params.url.includes('/ipfs/'))) {
              imageUrl = getIPFSGatewayURL(params.url);
              try {
                const response = await fetch(imageUrl);
                if (response.ok) {
                  metadata = await response.json();
                  if (metadata.image) {
                    imageUrl = getIPFSGatewayURL(metadata.image);
                  }
                }
              } catch (e) {
                console.warn(`Failed to fetch metadata for asset ${asset.assetId}`, e);
              }
            }

            // Fetch program transactions to get member data
            const programTransactions = await indexerClient.searchForTransactions()
              .assetID(Number(asset.assetId))
              .limit(1000)
              .do();

            const programMembers: Member[] = [];
            let programTransactionCount = 0;
            let lastActivity = 0;

            // Process transactions to find members and activity
            for (const txn of programTransactions.transactions) {
              if (txn.roundTime) {
                lastActivity = Math.max(lastActivity, txn.roundTime * 1000);
                programTransactionCount++;
              }

              // Check for XP transactions in notes
              if (txn.note) {
                try {
                  const noteBytes = Buffer.from(txn.note, 'base64');
                  const noteStr = noteBytes.toString('utf8');
                  const noteData = JSON.parse(noteStr);
                  
                  if (noteData.type === 'xp_transaction') {
                    totalXP += Math.abs(noteData.amount || 0);
                    
                    transactions.push({
                      id: txn.id,
                      type: 'xp_awarded',
                      timestamp: (txn.roundTime || 0) * 1000,
                      amount: noteData.amount,
                      from: txn.sender,
                      to: noteData.receiver,
                      programId: Number(asset.assetId),
                      description: `${noteData.amount > 0 ? 'Awarded' : 'Revoked'} ${Math.abs(noteData.amount)} XP: ${noteData.reason || 'No reason'}`
                    });

                    // Add member if not exists
                    const existingMember = programMembers.find(m => m.address === noteData.receiver);
                    if (!existingMember) {
                      programMembers.push({
                        address: noteData.receiver,
                        name: noteData.memberName || `Member ${noteData.receiver.substring(0, 8)}`,
                        joinDate: (txn.roundTime || 0) * 1000,
                        totalXP: noteData.newTotal || 0,
                        tier: noteData.tierChange?.to || 'Bronze',
                        passIds: [],
                        lastActivity: (txn.roundTime || 0) * 1000
                      });
                    } else {
                      existingMember.totalXP = noteData.newTotal || existingMember.totalXP;
                      existingMember.tier = noteData.tierChange?.to || existingMember.tier;
                      existingMember.lastActivity = Math.max(existingMember.lastActivity, (txn.roundTime || 0) * 1000);
                    }
                  } else if (noteData.type === 'loyalty_message') {
                    transactions.push({
                      id: txn.id,
                      type: 'message_sent',
                      timestamp: (txn.roundTime || 0) * 1000,
                      from: txn.sender,
                      to: noteData.receiver,
                      programId: noteData.passId,
                      description: `Message: ${noteData.subject}`
                    });
                  }
                } catch (e) {
                  // Not a JSON note, skip
                }
              }

              // Check for asset transfers (pass issuance)
              if (txn['asset-transfer-transaction'] && txn['asset-transfer-transaction']['asset-id'] === Number(asset.assetId)) {
                const receiver = txn['asset-transfer-transaction'].receiver;
                if (receiver !== activeAddress) {
                  transactions.push({
                    id: txn.id,
                    type: 'pass_issued',
                    timestamp: (txn.roundTime || 0) * 1000,
                    from: txn.sender,
                    to: receiver,
                    programId: Number(asset.assetId),
                    description: `Loyalty pass issued to ${receiver.substring(0, 8)}...`
                  });
                }
              }
            }

            // Add program creation transaction
            transactions.push({
              id: `program-${asset.assetId}`,
              type: 'program_created',
              timestamp: lastActivity || Date.now(),
              from: activeAddress,
              programId: Number(asset.assetId),
              description: `Created loyalty program: ${params.name || 'Unnamed Program'}`
            });

            totalTransactionCount += programTransactionCount;
            allMembers.push(...programMembers);

            programs.push({
              id: Number(asset.assetId),
              name: params.name || 'Unnamed Loyalty Program',
              description: metadata?.desc || metadata?.description || 'No description available',
              company: metadata?.co || metadata?.company || 'Unknown Company',
              imageUrl,
              metadata,
              createdAt: lastActivity || Date.now(),
              totalMembers: programMembers.length,
              totalTransactions: programTransactionCount,
              lastActivity,
              tiers: metadata?.tiers || [],
              style: metadata?.style || {
                primaryColor: '#3B82F6',
                secondaryColor: '#8B5CF6',
                accentColor: '#F59E0B',
                cardStyle: 'modern'
              }
            });
          }
        } catch (error) {
          console.error(`Error processing asset ${asset.assetId}:`, error);
        }
      }

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Determine network health based on response time
      let networkHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
      if (responseTime > 5000) networkHealth = 'poor';
      else if (responseTime > 3000) networkHealth = 'fair';
      else if (responseTime > 1500) networkHealth = 'good';

      // Calculate recent activity (last 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const recentActivity = transactions.filter(t => t.timestamp > oneDayAgo).length;

      // Update state
      setLoyaltyPrograms(programs);
      setMembers(allMembers);
      setRecentTransactions(transactions.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20));
      setRealtimeStats({
        totalPrograms: programs.length,
        totalMembers: allMembers.length,
        totalTransactions: totalTransactionCount,
        totalXPAwarded: totalXP,
        activePrograms: programs.filter(p => p.lastActivity > oneDayAgo).length,
        recentActivity,
        networkHealth,
        avgResponseTime: responseTime
      });
      setLastUpdate(new Date());

    } catch (error) {
      console.error('Error fetching blockchain data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (activeAddress) {
      fetchBlockchainData();
    }
  }, [activeAddress, activeNetwork]);

  useEffect(() => {
    if (!autoRefresh || !activeAddress) return;

    const interval = setInterval(() => {
      fetchBlockchainData();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, activeAddress, activeNetwork]);

  // Manual refresh
  const handleManualRefresh = () => {
    setIsLoading(true);
    fetchBlockchainData();
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  // Get network health color
  const getNetworkHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  // Get transaction icon
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'program_created': return <Award className="h-4 w-4 text-blue-500" />;
      case 'pass_issued': return <CreditCard className="h-4 w-4 text-green-500" />;
      case 'xp_awarded': return <TrendingUp className="h-4 w-4 text-purple-500" />;
      case 'message_sent': return <Send className="h-4 w-4 text-orange-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!activeAddress) {
    return (
      <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
        <Globe className="mx-auto mb-4 text-gray-400" size={48} />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Connect Your Wallet
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Connect your Algorand wallet to view real-time blockchain data and manage your loyalty programs
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Real-time Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Real-time Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Live data from the Algorand blockchain
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Network Health Indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${
              realtimeStats.networkHealth === 'excellent' ? 'bg-green-500' :
              realtimeStats.networkHealth === 'good' ? 'bg-blue-500' :
              realtimeStats.networkHealth === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className={`text-sm font-medium ${getNetworkHealthColor(realtimeStats.networkHealth)}`}>
              {realtimeStats.networkHealth}
            </span>
          </div>

          {/* Auto-refresh Toggle */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              disabled={!autoRefresh}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 disabled:opacity-50"
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>1m</option>
              <option value={300}>5m</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last Update Info */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Clock className="h-4 w-4" />
        <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        <span>•</span>
        <span>Response time: {realtimeStats.avgResponseTime}ms</span>
        <span>•</span>
        <span>Network: {activeNetwork === 'mainnet' ? 'MainNet' : 'TestNet'}</span>
      </div>

      {/* Real-time Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Programs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {realtimeStats.totalPrograms}
              </p>
            </div>
            <Award className="h-8 w-8 text-blue-500" />
          </div>
          <div className="mt-2 text-sm text-green-600 dark:text-green-400">
            {realtimeStats.activePrograms} active
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Members</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {realtimeStats.totalMembers}
              </p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </div>
          <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
            Across all programs
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total XP Awarded</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {realtimeStats.totalXPAwarded.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
          <div className="mt-2 text-sm text-purple-600 dark:text-purple-400">
            Lifetime total
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Recent Activity</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {realtimeStats.recentActivity}
              </p>
            </div>
            <Activity className="h-8 w-8 text-orange-500" />
          </div>
          <div className="mt-2 text-sm text-orange-600 dark:text-orange-400">
            Last 24 hours
          </div>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Loyalty Programs */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Your Loyalty Programs
              </h2>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : loyaltyPrograms.length === 0 ? (
              <div className="text-center py-8">
                <Award className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Loyalty Programs Found
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Create your first loyalty program to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {loyaltyPrograms.map((program, index) => (
                    <motion.div
                      key={program.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {program.imageUrl && (
                          <img
                            src={program.imageUrl}
                            alt={program.name}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {program.name}
                            </h3>
                            <a
                              href={`${EXPLORER_URL}/asset/${program.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {program.company}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {program.totalMembers} members
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="h-4 w-4" />
                              {program.totalTransactions} transactions
                            </span>
                            <span className="text-gray-500">
                              {formatTimeAgo(program.lastActivity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Live Activity
              </h2>
              <Zap className="h-5 w-5 text-yellow-500" />
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  No recent activity
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                <AnimatePresence>
                  {recentTransactions.map((transaction, index) => (
                    <motion.div
                      key={transaction.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white font-medium">
                          {transaction.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(transaction.timestamp)}
                          </span>
                          {transaction.amount && (
                            <span className={`text-xs font-medium ${
                              transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.amount > 0 ? '+' : ''}{transaction.amount} XP
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Members Overview */}
      {members.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Recent Members
            </h2>
            <Users className="h-5 w-5 text-gray-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.slice(0, 6).map((member, index) => (
              <motion.div
                key={member.address}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {member.name?.charAt(0) || member.address.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {member.name || `${member.address.substring(0, 8)}...`}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {member.totalXP.toLocaleString()} XP
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        member.tier === 'Platinum' ? 'bg-purple-100 text-purple-800' :
                        member.tier === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                        member.tier === 'Silver' ? 'bg-gray-100 text-gray-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {member.tier}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}