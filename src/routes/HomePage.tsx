import { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { HomePage as HomePageContent } from '../components/HomePage';

export function HomePage() {
  const navigate = useNavigate();
  
  const handleNavigate = (page: 'home' | 'loyalty-dashboard' | 'create-program' | 'send-pass' | 'pricing') => {
    switch (page) {
      case 'home':
        navigate('/');
        break;
      case 'loyalty-dashboard':
        navigate('/dashboard');
        break;
      case 'create-program':
        navigate('/create-program');
        break;
      case 'send-pass':
        navigate('/send-pass');
        break;
      case 'pricing':
        navigate('/pricing');
        break;
    }
  };

  return <HomePageContent onNavigate={handleNavigate} />;
} 