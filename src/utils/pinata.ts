/**
 * Pinata IPFS upload utility
 * 
 * This file provides functions to upload files to IPFS using Pinata.
 * For production use, you should replace the placeholder API key with your actual Pinata API key.
 * In a real application, you should use environment variables for API keys.
 */

// For a real application, you would use environment variables:
// const PINATA_JWT = process.env.REACT_APP_PINATA_JWT || '';
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI5MjJjNmZkOC04ZTZhLTQxMzUtODA4ZS05ZTkwZTMyMjViNTIiLCJlbWFpbCI6Imp3YXZvbGFiaWxvdmUwMDE2QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJkOGI0YWNjZjk2MDI0OWE4YjNmMiIsInNjb3BlZEtleVNlY3JldCI6IjcxZjBkMjY0OWFjNjI2NjgzY2M2MjM3MDA0NTZjZGNhY2NlMWQ1Mzg5MWQ4MGUxOWZhZTg3NjIxNWFmZWE5NjkiLCJleHAiOjE3ODE4NTc3ODF9.N9x23fUM80hLy-c-E5XmjjfOP2BW06mBi4aXJw6RAC8'; // Replace with your actual JWT in production

// Helper functions for Pinata IPFS integration

/**
 * Uploads a file to IPFS via Pinata
 * @param file The file to upload
 * @returns Object with success status, CID and message
 */
export const pinFileToIPFS = async (file: File): Promise<{
  success: boolean;
  cid?: string;
  message?: string;
}> => {
  try {
    // Get API keys from environment variables
    const apiKey = import.meta.env.VITE_PINATA_API_KEY;
    const apiSecret = import.meta.env.VITE_PINATA_API_SECRET;
    const jwt = import.meta.env.VITE_PINATA_JWT;

    // Check if we have credentials
    const hasCredentials = (apiKey && apiSecret) || jwt;
    
    // If no credentials, use mock implementation for development
    if (!hasCredentials) {
      console.warn('No Pinata credentials found. Using mock implementation.');
      // Simulate a delay for the upload
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate a mock CID
      const mockCid = `bafkreib${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      
      return {
        success: true,
        cid: mockCid,
      };
    }

    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', file);

    // Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
      }
    });
    formData.append('pinataMetadata', metadata);

    // Add options
    const options = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', options);

    // Set headers based on available credentials
    const headers: Record<string, string> = {};
    
    if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`;
    } else if (apiKey && apiSecret) {
      headers['pinata_api_key'] = apiKey;
      headers['pinata_secret_api_key'] = apiSecret;
    }

    // Make API call to Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error uploading to Pinata');
    }

    const data = await response.json();
    return {
      success: true,
      cid: data.IpfsHash,
    };
  } catch (error: any) {
    console.error('Error uploading to IPFS via Pinata:', error);
    return {
      success: false,
      message: error.message || 'Failed to upload to IPFS',
    };
  }
};

/**
 * Converts an IPFS URL to a gateway URL for better compatibility
 * @param url IPFS URL (ipfs://, /ipfs/, or already a gateway URL)
 * @returns Gateway URL
 */
export const getIPFSGatewayURL = (url: string): string => {
  if (!url) return '';

  // Use preferred gateway
  const gateway = import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud';

  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '');
    return `${gateway}/ipfs/${cid}`;
  }

  // Handle /ipfs/ path
  if (url.includes('/ipfs/')) {
    const parts = url.split('/ipfs/');
    if (parts.length > 1) {
      return `${gateway}/ipfs/${parts[1]}`;
    }
  }

  // If it's already a gateway URL or something else, return as is
  return url;
};

/**
 * Extracts the CID from an IPFS URL
 * @param url IPFS URL in any format
 * @returns IPFS CID or null if not found
 */
export const extractIPFSCid = (url: string): string | null => {
  if (!url) return null;

  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '');
  }

  // Handle /ipfs/ path
  if (url.includes('/ipfs/')) {
    const parts = url.split('/ipfs/');
    if (parts.length > 1) {
      // Remove any query parameters or path components after the CID
      return parts[1].split('?')[0].split('/')[0];
    }
  }

  // Handle gateway URLs with CID pattern
  const gatewayRegex = /https:\/\/[^/]+\/ipfs\/([^/?#]+)/;
  const match = url.match(gatewayRegex);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}; 