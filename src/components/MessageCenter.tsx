import { useState, useEffect } from 'react';
import { useWallet, useNetwork } from '@txnlab/use-wallet-react';
import { Message, sendMessage as sendMessageUtil, fetchMessages } from '../utils/messages';
import { MessageSquare, Send, X, ChevronLeft, AlertCircle } from 'lucide-react';

interface Member {
  id: string;
  address: string;
  name: string;
  email: string;
  assetIds: number[];
}

interface MessageCenterProps {
  member?: Member;
  isAdmin?: boolean;
  onClose: () => void;
  recipientAddress?: string;
  passId?: number;
}

export function MessageCenter({ member, isAdmin = false, onClose, recipientAddress, passId }: MessageCenterProps) {
  const { activeAddress, signTransactions } = useWallet();
  const { activeNetwork } = useNetwork();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [recipient, setRecipient] = useState(recipientAddress || member?.address || '');
  const [sending, setSending] = useState(false);
  const [selectedPassId, setSelectedPassId] = useState<number | undefined>(passId);

  // Load messages on mount
  useEffect(() => {
    if (activeAddress) {
      loadMessages();
    }
  }, [activeAddress, activeNetwork, member]);

  useEffect(() => {
    // Update recipient and selectedPassId when member or recipientAddress changes
    setRecipient(recipientAddress || member?.address || '');
    setSelectedPassId(passId || member?.assetIds?.[0]);
  }, [member, recipientAddress, passId]);

  const loadMessages = async () => {
    if (!activeAddress) return;

    setLoading(true);
    setError(null);
    try {
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      const fetchedMessages = await fetchMessages(
        member ? member.address : activeAddress,
        networkType
      );
      setMessages(fetchedMessages);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      setError(error.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!activeAddress || !signTransactions) {
      setError('Please connect your wallet first');
      return;
    }

    if (!recipient || !recipient.trim()) {
      setError('Recipient address is required');
      return;
    }

    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    if (!content.trim()) {
      setError('Message content is required');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const networkType = activeNetwork === 'mainnet' ? 'mainnet' : 'testnet';
      await sendMessageUtil(
        activeAddress,
        recipient.trim(),
        subject,
        content,
        selectedPassId || (member?.assetIds?.[0]),
        signTransactions,
        networkType
      );

      // Reset form and refresh messages
      setSubject('');
      setContent('');
      setShowCompose(false);
      await loadMessages();
    } catch (error: any) {
      console.error('Error sending message:', error);
      setError(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDisplayName = (address: string): string => {
    if (member && (address === member.address)) {
      return member.name;
    }
    if (address === activeAddress) {
      return 'You';
    }
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {showCompose && (
              <button
                onClick={() => {
                  setShowCompose(false);
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MessageSquare size={20} />
              {showCompose ? 'New Message' : isAdmin ? 'Send Message' : 'Message Center'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertCircle size={16} />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-4rem)]">
          {showCompose ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">To</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setError(null);
                  }}
                  disabled={!!member || !!recipientAddress}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="Recipient's Algorand address"
                />
                {member && (
                  <p className="mt-1 text-sm text-gray-500">
                    Sending to: {member.name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setError(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Message subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setError(null);
                  }}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Type your message here..."
                />
              </div>
              {member && member.assetIds.length > 1 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Related Pass</label>
                  <select
                    value={selectedPassId || member.assetIds[0]}
                    onChange={(e) => {
                      const selectedPassId = Number(e.target.value);
                      setSelectedPassId(selectedPassId);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {member.assetIds.map((id) => (
                      <option key={id} value={id}>Pass #{id}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !recipient.trim() || !subject.trim() || !content.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">Loading messages...</p>
                </div>
              ) : messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium">{message.subject}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {message.sender === activeAddress ? 'To: ' : 'From: '}
                            {getDisplayName(message.sender === activeAddress ? message.receiver : message.sender)}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(message.timestamp)}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{message.content}</p>
                      {message.passId && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          Related to Pass ID: {message.passId}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600 dark:text-gray-400">No messages yet</p>
                </div>
              )}

              {/* Compose Button */}
              <button
                onClick={() => {
                  setShowCompose(true);
                  setError(null);
                }}
                className="fixed bottom-8 right-8 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-lg"
              >
                <Send size={16} />
                Compose
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 