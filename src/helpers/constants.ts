// Animation variants
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.3,
      staggerChildren: 0.2,
    },
  },
}

export const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 },
  },
}

export const cardVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100, delay: 0.2 },
  },
  hover: {
    scale: 1.05,
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)',
    transition: { type: 'spring', stiffness: 400, damping: 10 },
  },
}

export const featureItems = [
  {
    title: 'Earn & Redeem',
    description:
      'Collect loyalty points across multiple brands and redeem them for exclusive rewards',
    icon: '🏆',
  },
  {
    title: 'Loyalty Rewards',
    description:
      'Unlock special loyalty collectibles as you reach loyalty milestones',
    icon: '🎁',
  },
  {
    title: 'Secure & Transparent',
    description:
      'Blockchain-powered loyalty program with complete transparency and security',
    icon: '🔒',
  },
  {
    title: 'Cross-Brand Benefits',
    description:
      'Use your points across our entire partner network for maximum flexibility',
    icon: '🔄',
  },
]
// Network configurations
export const ALGORAND_NETWORKS = {
  testnet: {
    name: 'TestNet',
    type: 'testnet',
    algodToken: '',
    algodServer: 'https://testnet-api.algonode.cloud',
    algodPort: '',
    explorerUrl: 'https://lora.algokit.io/testnet',
    indexerUrl: 'https://testnet-idx.algonode.cloud',
  },
  mainnet: {
    name: 'MainNet',
    type: 'mainnet',
    algodToken: '',
    algodServer: 'https://mainnet-api.algonode.cloud',
    algodPort: '',
    explorerUrl: 'https://lora.algokit.io/mainnet',
    indexerUrl: 'https://mainnet-idx.algonode.cloud',
  },
}
