import { useState, useEffect } from 'react';
import { useWallet, useNetwork } from '@txnlab/use-wallet-react';
import algosdk from 'algosdk';
import { LoyaltyProgramMinter } from './LoyaltyProgramMinter';
import { MemberRegistrationForm } from './MemberRegistrationForm';
import { getAlgodClient, getNetworkConfig } from '../utils/algod';
import { getIPFSGatewayURL } from '../utils/pinata';
import * as QRCode from 'qrcode';
import { QrCode, Download, BarChart3, Users, Trophy, Settings, Eye, Plus, TrendingUp, Award, Star, X, Calendar, MapPin, Palette, CreditCard, Send, Wallet, UserPlus, Link, Share2 } from 'lucide-react';

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
  name: string;
  email: string;
  joinDate: string;
  totalPoints: number;
  currentTier: string;
  avatar?: string;
}

interface LeaderboardEntry {
  rank: number;
  member: Member;
  points: number;
  badge?: string;
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

export function LoyaltyProgramDashboard() {
  const { activeAddress, signTransactions } = useWallet();
  const { activeNetwork } = useNetwork();
  const [userLoyaltyPrograms, setUserLoyaltyPrograms] = useState<LoyaltyProgramInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'programs' | 'members' | 'leaderboard' | 'add-member' | 'create'>('overview');
  const [error, setError] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<LoyaltyProgramInfo | null>(null);
  const [showProgramDetails, setShowProgramDetails] = useState(false);
  const [showNFTPassModal, setShowNFTPassModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [issuingNFTPass, setIssuingNFTPass] = useState(false);
  const [nftPassResult, setNftPassResult] = useState<{ success: boolean; message: string; assetId?: number } | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState(0);
  const [showShareableLink, setShowShareableLink] = useState(false);
  const [shareableLinkProgram, setShareableLinkProgram] = useState<LoyaltyProgramInfo | null>(null);
  
  // Mock data for demonstration
  const [members] = useState<Member[]>([
    {
      id: '1',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      joinDate: '2024-01-15',
      totalPoints: 2450,
      currentTier: 'Gold',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150'
    },
    {
      id: '2',
      name: 'Bob Smith',
      email: 'bob@example.com',
      joinDate: '2024-02-20',
      totalPoints: 1800,
      currentTier: 'Silver',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
    },
    {
      id: '3',
      name: 'Carol Davis',
      email: 'carol@example.com',
      joinDate: '2024-03-10',
      totalPoints: 3200,
      currentTier: 'Platinum',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150'
    },
    {
      id: '4',
      name: 'David Wilson',
      email: 'david@example.com',
      joinDate: '2024-01-05',
      totalPoints: 950,
      currentTier: 'Bronze',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
    },
    {
      id: '5',
      name: 'Eva Martinez',
      email: 'eva@example.com',
      joinDate: '2024-02-28',
      totalPoints: 1650,
      currentTier: 'Silver',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'
    }
  ]);

  const leaderboard: LeaderboardEntry[] = members
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((member, index) => ({
      rank: index + 1,
      member,
      points: member.totalPoints,
      badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : undefined
    }));

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

  useEffect(() => {
    if (activeAddress) {
      fetchUserLoyaltyPrograms();
    }
  }, [activeAddress, activeNetwork]); // Always fetch when address or network changes

  // Clear programs and refetch when network changes
  useEffect(() => {
    if (activeAddress) {
      setUserLoyaltyPrograms([]); // Clear existing programs
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
          
          const isLoyaltyProgram = totalSupply === 1 && params.decimals === 0;
          
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

  const handleLoyaltyProgramMinted = () => {
    // Refresh the loyalty program list immediately to update overview
    fetchUserLoyaltyPrograms();
    // Switch to programs tab to show the new program
    setActiveTab('programs');
  };

  const generateShareableLink = (program: LoyaltyProgramInfo) => {
    const baseUrl = window.location.origin;
    const programName = encodeURIComponent(program.name);
    const companyName = encodeURIComponent(program.metadata?.co || program.metadata?.company || 'Company');
    return `${baseUrl}/register?programId=${program.id}&program=${programName}&company=${companyName}`;
  };

  const handleShareableLink = (program: LoyaltyProgramInfo) => {
    setShareableLinkProgram(program);
    setShowShareableLink(true);
  };

  const closeShareableLink = () => {
    setShowShareableLink(false);
    setShareableLinkProgram(null);
  };

  const handleMemberRegistrationSuccess = (member: any) => {
    // Add the new member to recent activities
    const newActivity = {
      id: `member-${member.id}`,
      type: 'member_joined',
      message: `${member.fullName} joined the loyalty program`,
      timestamp: new Date().toISOString(),
      color: 'green'
    };
    
    setRecentActivities(prev => [newActivity, ...prev].slice(0, 5));
    
    // Switch to members tab to show the new member
    setActiveTab('members');
  };

  const handleProgramClick = (program: LoyaltyProgramInfo) => {
    setSelectedProgram(program);
    setShowProgramDetails(true);
  };

  const closeProgramDetails = () => {
    setShowProgramDetails(false);
    setSelectedProgram(null);
  };

  const handleIssueNFTPass = (member: Member) => {
    setSelectedMember(member);
    setShowNFTPassModal(true);
    setNftPassResult(null);
    setRecipientAddress('');
    setSelectedProgramId(userLoyaltyPrograms[0]?.id || 0);
  };

  const closeNFTPassModal = () => {
    setShowNFTPassModal(false);
    setSelectedMember(null);
    setNftPassResult(null);
    setRecipientAddress('');
    setSelectedProgramId(0);
  };

  const issueNFTPass = async (recipientAddress: string) => {
    if (!activeAddress || !selectedMember || userLoyaltyPrograms.length === 0) {
      setNftPassResult({ success: false, message: 'Missing required information' });
      return;
    }

    setIssuingNFTPass(true);
    setNftPassResult(null);

    try {
      // Get network-specific algod client
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const algodClient = getAlgodClient(networkType);
      
      // Get suggested parameters
      const suggestedParams = await algodClient.getTransactionParams().do();
      
      // Select the chosen loyalty program for the pass
      const loyaltyProgram = userLoyaltyPrograms.find(p => p.id === selectedProgramId) || userLoyaltyPrograms[0];
      
      // Create NFT pass metadata
      const passMetadata = {
        name: `${loyaltyProgram.name} - ${selectedMember.currentTier} Pass`,
        description: `Loyalty pass for ${selectedMember.name} in ${loyaltyProgram.name} program`,
        image: loyaltyProgram.imageUrl,
        type: 'loyalty-pass',
        member: {
          id: selectedMember.id,
          name: selectedMember.name,
          email: selectedMember.email,
          tier: selectedMember.currentTier,
          points: selectedMember.totalPoints,
          joinDate: selectedMember.joinDate
        },
        program: {
          id: loyaltyProgram.id,
          name: loyaltyProgram.name,
          company: loyaltyProgram.metadata?.co || loyaltyProgram.metadata?.company
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

      // Create asset creation transaction for the NFT pass
      const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        sender: activeAddress,
        total: 1,
        decimals: 0,
        assetName: `${loyaltyProgram.name} Pass`,
        unitName: `${selectedMember.currentTier.toUpperCase()}PASS`,
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
        
        // If recipient address is provided and different from sender, transfer the NFT
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
              
              setNftPassResult({ 
                success: true, 
                message: `NFT Loyalty Pass issued and transferred to ${recipientAddress}!`, 
                assetId 
              });
            }
          } catch (transferError) {
            setNftPassResult({ 
              success: true, 
              message: `NFT Loyalty Pass created (Asset ID: ${assetId}) but transfer failed. You can manually transfer it later.`, 
              assetId 
            });
          }
        } else {
          setNftPassResult({ 
            success: true, 
            message: `NFT Loyalty Pass created successfully! Asset ID: ${assetId}`, 
            assetId 
          });
        }
      } else {
        throw new Error('Failed to sign transaction');
      }
    } catch (error: any) {
      console.error('Error issuing NFT pass:', error);
      setNftPassResult({ 
        success: false, 
        message: `Error issuing NFT pass: ${error.message || 'Unknown error'}` 
      });
    } finally {
      setIssuingNFTPass(false);
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

  // Shareable Link Modal
  const renderShareableLinkModal = () => {
    if (!shareableLinkProgram || !showShareableLink) return null;

    const shareableLink = generateShareableLink(shareableLinkProgram);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Share2 size={24} />
              Share Registration Link
            </h2>
            <button
              onClick={closeShareableLink}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Program Information */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Award size={18} />
                Program Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Program Name</p>
                  <p className="font-medium">{shareableLinkProgram.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Company</p>
                  <p className="font-medium">{shareableLinkProgram.metadata?.co || shareableLinkProgram.metadata?.company || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Asset ID</p>
                  <p className="font-medium">{shareableLinkProgram.id}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Network</p>
                  <p className="font-medium">{activeNetwork === 'mainnet' ? 'MainNet' : 'TestNet'}</p>
                </div>
              </div>
            </div>

            {/* Shareable Link */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Shareable Registration Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareableLink}
                  readOnly
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareableLink);
                    alert('Link copied to clipboard!');
                  }}
                  className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <Link size={16} />
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Share this link with potential members to allow them to register for your loyalty program
              </p>
            </div>

            {/* QR Code for Link */}
            <div className="text-center">
              <h3 className="font-semibold mb-3">QR Code for Registration Link</h3>
              <div className="bg-white p-4 rounded-lg inline-block shadow-sm">
                <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500 text-sm">QR Code would be generated here</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Members can scan this QR code to access the registration form
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">How to Use</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>1. Copy the registration link above</li>
                <li>2. Share it via email, social media, or any communication channel</li>
                <li>3. Members will fill out their details and verify their phone number</li>
                <li>4. Verified members will appear in your Members tab</li>
                <li>5. You can issue NFT loyalty passes to verified members</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeShareableLink}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  // Open in new tab for testing
                  window.open(shareableLink, '_blank');
                }}
                className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                Preview Form
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // NFT Pass Issuance Modal
  const renderNFTPassModal = () => {
    if (!selectedMember || !showNFTPassModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CreditCard size={24} />
              Issue NFT Loyalty Pass
            </h2>
            <button
              onClick={closeNFTPassModal}
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
                <img
                  src={selectedMember.avatar || `https://ui-avatars.com/api/?name=${selectedMember.name}&background=random`}
                  alt={selectedMember.name}
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedMember.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedMember.email}</p>
                  <p className="text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedMember.currentTier === 'Platinum' ? 'bg-purple-100 text-purple-800' :
                      selectedMember.currentTier === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                      selectedMember.currentTier === 'Silver' ? 'bg-gray-100 text-gray-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {selectedMember.currentTier}
                    </span>
                    <span className="ml-2 text-gray-600 dark:text-gray-300">
                      {selectedMember.totalPoints.toLocaleString()} points
                    </span>
                  </p>
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
                If left empty, the NFT pass will be minted to your wallet. You can transfer it later.
              </p>
            </div>

            {/* Pass Preview */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-3">NFT Pass Preview</h3>
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-lg">
                      {userLoyaltyPrograms.find(p => p.id === selectedProgramId)?.name || 'Loyalty Program'}
                    </h4>
                    <p className="text-blue-100 text-sm">
                      {userLoyaltyPrograms.find(p => p.id === selectedProgramId)?.metadata?.co || 'Company'}
                    </p>
                  </div>
                  <CreditCard size={24} className="text-blue-200" />
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-blue-100 text-xs">MEMBER</p>
                    <p className="font-medium">{selectedMember.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-100 text-xs">TIER</p>
                    <p className="font-bold text-yellow-300">{selectedMember.currentTier}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Result Message */}
            {nftPassResult && (
              <div className={`p-4 rounded-lg ${nftPassResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
                <p>{nftPassResult.message}</p>
                {nftPassResult.assetId && (
                  <p className="mt-2">
                    <a 
                      href={`${EXPLORER_URL}/asset/${nftPassResult.assetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      View NFT Pass on Explorer
                    </a>
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeNFTPassModal}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => issueNFTPass(recipientAddress)}
                disabled={issuingNFTPass || userLoyaltyPrograms.length === 0}
                className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {issuingNFTPass ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Issuing Pass...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Issue NFT Pass
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
    // Calculate stats
    const totalPoints = members.reduce((sum, m) => sum + m.totalPoints, 0);
    const activePasses = members.filter(m => m.totalPoints > 0).length; // Members with points are considered active
    
    return (
      <div className="space-y-6">
        {/* Stats Cards */}
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
              <p className="text-blue-100 text-xs">
                {userLoyaltyPrograms.length > 0 ? '+2 this month' : 'Create your first program'}
              </p>
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
              <p className="text-green-100 text-xs">+{Math.floor(members.length * 0.2)} this week</p>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Active Passes</p>
                <p className="text-3xl font-bold">{activePasses}</p>
              </div>
              <Star className="h-8 w-8 text-purple-200" />
            </div>
            <div className="mt-2">
              <p className="text-purple-100 text-xs">{((activePasses / members.length) * 100 || 0).toFixed(0)}% of total members</p>
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
                  <p className="text-sm text-gray-500">Eva Martinez joined the Gold tier program</p>
                </div>
                <span className="text-sm text-gray-400">2 hours ago</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium">Points redeemed</p>
                  <p className="text-sm text-gray-500">Alice Johnson redeemed 500 points</p>
                </div>
                <span className="text-sm text-gray-400">5 hours ago</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium">Tier upgrade</p>
                  <p className="text-sm text-gray-500">Bob Smith upgraded to Silver tier</p>
                </div>
                <span className="text-sm text-gray-400">1 day ago</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium">Points earned</p>
                  <p className="text-sm text-gray-500">Carol Davis earned 250 points from purchase</p>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userLoyaltyPrograms.map((program) => (
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
                
                <div className="space-y-3">
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
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareableLink(program);
                    }}
                    className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Share2 size={14} />
                    Share Registration Link
                  </button>
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

  const renderMembers = () => (
    <div className="space-y-6">
      {/* NFT Pass Info */}
      {userLoyaltyPrograms.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <h4 className="font-medium text-blue-900 dark:text-blue-100">NFT Loyalty Passes</h4>
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Issue unique NFT loyalty passes to your members! Each pass contains member information, tier status, 
            and program details stored on the Algorand blockchain. Members can use these passes to prove their 
            loyalty status and access exclusive benefits.
          </p>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Program Members</h3>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (userLoyaltyPrograms.length === 0) {
                alert('Please create a loyalty program first before issuing NFT passes.');
                return;
              }
              alert('Bulk NFT Pass issuance coming soon! For now, use the individual "Issue Pass" buttons.');
            }}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
            title="Issue NFT passes to all members"
          >
            <Wallet size={16} />
            Bulk Issue Passes
          </button>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
            Export Members
          </button>
          <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors">
            Add Member
          </button>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img
                        src={member.avatar || `https://ui-avatars.com/api/?name=${member.name}&background=random`}
                        alt={member.name}
                        className="w-10 h-10 rounded-full mr-3"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {member.totalPoints.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      member.currentTier === 'Platinum' ? 'bg-purple-100 text-purple-800' :
                      member.currentTier === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                      member.currentTier === 'Silver' ? 'bg-gray-100 text-gray-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {member.currentTier}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(member.joinDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleIssueNFTPass(member)}
                        className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-xs"
                        title="Issue NFT Loyalty Pass"
                      >
                        <CreditCard size={12} />
                        Issue Pass
                      </button>
                      <button className="text-blue-600 hover:text-blue-900">Edit</button>
                      <button className="text-red-600 hover:text-red-900">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAddMember = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-xl font-semibold mb-4">Add New Member</h3>
        {userLoyaltyPrograms.length === 0 ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <p className="text-yellow-800 dark:text-yellow-200">
              You need to create at least one loyalty program before adding members.
            </p>
            <button
              onClick={() => setActiveTab('create')}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Create Loyalty Program
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Manual Member Registration
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Use this form to manually register members for your loyalty programs. 
                Members will receive an OTP verification to confirm their phone number.
              </p>
            </div>
            
            {/* Program Selection */}
            <div className="max-w-md mx-auto">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Loyalty Program
              </label>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={0}>Choose a program...</option>
                {userLoyaltyPrograms.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name} (ID: {program.id})
                  </option>
                ))}
              </select>
            </div>
            
            {selectedProgramId > 0 && (
              <div className="max-w-2xl mx-auto">
                <MemberRegistrationForm
                  loyaltyProgramId={selectedProgramId.toString()}
                  onSuccess={handleMemberRegistrationSuccess}
                  onCancel={() => setSelectedProgramId(0)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Member Leaderboard</h3>
        <select className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
          <option>This Month</option>
          <option>Last Month</option>
          <option>All Time</option>
        </select>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {leaderboard.slice(0, 3).map((entry) => (
          <div key={entry.member.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
            <div className="text-4xl mb-2">{entry.badge}</div>
            <img
              src={entry.member.avatar || `https://ui-avatars.com/api/?name=${entry.member.name}&background=random`}
              alt={entry.member.name}
              className="w-16 h-16 rounded-full mx-auto mb-3"
            />
            <h4 className="font-semibold text-lg">{entry.member.name}</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{entry.member.currentTier}</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{entry.points.toLocaleString()}</p>
            <p className="text-xs text-gray-400">points</p>
          </div>
        ))}
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tier
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
                      <img
                        src={entry.member.avatar || `https://ui-avatars.com/api/?name=${entry.member.name}&background=random`}
                        alt={entry.member.name}
                        className="w-8 h-8 rounded-full mr-3"
                      />
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {entry.member.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-blue-600">
                      {entry.points.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
    </div>
  );

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
              onClick={() => setActiveTab('members')}
            >
              <Users size={20} />
              Members
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
                activeTab === 'add-member'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              onClick={() => setActiveTab('add-member')}
            >
              <UserPlus size={20} />
              Add Member
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'programs' && renderPrograms()}
          {activeTab === 'members' && renderMembers()}
          {activeTab === 'leaderboard' && renderLeaderboard()}
          {activeTab === 'add-member' && renderAddMember()}
          {activeTab === 'create' && (
            <LoyaltyProgramMinter onLoyaltyProgramMinted={handleLoyaltyProgramMinted} />
          )}
        </>
      )}
      
      {/* Program Details Modal */}
      {renderProgramDetailsModal()}
      
      {/* Shareable Link Modal */}
      {renderShareableLinkModal()}
      
      {/* NFT Pass Modal */}
      {renderNFTPassModal()}
    </div>
  );
} 