import { useState, useEffect, useMemo } from 'react';
import { useWallet, useNetwork } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { getAlgodClient, getNetworkConfig } from '../utils/algod';
import { getIPFSGatewayURL } from '../utils/pinata';
import { MessageCenter } from './MessageCenter';
import { LoyaltyProgramMinter } from './LoyaltyProgramMinter';
import { LoyaltyPassSender } from './LoyaltyPassSender';
import { LoyaltyPassTransfer } from './LoyaltyPassTransfer';
import { XPManager } from './XPManager';
import { UserSettings } from './UserSettings';
import { fetchMemberXPTransactions, XPTransaction } from '../utils/xp';
import { supabase } from '../utils/supabase';
import { 
  BarChart3, Award, Users, Trophy, TrendingUp, Send, 
  Plus, X, ChevronLeft, Video, Music, FileText, Box,
  Image, File, ExternalLink, QrCode, CreditCard,
  Download, ArrowRight, MessageSquare, Eye, Calendar, MapPin, 
  Palette, Wallet, Star, Settings, User, Building2, LogOut,
  AlertTriangle, AlertCircle
} from 'lucide-react';
import * as QRCode from 'qrcode';
import { MemberCard } from './MemberCard';
import { hasReachedMemberLimit, hasReachedProgramLimit, SUBSCRIPTION_PLANS } from '../utils/subscription';

interface LoyaltyProgramInfo {
  id: number;
  name: string;
  unitName: string;
  url: string;
  total: number;
  decimals: number;
  imageUrl: string;
  mediaType?: 'image' | 'video' | 'audio' | 'model' | 'document' | 'other';
  metadata?: any;
  qrCodeUrl?: string;
}

interface Member {
  id: string;
  address: string; // Algorand wallet address
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

interface LeaderboardEntry {
  rank: number;
  member: Member;
  points: number;
  badge?: string;
}

interface TierChange {
  from: string;
  to: string;
  timestamp: number;
}

interface LoyaltyProgramDashboardProps {
  subscriptionPlan?: string | null;
  onNavigateToPricing?: () => void;
}

// Helper to determine media type from metadata or URL
const getMediaType = (program: LoyaltyProgramInfo): 'image' | 'video' | 'audio' | 'model' | 'document' | 'other' => {
  // First check if we have mediaType in the metadata
  if (program.metadata?.mediaType) {
    return program.metadata.mediaType;
  }
  
  // If not, try to determine from properties
  if (program.metadata?.properties?.mimeType) {
    const mimeType = program.metadata.properties.mimeType;
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('model/')) return 'model';
    if (mimeType === 'application/pdf') return 'document';
  }
  
  // If still not determined, try from URL extension
  const url = program.url.toLowerCase();
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

// Helper to determine tier based on points
const determineTier = (points: number, tiers: any[]): string => {
  if (!tiers || tiers.length === 0) {
    // Default tiers if none provided
    const defaultTiers = [
      { name: 'Bronze', pointsRequired: 0 },
      { name: 'Silver', pointsRequired: 500 },
      { name: 'Gold', pointsRequired: 1000 },
      { name: 'Platinum', pointsRequired: 2500 }
    ];
    tiers = defaultTiers;
  }

  // Sort tiers by points required (ascending)
  const sortedTiers = [...tiers].sort((a, b) => a.pointsRequired - b.pointsRequired);
  
  // Find the highest tier the member qualifies for (starting from highest tier)
  for (let i = sortedTiers.length - 1; i >= 0; i--) {
    if (points >= sortedTiers[i].pointsRequired) {
      return sortedTiers[i].name;
    }
  }
  
  // Default to the lowest tier if no match
  return sortedTiers[0]?.name || 'Bronze';
};

export function LoyaltyProgramDashboard({ 
  subscriptionPlan = null,
  onNavigateToPricing
}: LoyaltyProgramDashboardProps) {
  const { activeAddress, signTransactions } = useWallet();
  const { activeNetwork } = useNetwork();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLoyaltyPrograms, setUserLoyaltyPrograms] = useState<LoyaltyProgramInfo[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'programs' | 'members' | 'leaderboard' | 'xp-manager' | 'create' | 'transfer' | 'settings'>('overview');
  const [showProgramDetails, setShowProgramDetails] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<LoyaltyProgramInfo | null>(null);
  const [showLoyaltyPassModal, setShowLoyaltyPassModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [issuingLoyaltyPass, setIssuingLoyaltyPass] = useState(false);
  const [isTransferringPass, setIsTransferringPass] = useState(false);
  const [nftPassResult, setNftPassResult] = useState<{ success: boolean; message: string; assetId?: number } | null>(null);
  const [pendingTransferAssetId, setPendingTransferAssetId] = useState<number | null>(null);
  const [showMessageCenter, setShowMessageCenter] = useState(false);
  const [recentActivities, setRecentActivities] = useState<Array<{id: string; type: string; message: string; timestamp: string; color: string}>>([]);
  const [selectedMemberForMessage, setSelectedMemberForMessage] = useState<Member | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState(0);
  const [adminInfo, setAdminInfo] = useState<{name: string; email: string} | null>(null);
  
  // Search state variables
  const [programSearchQuery, setProgramSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Fetch admin info when component mounts
  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (!activeAddress) return;
      
      try {
        const { data, error } = await supabase
          .from('organization_admins')
          .select('full_name, email')
          .eq('wallet_address', activeAddress)
          .single();
        
        if (error) {
          console.error('Error fetching admin info:', error);
          return;
        }
        
        if (data) {
          setAdminInfo({
            name: data.full_name,
            email: data.email
          });
        }
      } catch (error) {
        console.error('Error fetching admin info:', error);
      }
    };
    
    fetchAdminInfo();
  }, [activeAddress]);

