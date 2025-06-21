import { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { motion } from 'framer-motion';

export function HomePage() {
  const { activeAddress } = useWallet();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Simulate loading delay for animation purposes
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  const cardVariants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100, delay: 0.2 }
    },
    hover: {
      scale: 1.05,
      boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)',
      transition: { type: 'spring', stiffness: 400, damping: 10 }
    }
  };

  const featureItems = [
    {
      title: 'Create Loyalty Programs',
      description: 'Design custom loyalty programs for your business with tiered rewards and point systems',
      icon: '🏆'
    },
    {
      title: 'Blockchain Security',
      description: 'Leverage Algorand blockchain for transparent, secure, and immutable loyalty point tracking',
      icon: '🔒'
    },
    {
      title: 'Customer Insights',
      description: 'Gain valuable data on customer behavior and preferences through loyalty program engagement',
      icon: '📊'
    },
    {
      title: 'Multi-brand Integration',
      description: 'Connect multiple businesses under a single loyalty ecosystem for enhanced customer value',
      icon: '🔄'
    }
  ];

  // Sample loyalty program examples
  const examplePrograms = [
    {
      name: "Coffee Rewards",
      company: "Bean & Brew",
      color: "#8B572A",
      points: 350,
      nextTier: "Gold Member",
      progress: 70
    },
    {
      name: "Fitness Club",
      company: "ActiveLife Gym",
      color: "#22C55E",
      points: 120,
      nextTier: "Silver Member",
      progress: 40
    },
    {
      name: "Bookstore Loyalty",
      company: "Page Turner Books",
      color: "#6366F1",
      points: 200,
      nextTier: "Bookworm Status",
      progress: 55
    }
  ];

  return (
    <motion.div
      initial="hidden"
      animate={isLoaded ? "visible" : "hidden"}
      variants={containerVariants}
      className="w-full"
    >
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-purple-700 text-white">
        {/* Background animated shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-500 opacity-20 animate-blob"></div>
          <div className="absolute top-40 -left-20 w-60 h-60 rounded-full bg-purple-500 opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-40 right-20 w-40 h-40 rounded-full bg-pink-500 opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10">
          <motion.div 
            className="text-center"
            variants={itemVariants}
          >
            <motion.h1 
              className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              <span className="block">Welcome to</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                Gaius Loyalty
              </span>
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl max-w-3xl mx-auto mb-10 text-blue-100"
              variants={itemVariants}
            >
              Create blockchain-powered loyalty programs that reward your customers and grow your business
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center"
              variants={itemVariants}
            >
              <motion.button 
                className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Create Your Program
              </motion.button>
              
              <motion.button 
                className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-full font-bold text-lg hover:bg-white/20 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Learn More
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Curved bottom edge */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 120" fill="currentColor" className="text-white dark:text-[#001324] w-full h-auto">
            <path d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"></path>
          </svg>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white dark:bg-[#001324]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            variants={itemVariants}
          >
            <motion.h2 
              className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-white"
              variants={itemVariants}
            >
              Powerful Loyalty Program Solutions
            </motion.h2>
            <motion.p 
              className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
              variants={itemVariants}
            >
              Everything you need to create, manage, and grow customer loyalty programs on the blockchain
            </motion.p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
            variants={containerVariants}
          >
            {featureItems.map((feature, index) => (
              <motion.div
                key={index}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 border border-gray-100 dark:border-gray-700"
                variants={cardVariants}
                whileHover="hover"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Example Programs Section */}
      <div className="py-20 bg-gray-50 dark:bg-gray-800/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            variants={itemVariants}
          >
            <motion.h2 
              className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-white"
              variants={itemVariants}
            >
              Sample Loyalty Programs
            </motion.h2>
            <motion.p 
              className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
              variants={itemVariants}
            >
              See how businesses are using Gaius to create engaging loyalty experiences
            </motion.p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={containerVariants}
          >
            {examplePrograms.map((program, index) => (
              <motion.div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg"
                variants={cardVariants}
                whileHover="hover"
              >
                <div 
                  className="h-3"
                  style={{ backgroundColor: program.color }}
                ></div>
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{program.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{program.company}</p>
                    </div>
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: program.color }}
                    >
                      {program.company.charAt(0)}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-300">Current Points</span>
                      <span className="font-medium text-gray-900 dark:text-white">{program.points}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div 
                        className="h-2.5 rounded-full" 
                        style={{ 
                          width: `${program.progress}%`,
                          backgroundColor: program.color
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-gray-500 dark:text-gray-400">Progress to {program.nextTier}</span>
                      <span className="text-gray-500 dark:text-gray-400">{program.progress}%</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button
                      className="w-full py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      View Program Details
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-20 bg-white dark:bg-[#001324]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            className="text-center mb-16"
            variants={itemVariants}
          >
            <motion.h2 
              className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-white"
              variants={itemVariants}
            >
              How Gaius Works
            </motion.h2>
            <motion.p 
              className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
              variants={itemVariants}
            >
              Simple steps to create and manage your blockchain loyalty program
            </motion.p>
          </motion.div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={containerVariants}
          >
            <motion.div
              className="text-center"
              variants={itemVariants}
            >
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Create Program</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Design your loyalty program with custom tiers, points, and rewards
              </p>
            </motion.div>

            <motion.div
              className="text-center"
              variants={itemVariants}
            >
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Engage Customers</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Customers join your program and earn points through purchases and actions
              </p>
            </motion.div>

            <motion.div
              className="text-center"
              variants={itemVariants}
            >
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Grow Business</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Analyze data, optimize rewards, and increase customer retention
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-br from-blue-600 to-purple-700 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold mb-6"
            variants={itemVariants}
          >
            Ready to Transform Your Customer Loyalty?
          </motion.h2>
          
          <motion.p 
            className="text-xl text-blue-100 max-w-3xl mx-auto mb-10"
            variants={itemVariants}
          >
            Join businesses using Gaius to create engaging, blockchain-powered loyalty programs
          </motion.p>
          
          <motion.button 
            className="px-8 py-4 bg-white text-blue-600 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            variants={itemVariants}
          >
            Get Started Now
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
} 