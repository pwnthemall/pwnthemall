import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2, File, Archive, Code } from 'lucide-react';
import axios from '@/lib/axios';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';

interface FileMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface ChallengeFilesProps {
  challengeId: number;
  files: string[];
}

export function ChallengeFiles({ challengeId, files }: ChallengeFilesProps) {
  const { t } = useLanguage();
  const [fileMetadata, setFileMetadata] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

  const fetchFileMetadata = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<FileMetadata[]>(`/api/challenges/${challengeId}/files`);
      setFileMetadata(response.data);
    } catch (error) {
      console.error('Failed to fetch file metadata:', error);
      toast.error(t('failed_to_load_files') || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [challengeId, t]);

  useEffect(() => {
    if (files && files.length > 0) {
      fetchFileMetadata();
    }
  }, [challengeId, files, fetchFileMetadata]);

  const handleDownload = async (file: FileMetadata) => {
    setDownloadingFiles(prev => new Set(prev).add(file.name));
    
    try {
      // Download file as blob from backend proxy
      const response = await axios.get(`/api/challenges/${challengeId}/files/${encodeURIComponent(file.name)}`, {
        responseType: 'blob',
      });
      
      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: file.contentType || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: Error | any) {
      if(error.response && error.response.status === 429) {
        toast.error(t('rate_limit_exceeded') || 'Too many requests. Please try again later.');
        return;
      }
      toast.error(t('file_download_failed') || 'Download failed');
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.name);
        return newSet;
      });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getFileIcon = (name: string, contentType: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    
    if (contentType.startsWith('text/') || ['txt', 'md', 'log'].includes(ext || '')) {
      return <FileText className="w-4 h-4" />;
    }
    if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext || '')) {
      return <Archive className="w-4 h-4" />;
    }
    if (['py', 'js', 'ts', 'java', 'c', 'cpp', 'go', 'rs', 'sh'].includes(ext || '')) {
      return <Code className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  if (!files || files.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="mb-4 p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t('loading_files') || 'Loading files...'}</span>
        </div>
      </div>
    );
  }

  if (fileMetadata.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 p-4 border rounded-lg bg-muted/50">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Download className="w-4 h-4" />
        {t('challenge_files') || 'Challenge files'}
      </h3>
      <div className="flex flex-wrap gap-2">
        {fileMetadata.map((file) => (
          <Button
            key={file.name}
            variant="outline"
            size="sm"
            onClick={() => handleDownload(file)}
            disabled={downloadingFiles.has(file.name)}
            className="flex items-center gap-2"
          >
            {downloadingFiles.has(file.name) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              getFileIcon(file.name, file.contentType)
            )}
            <span className="font-mono text-xs">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              ({formatBytes(file.size)})
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