  // Filtered programs and members based on search queries
  const filteredPrograms = useMemo(() => {
    if (!programSearchQuery.trim()) return userLoyaltyPrograms;
    
    const query = programSearchQuery.toLowerCase();
    return userLoyaltyPrograms.filter(program => 
      program.name.toLowerCase().includes(query) || 
      program.id.toString().includes(query) ||
      program.unitName?.toLowerCase().includes(query) ||
      program.metadata?.desc?.toLowerCase().includes(query) ||
      program.metadata?.description?.toLowerCase().includes(query)
    );
  }, [userLoyaltyPrograms, programSearchQuery]);

  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) return members;
    
    const query = memberSearchQuery.toLowerCase();
    return members.filter(member => 
      member.address.toLowerCase().includes(query) || 
      member.id.toLowerCase().includes(query) ||
      member.currentTier.toLowerCase().includes(query) ||
      member.assetIds.some(id => id.toString().includes(query))
    );
  }, [members, memberSearchQuery]);

  // Leaderboard based on filtered members
  const leaderboard = useMemo(() => {
    return filteredMembers
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((member, index) => ({
        rank: index + 1,
        member,
        points: member.totalPoints,
        badge: index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : undefined
      }));
  }, [filteredMembers]);

  // Get network-specific configuration
  const getNetworkInfo = () => {
    const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
    return getNetworkConfig(networkType);
  };
  
  const EXPLORER_URL = getNetworkInfo().explorerUrl;

  // Generate QR code for a loyalty program
  const generateProgramQRCode = async (program: LoyaltyProgramInfo): Promise<string> => {
    try {
      const qrData = {
        type: 'loyalty-program',
        assetId: program.id,
        programName: program.name,
        company: program.metadata?.co || program.metadata?.company || 'Unknown Company',
        wallet: activeAddress,
        explorerUrl: `${EXPLORER_URL}/asset/${program.id}`,
        timestamp: new Date().toISOString(),
      };

      const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 200,
        margin: 2,
        color: {
          dark: program.metadata?.style?.p || program.metadata?.appearance?.primaryColor || '#3B82F6',
          light: '#FFFFFF'
        }
      });

      return qrCodeUrl;
    } catch (error) {
      console.error('Error generating QR code for program:', error);
      return '';
    }
  };

  // Fetch user loyalty programs when component loads
  useEffect(() => {
    if (activeAddress) {
      fetchUserLoyaltyPrograms();
    }
  }, [activeAddress, activeNetwork]); // Always fetch when address or network changes
  
  // Fetch members when tab changes to 'members'
  useEffect(() => {
    if (activeAddress && activeTab === 'members') {
      fetchLoyaltyProgramMembers();
    }
  }, [activeAddress, activeTab, activeNetwork]);

  // Clear programs and refetch when network changes
  useEffect(() => {
    if (activeAddress) {
      setUserLoyaltyPrograms([]); // Clear existing programs
      setMembers([]); // Clear existing members
      fetchUserLoyaltyPrograms(); // Refetch for new network
    }
  }, [activeNetwork]); // Only trigger on network change

  // Auto-refresh programs when on overview tab
  useEffect(() => {
    if (activeAddress && activeTab === 'overview') {
      const interval = setInterval(() => {
        fetchUserLoyaltyPrograms();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [activeAddress, activeTab]);

  // Fetch members when on members tab or when programs change
  useEffect(() => {
    if (activeAddress && (activeTab === 'members' || activeTab === 'leaderboard')) {
      fetchLoyaltyProgramMembers();
    }
  }, [activeAddress, activeTab, userLoyaltyPrograms]);

  const fetchUserLoyaltyPrograms = async () => {
    if (!activeAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get network-specific algod client
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      
      // Get account information including assets
      const accountInfo = await algodClient.accountInformation(activeAddress).do();
      
      // Filter for assets (loyalty programs) owned by the user
      const assets = accountInfo.assets || [];
      
      // Create an array to store loyalty program information
      const programsInfo: LoyaltyProgramInfo[] = [];
      
      // Process each asset
      for (const asset of assets) {
        // Skip assets with amount 0 (not owned)
        if (typeof asset.amount === 'bigint' ? asset.amount === 0n : asset.amount === 0) continue;
        
        try {
          // Get detailed asset information
          const assetInfo = await algodClient.getAssetByID(asset.assetId).do();
          
          // Check if it's a loyalty program (total supply of 1 and decimals of 0)
          const params = assetInfo.params;
          
          // Handle bigint total supply
          const totalSupply = typeof params.total === 'bigint' ? Number(params.total) : Number(params.total);
          const decimals = typeof params.decimals === 'bigint' ? Number(params.decimals) : Number(params.decimals);
          
          const isLoyaltyProgram = totalSupply === 1 && decimals === 0;
          
          if (isLoyaltyProgram) {
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
            
            const programInfo: LoyaltyProgramInfo = {
              id: typeof asset.assetId === 'bigint' ? Number(asset.assetId) : asset.assetId,
              name: params.name || 'Unnamed Loyalty Program',
              unitName: params.unitName || '',
              url: url,
              total: totalSupply,
              decimals: params.decimals,
              imageUrl,
              metadata
            };
            
            // Determine media type
            programInfo.mediaType = getMediaType(programInfo);
            
            // Generate QR code for this program
            programInfo.qrCodeUrl = await generateProgramQRCode(programInfo);
            
            programsInfo.push(programInfo);
          }
        } catch (error) {
          console.error(`Error fetching asset ${asset.assetId} info:`, error);
        }
      }
      
      // Check for new programs and add to recent activities
      const previousProgramIds = userLoyaltyPrograms.map(p => p.id);
      const newPrograms = programsInfo.filter(p => !previousProgramIds.includes(p.id));
      
      if (newPrograms.length > 0) {
        const newActivities = newPrograms.map(program => ({
          id: `program-${program.id}`,
          type: 'program_created',
          message: `New loyalty program "${program.name}" was created`,
          timestamp: new Date().toISOString(),
          color: 'orange'
        }));
        
        setRecentActivities(prev => [...newActivities, ...prev].slice(0, 5)); // Keep only last 5 activities
      }

      setUserLoyaltyPrograms(programsInfo);
    } catch (error: any) {
      console.error('Error fetching loyalty programs:', error);
      setError(`Error fetching loyalty programs: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch members who have received loyalty passes
  const fetchLoyaltyProgramMembers = async () => {
    if (!activeAddress || userLoyaltyPrograms.length === 0) return;
    
    setIsMembersLoading(true);
    setMembersError(null);
    
    try {
      // Get network-specific algod client and indexer
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const networkConfig = getNetworkConfig(networkType);
      
      // Create an indexer client to search for assets
      const indexerClient = new algosdk.Indexer(
        networkConfig.algodToken,
        networkConfig.indexerUrl,
        networkConfig.algodPort
      );
      
      const membersMap = new Map<string, Member>();
      
      // For each loyalty program, find all loyalty passes created from it
      for (const program of userLoyaltyPrograms) {
        try {
          // Search for assets created by the organization
          const searchResults = await indexerClient.searchForAssets()
            .creator(activeAddress)
            .do();
            
          const assets = searchResults.assets || [];
          
          // Filter assets that are likely loyalty passes (total supply of 1, decimals 0)
          // and have the program name in their name
          for (const asset of assets) {
            // Skip the program asset itself
            const assetIndex = typeof asset.index === 'bigint' ? Number(asset.index) : Number(asset.index);
            const programId = typeof program.id === 'bigint' ? Number(program.id) : Number(program.id);
            if (assetIndex === programId) continue;
            
            // Check if it's a loyalty pass (total supply of 1 and decimals of 0)
            const params = asset.params;
            const totalSupply = typeof params.total === 'bigint' ? Number(params.total) : Number(params.total);
            const decimals = typeof params.decimals === 'bigint' ? Number(params.decimals) : Number(params.decimals);
            const isLoyaltyPass = totalSupply === 1 && decimals === 0;
            
            // Check if the asset name contains the program name (case insensitive)
            const assetName = params.name || '';
            const isProgramPass = assetName.toLowerCase().includes(program.name.toLowerCase());
            
            if (isLoyaltyPass && isProgramPass) {
              try {
                // Find the current holder of this asset
                const holderInfo = await indexerClient.lookupAssetBalances(asset.index).do();
                const holders = holderInfo.balances || [];
                
                // Find holder with non-zero balance
                const currentHolder = holders.find(h => {
                  const amount = typeof h.amount === 'bigint' ? Number(h.amount) : h.amount;
                  return amount > 0 && h.address !== activeAddress; // Skip if the organization still holds it
                });
                
                if (currentHolder) {
                  const holderAddress = currentHolder.address;
                  let memberInfo: Member;
                  
                  // Check if we already have this member in our map
                  if (membersMap.has(holderAddress)) {
                    memberInfo = membersMap.get(holderAddress)!;
                    // Add this asset to their list
                    memberInfo.assetIds.push(typeof asset.index === 'bigint' ? Number(asset.index) : asset.index);
                  } else {
                    // Try to fetch metadata from the asset to get member details
                    let memberName = holderAddress;
                    let memberEmail = "";
                    let joinDate = new Date().toISOString();
                    
                    // Try to get metadata from the asset URL
                    if (params.url) {
                      try {
                        const url = getIPFSGatewayURL(params.url);
                        const response = await fetch(url);
                        
                        if (response.ok) {
                          const metadata = await response.json();
                          
                          // Extract member information from metadata
                          if (metadata.member) {
                            memberEmail = metadata.member.email || memberEmail;
                            joinDate = metadata.member.joinDate || metadata.issuedAt || joinDate;
                          }
                        }
                      } catch (e) {
                        console.warn(`Failed to fetch metadata for asset ${asset.index}`, e);
                      }
                    }
                    
                    // Create new member entry (without XP data for now)
                    memberInfo = {
                      id: holderAddress.substring(0, 8),
                      address: holderAddress,
                      name: `${holderAddress.substring(0, 6)}...${holderAddress.substring(holderAddress.length - 4)}`,
                      email: memberEmail,
                      joinDate: joinDate,
                      totalPoints: 0, // Will be updated with blockchain data
                      currentTier: 'Bronze', // Will be updated with blockchain data
                      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(holderAddress.substring(0, 4))}&background=random`,
                      assetIds: [typeof asset.index === 'bigint' ? Number(asset.index) : asset.index]
                    };
                    
                    membersMap.set(holderAddress, memberInfo);
                  }
                }
              } catch (e) {
                console.warn(`Error fetching holder for asset ${asset.index}:`, e);
              }
            }
          }
        } catch (e) {
          console.warn(`Error searching for assets related to program ${program.id}:`, e);
        }
      }
      
      // Convert map to array
      const membersArray = Array.from(membersMap.values());
      
      // Update XP data for each member from blockchain
      const updatedMembersArray = await Promise.all(
        membersArray.map(member => updateMemberXPData(member))
      );
      
      // Update members state
      setMembers(updatedMembersArray);
      
      // Add activity for new members
      if (updatedMembersArray.length > 0) {
        const newActivity = {
          id: `members-${Date.now()}`,
          type: 'members_fetched',
          message: `Found ${updatedMembersArray.length} members with loyalty passes`,
          timestamp: new Date().toISOString(),
          color: 'green'
        };
        
        setRecentActivities(prev => {
          // Check if we already have a similar activity
          const hasSimilar = prev.some(a => a.type === 'members_fetched');
          if (!hasSimilar) {
            return [newActivity, ...prev].slice(0, 5);
          }
          return prev;
        });
      }
    } catch (error: any) {
      console.error('Error fetching loyalty program members:', error);
      setMembersError(`Error fetching members: ${error.message || 'Unknown error'}`);
      
      // If we failed to fetch real members, use empty array
      setMembers([]);
    } finally {
      setIsMembersLoading(false);
    }
  };

  const handleLoyaltyProgramMinted = () => {
    // Refresh the loyalty program list immediately to update overview
    fetchUserLoyaltyPrograms();
    // Switch to programs tab to show the new program
    setActiveTab('programs');
  };

  const handleProgramClick = (program: LoyaltyProgramInfo) => {
    setSelectedProgram(program);
    setShowProgramDetails(true);
  };

  const closeProgramDetails = () => {
    setShowProgramDetails(false);
    setSelectedProgram(null);
  };

  const handleIssueLoyaltyPass = (member: Member) => {
    setSelectedMember(member);
    setSelectedProgramId(userLoyaltyPrograms[0]?.id || 0);
    setShowLoyaltyPassModal(true);
    setNftPassResult(null);
  };

  const closeLoyaltyPassModal = () => {
    setShowLoyaltyPassModal(false);
    setSelectedMember(null);
    setNftPassResult(null);
    setRecipientAddress('');
    setSelectedProgramId(0);
    setPendingTransferAssetId(null);
  };

  const issueLoyaltyPass = async (recipientAddress: string) => {
    if (!activeAddress || !selectedMember || userLoyaltyPrograms.length === 0) {
      setNftPassResult({ success: false, message: 'Missing required information' });
      return;
    }

    setIssuingLoyaltyPass(true);
    setNftPassResult(null);

    try {
      // Get network-specific algod client
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      
      // Get suggested parameters
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Select the chosen loyalty program for the pass
      const loyaltyProgram = userLoyaltyPrograms.find(p => p.id === selectedProgramId) || userLoyaltyPrograms[0];
      
      // Get program tiers from metadata
      const programTiers = loyaltyProgram.metadata?.tiers || [];
      
      // Default tiers if none in metadata
      const defaultTiers = [
        { id: '1', name: 'Bronze', pointsRequired: 0, description: 'Basic rewards' },
        { id: '2', name: 'Silver', pointsRequired: 500, description: 'Enhanced rewards' },
        { id: '3', name: 'Gold', pointsRequired: 1000, description: 'Premium rewards' },
        { id: '4', name: 'Platinum', pointsRequired: 2500, description: 'Elite rewards' }
      ];
      
      const tiers = programTiers.length > 0 ? 
        programTiers.map((t: any) => ({
          id: t.id,
          name: t.n || t.name,
          pointsRequired: t.p || t.pointsRequired,
          description: t.d || t.description
        })) : 
        defaultTiers;
      
      // Award initial XP for joining the program (if this is their first pass)
      const initialXP = selectedMember.assetIds.length === 0 ? 50 : 0;
      const newTotalPoints = selectedMember.totalPoints + initialXP;
      
      // Determine tier based on points (using the global determineTier function)
      // Get the updated tier based on new points total
      const updatedTier = determineTier(newTotalPoints, tiers);
      
      // Create Loyalty Program Pass metadata
      const passMetadata = {
        name: `${loyaltyProgram.name} - ${updatedTier} Pass`,
        description: `Loyalty pass for ${selectedMember.address.substring(0, 6)}...${selectedMember.address.substring(selectedMember.address.length - 4)} in ${loyaltyProgram.name} program`,
        image: loyaltyProgram.imageUrl,
        type: 'loyalty-pass',
        member: {
          id: selectedMember.id,
          name: `${selectedMember.address.substring(0, 6)}...${selectedMember.address.substring(selectedMember.address.length - 4)}`,
          email: selectedMember.email,
          tier: updatedTier, // Use the updated tier
          points: newTotalPoints, // Use the new points total
          joinDate: selectedMember.joinDate
        },
        program: {
          id: loyaltyProgram.id,
          name: loyaltyProgram.name,
          company: loyaltyProgram.metadata?.co || loyaltyProgram.metadata?.company
        },
        xp: {
          initial: initialXP,
          total: newTotalPoints,
          lastUpdated: new Date().toISOString()
        },
        issuedBy: activeAddress,
        issuedAt: new Date().toISOString(),
        network: activeNetwork,
        version: '1.0'
      };
      
      // Convert metadata to Uint8Array for note field
      const metadataStr = JSON.stringify(passMetadata);
      const metadataBytes = new Uint8Array(Buffer.from(metadataStr));
      
      // Check if metadata is within Algorand's 1024 byte limit
      if (metadataBytes.length > 1024) {
        throw new Error(`Metadata too large: ${metadataBytes.length} bytes (max: 1024 bytes). Please reduce member information.`);
      }

      // Create asset creation transaction for the Loyalty Program Pass
      const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        total: 1,
        decimals: 0,
        assetName: `${loyaltyProgram.name} Pass`,
        unitName: 'PASS',
        assetURL: loyaltyProgram.imageUrl,
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
        
        // Update the member with new XP and tier
        const updatedMember: Member = {
          ...selectedMember,
          totalPoints: newTotalPoints,
          currentTier: updatedTier,
          assetIds: [...selectedMember.assetIds, assetId]
        };
        
        // Update the members list
        setMembers(prevMembers => 
          prevMembers.map(member => 
            member.id === updatedMember.id ? updatedMember : member
          )
        );
        
        // Add activity for XP update if initial XP was awarded
        if (initialXP > 0) {
          const xpActivity = {
            id: `xp-initial-${Date.now()}`,
            type: 'xp_awarded',
            message: `${updatedMember.address.substring(0, 6)}...${updatedMember.address.substring(updatedMember.address.length - 4)} received ${initialXP} initial XP`,
            timestamp: new Date().toISOString(),
            color: 'green'
          };
          
          setRecentActivities(prev => [xpActivity, ...prev].slice(0, 5));
        }
        
        // If recipient address is provided and different from sender, transfer the Loyalty Program Pass
        if (recipientAddress && recipientAddress !== activeAddress) {
          try {
            // Create transfer transaction
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
              
              let successMessage = `Loyalty Program Pass (Asset ID: ${assetId}) successfully transferred to ${recipientAddress}!`;
              if (initialXP > 0) {
                successMessage += ` Member awarded ${initialXP} initial XP.`;
              }
              
              setNftPassResult({ 
                success: true, 
                message: successMessage, 
                assetId 
              });
            }
          } catch (transferError) {
            setNftPassResult({ 
              success: true, 
              message: `Loyalty Program Pass created (Asset ID: ${assetId}) but transfer failed. You can manually transfer it using the button below.`, 
              assetId 
            });
            // Set the pending transfer asset ID so we can show the transfer button
            setPendingTransferAssetId(assetId);
          }
        } else {
          let successMessage = `Loyalty Program Pass created successfully! Asset ID: ${assetId}`;
          if (initialXP > 0) {
            successMessage += ` Member awarded ${initialXP} initial XP.`;
          }
          
          setNftPassResult({ 
            success: true, 
            message: successMessage, 
            assetId 
          });
        }
      } else {
        throw new Error('Failed to sign transaction');
      }
    } catch (error: any) {
      console.error('Error issuing Loyalty Pass:', error);
      setNftPassResult({ 
        success: false, 
        message: `Error issuing Loyalty Pass: ${error.message || 'Unknown error'}`
      });
    } finally {
      setIssuingLoyaltyPass(false);
    }
  };

  // Function to transfer a loyalty pass to a recipient
  const transferLoyaltyPass = async (assetId: number, recipientAddress: string) => {
    if (!activeAddress || !signTransactions || !assetId || !recipientAddress) {
      setNftPassResult({ 
        success: false, 
        message: 'Missing required information for transfer' 
      });
      return;
    }

    setIsTransferringPass(true);
    
    try {
      // Get network-specific algod client
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      
      // Get suggested parameters
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Create transfer transaction
      const transferTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        receiver: recipientAddress,
        amount: 1,
        assetIndex: assetId,
        suggestedParams,
      });

      const encodedTransferTxn = algosdk.encodeUnsignedTransaction(transferTxn);
      const signedTransferTxns = await signTransactions([encodedTransferTxn]);
      
      if (signedTransferTxns && signedTransferTxns[0]) {
        const signedTransferTxnBytes = signedTransferTxns.map(txn => txn ? new Uint8Array(txn) : null).filter(Boolean) as Uint8Array[];
        await algodClient.sendRawTransaction(signedTransferTxnBytes).do();
        
        // Wait for confirmation
        await algosdk.waitForConfirmation(
          algodClient,
          algosdk.decodeSignedTransaction(signedTransferTxnBytes[0]).txn.txID(),
          4
        );
        
        setNftPassResult({ 
          success: true, 
          message: `Loyalty Program Pass (Asset ID: ${assetId}) successfully transferred to ${recipientAddress}!`, 
          assetId 
        });
        
        // Clear the pending transfer
        setPendingTransferAssetId(null);
        
        // Refresh members list after successful transfer
        fetchLoyaltyProgramMembers();
      } else {
        throw new Error('Failed to sign transaction');
      }
    } catch (error: any) {
      console.error('Error transferring loyalty pass:', error);
      setNftPassResult({ 
        success: false, 
        message: `Error transferring loyalty pass: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setIsTransferringPass(false);
    }
  };

  // Render program details modal
  const renderProgramDetailsModal = () => {
    if (!selectedProgram || !showProgramDetails) return null;

    const metadata = selectedProgram.metadata || {};
    const tiers = metadata.tiers || [];
    const style = metadata.style || {};

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {selectedProgram.name}
            </h2>
            <button
              onClick={closeProgramDetails}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {/* Program Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Program Info */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Award size={20} />
                    Program Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Asset ID:</span>
                      <span className="font-medium">{selectedProgram.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Company:</span>
                      <span className="font-medium">{metadata.co || metadata.company || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Unit Name:</span>
                      <span className="font-medium">{selectedProgram.unitName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Points per Action:</span>
                      <span className="font-medium">{metadata.ppa || metadata.pointsPerAction || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Network:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        activeNetwork === 'mainnet' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                      }`}>
                        {activeNetwork === 'mainnet' ? 'MainNet' : 'TestNet'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {(metadata.desc || metadata.description) && (
                  <div>
                    <h4 className="font-semibold mb-2">Description</h4>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      {metadata.desc || metadata.description}
                    </p>
                  </div>
                )}

                {/* Style Information */}
                {style && Object.keys(style).length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Palette size={16} />
                      Design & Style
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {style.p && (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: style.p }}
                          ></div>
                          <span className="text-sm">Primary</span>
                        </div>
                      )}
                      {style.s && (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: style.s }}
                          ></div>
                          <span className="text-sm">Secondary</span>
                        </div>
                      )}
                      {style.a && (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: style.a }}
                          ></div>
                          <span className="text-sm">Accent</span>
                        </div>
                      )}
                      {style.cs && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Style: {style.cs}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Visual Preview */}
              <div className="space-y-6">
                {/* Program Banner */}
                <div>
                  <h4 className="font-semibold mb-3">Program Banner</h4>
                  <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                    {renderLoyaltyProgramMedia(selectedProgram)}
                  </div>
                </div>

                {/* QR Code */}
                {selectedProgram.qrCodeUrl && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <QrCode size={16} />
                      Program QR Code
                    </h4>
                    <div className="text-center">
                      <div className="bg-white p-4 rounded-lg inline-block shadow-sm">
                        <img 
                          src={selectedProgram.qrCodeUrl} 
                          alt={`QR Code for ${selectedProgram.name}`} 
                          className="w-32 h-32"
                        />
                      </div>
                      <div className="mt-3">
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = selectedProgram.qrCodeUrl!;
                            link.download = `${selectedProgram.name}-qrcode.png`;
                            link.click();
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mx-auto"
                        >
                          <Download size={16} />
                          Download QR Code
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reward Tiers */}
            {tiers && tiers.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Trophy size={20} />
                  Reward Tiers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tiers.map((tier: any, index: number) => (
                    <div 
                      key={tier.id || index} 
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: style.p || '#3B82F6' }}
                        ></div>
                        <h4 className="font-semibold">{tier.n || tier.name || `Tier ${index + 1}`}</h4>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        {tier.d || tier.description || 'No description available'}
                      </p>
                      <div className="text-sm">
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {tier.p || tier.pointsRequired || 0} points required
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <a
                href={`${EXPLORER_URL}/asset/${selectedProgram.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                <Eye size={16} />
                View on Explorer
              </a>
              <a
                href={selectedProgram.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Download size={16} />
                View Media
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedProgram, null, 2));
                  alert('Program data copied to clipboard!');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                📋 Copy Data
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Loyalty Program Pass Issuance Modal
  const renderLoyaltyPassModal = () => {
    if (!selectedMember || !showLoyaltyPassModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative nft-pass-modal">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard size={24} />
              Issue Loyalty Program Pass
            </h2>
            <button
              onClick={closeLoyaltyPassModal}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Member Information */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users size={18} />
                Member Information
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Wallet Address</p>
                    <p className="font-medium text-gray-900 dark:text-white font-mono flex items-center">
                      {selectedMember.address}
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(selectedMember.address);
                          // Show a temporary notification
                          const notification = document.createElement('div');
                          notification.textContent = 'Address copied!';
                          notification.className = 'absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded animate-fade-in-out';
                          document.querySelector('.nft-pass-modal')?.appendChild(notification);
                          setTimeout(() => notification.remove(), 2000);
                        }}
                        className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Copy wallet address"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </p>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loyalty Passes</p>
                    <div className="mt-1">
                      {selectedMember.assetIds.length > 0 ? (
                        selectedMember.assetIds.map((assetId) => (
                          <div key={assetId} className="mb-1 last:mb-0">
                            <a 
                              href={`${EXPLORER_URL}/asset/${assetId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                              Pass #{assetId}
                            </a>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No passes yet</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Date Joined</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(selectedMember.joinDate).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Points</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedMember.totalPoints.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Tier</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedMember.currentTier === 'Platinum' ? 'bg-purple-100 text-purple-800' :
                        selectedMember.currentTier === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                        selectedMember.currentTier === 'Silver' ? 'bg-gray-100 text-gray-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {selectedMember.currentTier}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Program Selection */}
            {userLoyaltyPrograms.length > 1 && (
              <div>
                <label className="block text-sm font-medium mb-2">Select Loyalty Program</label>
                <select
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {userLoyaltyPrograms.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name} (ID: {program.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Recipient Address */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Recipient Wallet Address (Optional)
              </label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Leave empty to mint to your wallet, or enter recipient's Algorand address"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                If left empty, the Loyalty Program Pass will be minted to your wallet. You can transfer it later.
              </p>
            </div>

            {/* Pass Preview */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users size={18} />
                Member Information
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Wallet Address</p>
                    <p className="font-medium text-gray-900 dark:text-white font-mono flex items-center">
                      {selectedMember.address}
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(selectedMember.address);
                          // Show a temporary notification
                          const notification = document.createElement('div');
                          notification.textContent = 'Address copied!';
                          notification.className = 'absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded animate-fade-in-out';
                          document.querySelector('.nft-pass-modal')?.appendChild(notification);
                          setTimeout(() => notification.remove(), 2000);
                        }}
                        className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Copy wallet address"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </p>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loyalty Passes</p>
                    <div className="mt-1">
                      {selectedMember.assetIds.length > 0 ? (
                        selectedMember.assetIds.map((assetId) => (
                          <div key={assetId} className="mb-1 last:mb-0">
                            <a 
                              href={`${EXPLORER_URL}/asset/${assetId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                              Pass #{assetId}
                            </a>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No passes yet</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Date Joined</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(selectedMember.joinDate).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Points</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedMember.totalPoints.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Tier</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedMember.currentTier === 'Platinum' ? 'bg-purple-100 text-purple-800' :
                        selectedMember.currentTier === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                        selectedMember.currentTier === 'Silver' ? 'bg-gray-100 text-gray-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {selectedMember.currentTier}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Result Message */}
            {nftPassResult && (
              <div className={`p-4 rounded-lg ${nftPassResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
                <p>{nftPassResult.message}</p>
                {nftPassResult.assetId && (
                  <div className="mt-2">
                    <a 
                      href={`${EXPLORER_URL}/asset/${nftPassResult.assetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      View Loyalty Program Pass on Explorer
                    </a>
                    
                    {/* Show transfer button if there's a pending transfer asset ID */}
                    {pendingTransferAssetId && recipientAddress && (
                      <div className="mt-4 p-4 border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Transfer Failed</h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                          The Loyalty Program Pass was created successfully but couldn't be transferred automatically. 
                          Click the button below to try transferring it again.
                        </p>
                        <button
                          onClick={() => transferLoyaltyPass(pendingTransferAssetId, recipientAddress)}
                          disabled={isTransferringPass}
                          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isTransferringPass ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              <span>Transferring...</span>
                            </>
                          ) : (
                            <>
                              <Send size={16} />
                              <span>Transfer Loyalty Program Pass to {recipientAddress.substring(0, 8)}...{recipientAddress.substring(recipientAddress.length - 4)}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeLoyaltyPassModal}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => issueLoyaltyPass(recipientAddress)}
                disabled={issuingLoyaltyPass || userLoyaltyPrograms.length === 0}
                className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {issuingLoyaltyPass ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Issuing Pass...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Issue Loyalty Pass
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render media based on type
  const renderLoyaltyProgramMedia = (program: LoyaltyProgramInfo) => {
    const mediaType = program.mediaType || 'image';
    
    switch (mediaType) {
      case 'image':
        return (
          <img
            src={program.imageUrl}
            alt={program.name}
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
            src={program.imageUrl}
            controls
            className="w-full h-full object-cover"
            onError={() => console.error('Video failed to load')}
          />
        );
      case 'audio':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700 p-4">
            <div className="text-center mb-2">
              <p className="text-sm font-medium">Audio Loyalty Program</p>
              <p className="text-xs text-gray-500">{program.name}</p>
            </div>
            <audio
              src={program.imageUrl}
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
              <Box className="mx-auto h-8 w-8 text-blue-500 mb-2" />
              <p className="text-sm font-medium">3D Model</p>
              <p className="text-xs text-gray-500 mt-1">{program.name}</p>
              <a 
                href={program.imageUrl} 
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
              <File className="mx-auto h-8 w-8 text-blue-500 mb-2" />
              <p className="text-sm font-medium">Document</p>
              <p className="text-xs text-gray-500 mt-1">{program.name}</p>
              <a 
                href={program.imageUrl} 
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
              <Award className="mx-auto h-8 w-8 text-blue-500 mb-2" />
              <p className="text-sm font-medium">Loyalty Program</p>
              <p className="text-xs text-gray-500 mt-1">{program.name}</p>
              <a 
                href={program.imageUrl} 
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

  // Render different dashboard sections
  const renderOverview = () => {
    // Calculate statistics
    const totalPrograms = userLoyaltyPrograms.length;
    const totalMembers = members.length;
    const totalPoints = members.reduce((sum, member) => sum + member.totalPoints, 0);
    const averagePoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0;

    // Get subscription limits
    const planDetails = subscriptionPlan ? SUBSCRIPTION_PLANS[subscriptionPlan as keyof typeof SUBSCRIPTION_PLANS] : null;
    const memberLimit = planDetails?.memberLimit || 0;
    const programLimit = planDetails?.programLimit || 0;
    
    // Calculate usage percentages
    const memberUsagePercent = memberLimit ? Math.min(100, Math.round((totalMembers / memberLimit) * 100)) : 100;
    const programUsagePercent = programLimit ? Math.min(100, Math.round((totalPrograms / programLimit) * 100)) : 100;

    return (
      <div className="space-y-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Programs</p>
                <p className="text-3xl font-bold">{userLoyaltyPrograms.length}</p>
              </div>
              <Award className="h-8 w-8 text-blue-200" />
            </div>
            <div className="mt-2">
              {planDetails ? (
                <div className="w-full bg-blue-200/30 h-2 rounded-full mt-2">
                  <div 
                    className="bg-blue-100 h-2 rounded-full" 
                    style={{ width: `${programUsagePercent}%` }}
                  ></div>
                </div>
              ) : (
                <p className="text-blue-100 text-xs">
                  {userLoyaltyPrograms.length > 0 ? '+2 this month' : 'Create your first program'}
                </p>
              )}
              {planDetails && (
                <p className="text-blue-100 text-xs mt-1">
                  {userLoyaltyPrograms.length} of {planDetails.programLimit === Infinity ? 'Unlimited' : planDetails.programLimit} programs
                </p>
              )}
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Total Members</p>
                <p className="text-3xl font-bold">{members.length}</p>
              </div>
              <Users className="h-8 w-8 text-green-200" />
            </div>
            <div className="mt-2">
              {planDetails ? (
                <div className="w-full bg-green-200/30 h-2 rounded-full mt-2">
                  <div 
                    className="bg-green-100 h-2 rounded-full" 
                    style={{ width: `${memberUsagePercent}%` }}
                  ></div>
                </div>
              ) : (
                <p className="text-green-100 text-xs">+{Math.floor(members.length * 0.2)} this week</p>
              )}
              {planDetails && (
                <p className="text-green-100 text-xs mt-1">
                  {members.length} of {planDetails.memberLimit === Infinity ? 'Unlimited' : planDetails.memberLimit} members
                </p>
              )}
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Active Passes</p>
                <p className="text-3xl font-bold">{members.filter(m => m.totalPoints > 0).length}</p>
              </div>
              <Star className="h-8 w-8 text-purple-200" />
            </div>
            <div className="mt-2">
              <p className="text-purple-100 text-xs">{((members.filter(m => m.totalPoints > 0).length / members.length) * 100 || 0).toFixed(0)}% of total members</p>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Total Points</p>
                <p className="text-3xl font-bold">{totalPoints.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-200" />
            </div>
            <div className="mt-2">
              <p className="text-orange-100 text-xs">+{Math.floor(totalPoints * 0.15).toLocaleString()} this month</p>
            </div>
          </div>
        </div>

        {/* Subscription Warning */}
        {!subscriptionPlan && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 text-yellow-800 dark:text-yellow-300">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-800 rounded-full">
                <AlertTriangle size={24} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
                <p className="mb-4">You don't have an active subscription plan. Subscribe to unlock more features and increase your program limits.</p>
                <button
                  onClick={onNavigateToPricing}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  View Pricing Plans
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Program Limit Warning */}
        {subscriptionPlan && planDetails && userLoyaltyPrograms.length >= planDetails.programLimit && planDetails.programLimit !== Infinity && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-800 dark:text-red-300">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full">
                <AlertCircle size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Program Limit Reached</h3>
                <p className="mb-4">You've reached the maximum number of loyalty programs for your current subscription plan.</p>
                <button
                  onClick={onNavigateToPricing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Member Limit Warning */}
        {subscriptionPlan && planDetails && members.length >= planDetails.memberLimit && planDetails.memberLimit !== Infinity && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-800 dark:text-red-300">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 dark:bg-red-800 rounded-full">
                <AlertCircle size={24} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Member Limit Reached</h3>
                <p className="mb-4">You've reached the maximum number of members for your current subscription plan.</p>
                <button
                  onClick={onNavigateToPricing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Programs and Activity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Programs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Recent Programs</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={fetchUserLoyaltyPrograms}
                disabled={isLoading}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium disabled:opacity-50"
                title="Refresh programs"
              >
                {isLoading ? '🔄' : '↻'}
              </button>
              <button 
                onClick={() => setActiveTab('transfer')}
                className="text-green-500 hover:text-green-700 text-sm font-medium"
              >
                Transfer Pass
              </button>
              <button 
                onClick={() => setActiveTab('programs')}
                className="text-blue-500 hover:text-blue-700 text-sm font-medium"
              >
                View All
              </button>
            </div>
          </div>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3"></div>
                <p className="text-gray-500 dark:text-gray-400">Loading programs...</p>
              </div>
            ) : userLoyaltyPrograms.length === 0 ? (
              <div className="text-center py-8">
                <Award className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">No programs created yet</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Create Your First Program
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {userLoyaltyPrograms
                  .sort((a, b) => b.id - a.id) // Sort by ID descending (newest first)
                  .slice(0, 3)
                                    .map((program) => (
                    <div 
                      key={program.id} 
                      onClick={() => handleProgramClick(program)}
                      className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center overflow-hidden">
                      {program.imageUrl ? (
                        <img 
                          src={program.imageUrl} 
                          alt={program.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Award className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{program.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">ID: {program.id}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-green-600">Active</p>
                        {/* Show "New" badge for programs created in the last hour (based on higher asset IDs) */}
                        {userLoyaltyPrograms.length > 0 && program.id === Math.max(...userLoyaltyPrograms.map(p => p.id)) && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">Asset ID: {program.id}</p>
                    </div>
                  </div>
                ))}
                
                {userLoyaltyPrograms.length > 3 && (
                  <div className="text-center pt-2">
                    <button
                      onClick={() => setActiveTab('programs')}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                    >
                      +{userLoyaltyPrograms.length - 3} more programs
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {/* Real activities from program creation */}
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className={`w-2 h-2 bg-${activity.color}-500 rounded-full`}></div>
                  <div className="flex-1">
                    <p className="font-medium">Program created</p>
                    <p className="text-sm text-gray-500">{activity.message}</p>
                  </div>
                  <span className="text-sm text-gray-400">Just now</span>
                </div>
              ))}
              
              {/* Mock activities for demonstration */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium">New member joined</p>
                  <p className="text-sm text-gray-500">
                    {members[0]?.address ? 
                      `${members[0].address.substring(0, 6)}...${members[0].address.substring(members[0].address.length - 4)}` : 
                      'ABCD...XYZ'} joined the Gold tier program
                  </p>
                </div>
                <span className="text-sm text-gray-400">2 hours ago</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium">Points redeemed</p>
                  <p className="text-sm text-gray-500">
                    {members[1]?.address ? 
                      `${members[1].address.substring(0, 6)}...${members[1].address.substring(members[1].address.length - 4)}` : 
                      'EFGH...UVW'} redeemed 500 points
                  </p>
                </div>
                <span className="text-sm text-gray-400">5 hours ago</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium">Tier upgrade</p>
                  <p className="text-sm text-gray-500">Member {members[2]?.name || 'IJKL...QRS'} upgraded to Silver tier</p>
                </div>
                <span className="text-sm text-gray-400">1 day ago</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium">Points earned</p>
                  <p className="text-sm text-gray-500">Member {members[3]?.name || 'MNOP...MNO'} earned 250 points from purchase</p>
                </div>
                <span className="text-sm text-gray-400">3 days ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPrograms = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">My Loyalty Programs</h3>
        <button
          onClick={() => setActiveTab('create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} />
          Create Program
        </button>
      </div>
      
      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search programs by name, ID, or description..."
          value={programSearchQuery}
          onChange={(e) => setProgramSearchQuery(e.target.value)}
          className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {programSearchQuery && (
          <button
            onClick={() => setProgramSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>
      
      {isLoading ? (
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading your loyalty programs...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 rounded-lg">
          {error}
        </div>
      ) : userLoyaltyPrograms.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300">
            You don't have any loyalty programs yet. Create one to get started!
          </p>
          <button
            onClick={() => setActiveTab('create')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Create a Loyalty Program
          </button>
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300">
            No programs match your search. Try different keywords or clear the search.
          </p>
          <button
            onClick={() => setProgramSearchQuery('')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrograms.map((program) => (
            <div
              key={program.id}
              onClick={() => handleProgramClick(program)}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all"
            >
              <div className="h-48 bg-gray-200 dark:bg-gray-700 relative flex items-center justify-center overflow-hidden">
                {renderLoyaltyProgramMedia(program)}
                
                {/* Media type badge */}
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                  {program.mediaType || 'image'}
                </div>
              </div>
              
              <div className="p-4 flex-grow">
                <h4 className="text-lg font-semibold mb-1 truncate">{program.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {program.unitName ? `${program.unitName} • ` : ''}ID: {program.id}
                </p>
                
                {program.metadata && (program.metadata.desc || program.metadata.description) && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                    {program.metadata.desc || program.metadata.description}
                  </p>
                )}
              </div>
              
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                {/* QR Code Section */}
                {program.qrCodeUrl && (
                  <div className="mb-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <QrCode size={16} />
                      <span className="text-sm font-medium">Program QR Code</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg inline-block shadow-sm">
                      <img 
                        src={program.qrCodeUrl} 
                        alt={`QR Code for ${program.name}`} 
                        className="w-24 h-24"
                      />
                    </div>
                    <div className="mt-2 flex justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const link = document.createElement('a');
                          link.href = program.qrCodeUrl!;
                          link.download = `${program.name}-qrcode.png`;
                          link.click();
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        <Download size={12} />
                        Download QR
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <a
                    href={`${EXPLORER_URL}/asset/${program.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-500 hover:underline text-sm"
                  >
                    View on Lora Explorer
                  </a>
                  
                  <a
                    href={program.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-500 hover:underline text-sm"
                  >
                    View Media
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-6 text-center">
        <button
          onClick={fetchUserLoyaltyPrograms}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Refresh Programs
        </button>
      </div>
    </div>
  );

  const renderMemberXPHistory = (member: Member) => {
    if (!member.xpHistory || member.xpHistory.length === 0) {
      return (
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400">No XP history found</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {member.xpHistory.map((transaction) => (
          <div 
            key={transaction.txId}
            className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {transaction.amount > 0 ? '+' : ''}{transaction.amount} XP
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {transaction.reason}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(transaction.timestamp * 1000).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Total: {transaction.newTotal} XP
                </p>
              </div>
            </div>
            {transaction.tierChange && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <TrendingUp size={14} />
                  Tier Upgrade: {transaction.tierChange.from} → {transaction.tierChange.to}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderMembers = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <Users size={24} className="text-blue-500" />
          Members
        </h3>
      </div>

      {/* Search bar */}
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Search members by address, tier, or pass ID..."
          value={memberSearchQuery}
          onChange={(e) => setMemberSearchQuery(e.target.value)}
          className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {memberSearchQuery && (
          <button
            onClick={() => setMemberSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isMembersLoading ? (
        <div className="text-center p-8">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading members...</p>
        </div>
      ) : membersError ? (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 rounded-lg">
          {membersError}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300">
            No members found. Issue loyalty passes to add members.
          </p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300">
            No members match your search. Try different keywords or clear the search.
          </p>
          <button
            onClick={() => setMemberSearchQuery('')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredMembers.map((member) => (
            <MemberCard 
              key={member.id}
              member={member}
              tiers={extractProgramTiers()}
              onSendMessage={handleSendMessage}
              onIssueLoyaltyPass={handleIssueLoyaltyPass}
              onUpdateXP={() => setActiveTab('xp-manager')}
              showActions={true}
              showTierProgress={true}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderLeaderboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Leaderboard</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('members')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            disabled={isMembersLoading}
          >
            {isMembersLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                <span>Loading...</span>
              </>
            ) : (
              <>
                <Users size={16} />
                <span>Refresh Leaderboard</span>
              </>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Create New Program
          </button>
        </div>
      </div>
      
      {isMembersLoading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600 mr-2"></div>
          <p className="text-blue-700 dark:text-blue-300">Fetching members from the Algorand blockchain...</p>
        </div>
      )}
      
      {membersError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300 font-medium">Error loading members: {membersError}</p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">Please try again or check your network connection.</p>
        </div>
      )}
      
      {!isMembersLoading && !membersError && members.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <Users className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-yellow-700 dark:text-yellow-300 font-medium">No members found</p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
            No wallet addresses have received loyalty passes from your programs yet.
          </p>
        </div>
      )}
      
      {!isMembersLoading && !membersError && members.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Wallet Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Loyalty Passes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {leaderboard.map((entry) => (
                  <tr key={entry.member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg font-bold mr-2">#{entry.rank}</span>
                        {entry.badge && <span className="text-xl">{entry.badge}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                          {entry.member.address.substring(0, 8)}...{entry.member.address.substring(entry.member.address.length - 8)}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(entry.member.address);
                              // Show a temporary tooltip or notification
                              const target = e.currentTarget;
                              target.classList.add('text-green-500');
                              setTimeout(() => {
                                target.classList.remove('text-green-500');
                              }, 1000);
                            }}
                            className="ml-2 inline-flex items-center hover:text-blue-500 transition-colors"
                            title="Copy wallet address"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        {entry.member.assetIds.map((assetId, index) => (
                          <div key={assetId} className="mb-1 last:mb-0">
                            <a 
                              href={`${EXPLORER_URL}/asset/${assetId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Pass #{assetId}
                            </a>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-blue-600">
                        {entry.points.toLocaleString()}
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        entry.member.currentTier === 'Platinum' ? 'bg-purple-100 text-purple-800' :
                        entry.member.currentTier === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                        entry.member.currentTier === 'Silver' ? 'bg-gray-100 text-gray-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {entry.member.currentTier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // Handle XP update for a member
  const handleXPUpdated = (updatedMember: Member) => {
    // Update the member in the members list
    setMembers(prevMembers => 
      prevMembers.map(member => 
        member.id === updatedMember.id ? updatedMember : member
      )
    );
    
    // Add activity for XP update
    const newActivity = {
      id: `xp-update-${Date.now()}`,
      type: 'xp_updated',
      message: `${updatedMember.address.substring(0, 6)}...${updatedMember.address.substring(updatedMember.address.length - 4)} received XP update`,
      timestamp: new Date().toISOString(),
      color: 'green'
    };
    
    setRecentActivities(prev => [newActivity, ...prev].slice(0, 5));
  };

  // Extract tiers from all programs
  const extractProgramTiers = () => {
    const allTiers: Array<{
      id: string;
      name: string;
      pointsRequired: number;
      description: string;
    }> = [];
    
    userLoyaltyPrograms.forEach(program => {
      if (program.metadata?.tiers) {
        const programTiers = program.metadata.tiers.map((tier: any) => ({
          id: tier.id || String(Math.random()),
          name: tier.n || tier.name || 'Unnamed Tier',
          pointsRequired: tier.p || tier.pointsRequired || 0,
          description: tier.d || tier.description || ''
        }));
        allTiers.push(...programTiers);
      }
    });
    
    // Add default tiers if none were found in programs
    if (allTiers.length === 0) {
      allTiers.push(
        { id: '1', name: 'Bronze', pointsRequired: 0, description: 'Basic rewards' },
        { id: '2', name: 'Silver', pointsRequired: 500, description: 'Enhanced rewards' },
        { id: '3', name: 'Gold', pointsRequired: 1000, description: 'Premium rewards' },
        { id: '4', name: 'Platinum', pointsRequired: 2500, description: 'Elite rewards' }
      );
    }
    
    return allTiers.sort((a, b) => a.pointsRequired - b.pointsRequired);
  };

  // Render the XP Manager tab
  const renderXPManager = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Member XP & Tier Management</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => fetchLoyaltyProgramMembers()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
            disabled={isMembersLoading}
          >
            {isMembersLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                <span>Loading...</span>
              </>
            ) : (
              <>
                <Users size={16} />
                <span>Refresh Members</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {isMembersLoading ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600 mr-2"></div>
          <p className="text-blue-700 dark:text-blue-300">Fetching members from the Algorand blockchain...</p>
        </div>
      ) : membersError ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300 font-medium">Error loading members: {membersError}</p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">Please try again or check your network connection.</p>
        </div>
      ) : members.length === 0 ? (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <Users className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-yellow-700 dark:text-yellow-300 font-medium">No members found</p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
            No wallet addresses have received loyalty passes from your programs yet.
          </p>
          <div className="mt-4">
            <button
              onClick={() => setActiveTab('members')}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              Go to Members
            </button>
          </div>
        </div>
      ) : (
        <XPManager 
          members={members} 
          onXPUpdated={handleXPUpdated}
          programTiers={extractProgramTiers()}
        />
      )}
    </div>
  );

  // Update member data with blockchain XP information
  const updateMemberXPData = async (member: Member): Promise<Member> => {
    try {
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const xpData = await fetchMemberXPTransactions(member.address, networkType);
      
      return {
        ...member,
        totalPoints: xpData.totalXP,
        currentTier: xpData.lastTierChange?.to || determineTier(xpData.totalXP, extractProgramTiers()),
        xpHistory: xpData.xpHistory
      };
    } catch (error) {
      console.error(`Error updating XP data for member ${member.address}:`, error);
      return member;
    }
  };

  const handleSendMessage = (member: Member) => {
    setSelectedMemberForMessage(member);
    setShowMessageCenter(true);
  };

  const closeMessageCenter = () => {
    setShowMessageCenter(false);
    setSelectedMemberForMessage(null);
  };

  // Check if user has an active subscription
  const hasActiveSubscription = !!subscriptionPlan;

  // Render subscription banner
  const renderSubscriptionBanner = () => {
    if (hasActiveSubscription) {
      return (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-800 p-2 rounded-full">
              <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-green-800 dark:text-green-300">
                Active Subscription: {subscriptionPlan!.charAt(0).toUpperCase() + subscriptionPlan!.slice(1)} Plan
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Your organization has full access to all features
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-100 dark:bg-yellow-800 p-2 rounded-full">
            <CreditCard className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-300">
              No Active Subscription
            </p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Subscribe to a plan to unlock all features and manage more members
            </p>
          </div>
        </div>
        <button
          onClick={onNavigateToPricing}
          className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
        >
          View Plans
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 my-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Organization Dashboard</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Network:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            activeNetwork === 'mainnet' 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
          }`}>
            {activeNetwork === 'mainnet' ? 'MainNet' : 'TestNet'}
          </span>
        </div>
      </div>
      
      {!activeAddress ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Connect your wallet to access your organization dashboard
          </p>
        </div>
      ) : (
        <>
          {/* Subscription Banner */}
          {renderSubscriptionBanner()}

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
            <button
              className={`py-3 px-6 font-medium text-lg whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => setActiveTab('overview')}
            >
              <BarChart3 size={20} />
              Overview
            </button>
            <button
              className={`py-3 px-6 font-medium text-lg whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'programs'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => {
                setActiveTab('programs');
                fetchUserLoyaltyPrograms();
              }}
            >
              <Award size={20} />
              Programs
            </button>
            <button
              className={`py-3 px-6 font-medium text-lg whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'members'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => {
                setActiveTab('members');
                fetchLoyaltyProgramMembers(); // Fetch members when tab is clicked
              }}
            >
              <Users size={20} />
              Members
              {isMembersLoading && <span className="ml-2 animate-pulse text-xs bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded-full">Loading...</span>}
            </button>
            <button
              className={`py-3 px-6 font-medium text-lg whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'leaderboard'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => setActiveTab('leaderboard')}
            >
              <Trophy size={20} />
              Leaderboard
            </button>
            <button
              className={`py-3 px-6 font-medium text-lg whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'xp-manager'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => {
                setActiveTab('xp-manager');
                fetchLoyaltyProgramMembers(); // Fetch members when tab is clicked
              }}
            >
              <TrendingUp size={20} />
              XP Manager
            </button>
            <button
              className={`py-3 px-6 font-medium text-lg whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'transfer'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => setActiveTab('transfer')}
            >
              <Send size={20} />
              Transfer Pass
            </button>
            <button
              className={`py-3 px-6 font-medium text-lg whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={20} />
              Settings
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'programs' && renderPrograms()}
          {activeTab === 'members' && renderMembers()}
          {activeTab === 'leaderboard' && renderLeaderboard()}
          {activeTab === 'xp-manager' && renderXPManager()}
          {activeTab === 'transfer' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Transfer Loyalty Pass</h3>
              <LoyaltyPassTransfer 
                onPassTransferred={(assetId, recipient) => {
                  // Add a new activity for the transfer
                  const newActivity = {
                    id: `transfer-${assetId}-${Date.now()}`,
                    type: 'pass_transferred',
                    message: `Loyalty pass (Asset ID: ${assetId}) was transferred to ${recipient.substring(0, 8)}...${recipient.substring(recipient.length - 4)}`,
                    timestamp: new Date().toISOString(),
                    color: 'blue'
                  };
                  
                  setRecentActivities(prev => [newActivity, ...prev].slice(0, 5));
                  
                  // Refresh programs
                  fetchUserLoyaltyPrograms();
                }}
              />
            </div>
          )}
          {activeTab === 'create' && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Create New Loyalty Program</h3>
              <LoyaltyProgramMinter 
                onLoyaltyProgramMinted={handleLoyaltyProgramMinted}
              />
            </div>
          )}
          {activeTab === 'settings' && (
            <UserSettings 
              onClose={() => setActiveTab('overview')}
            />
          )}
        </>
      )}
      
      {/* Program Details Modal */}
      {showProgramDetails && selectedProgram && renderProgramDetailsModal()}
      
      {/* Loyalty Pass Modal */}
      {showLoyaltyPassModal && selectedMember && renderLoyaltyPassModal()}
      
      {/* Message Center Modal */}
      {showMessageCenter && selectedMemberForMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <MessageCenter
              member={selectedMemberForMessage}
              isAdmin={true}
              onClose={closeMessageCenter}
              recipientAddress={selectedMemberForMessage.address}
              passId={selectedMemberForMessage.assetIds[0]}
            />
          </div>
        </div>
      )}
    </div>
  );
} 