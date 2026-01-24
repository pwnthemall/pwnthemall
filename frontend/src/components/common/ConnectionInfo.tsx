import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface ConnectionInfoProps {
  challengeId: number;
  connectionInfo: string[];
}

const ConnectionInfo: React.FC<ConnectionInfoProps> = ({ challengeId, connectionInfo }) => {
  const [copiedItems, setCopiedItems] = useState<Set<number>>(new Set());
  const { t } = useLanguage();

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => new Set(prev).add(index));
      toast.success(t('copied_to_clipboard') || 'Copied to clipboard!');
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(index);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      toast.error(t('copy_failed') || 'Failed to copy to clipboard');
    }
  };

  if (!connectionInfo || connectionInfo.length === 0) {
    return null;
  }

  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-3">
        <ExternalLink className="w-4 h-4" />
        <span className="font-medium">{t('connection_info') || 'Connection Information'}</span>
      </div>
      <div className="space-y-2">
        {connectionInfo.map((info, index) => (
          <div key={index} className="flex items-center gap-2">
            <code className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded text-sm font-mono flex-1 break-all">
              {info}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(info, index)}
              className={`h-8 w-8 p-0 transition-all duration-200 border ${
                copiedItems.has(index) 
                  ? 'bg-green-100 dark:bg-green-900 text-green-600 border-green-300 dark:border-green-700 scale-110' 
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700'
              }`}
            >
              {copiedItems.has(index) ? (
                <Check className="w-4 h-4 animate-pulse" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConnectionInfo; 