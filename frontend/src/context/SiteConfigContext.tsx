import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from '@/lib/axios';
import { Config } from '@/models/Config';
import { useRealtimeUpdates } from '@/hooks/use-realtime-updates';

interface SiteConfigContextType {
  siteConfig: Record<string, string>;
  loading: boolean;
  error: boolean;
  refreshConfig: () => void;
  getSiteName: () => string;
}

const SiteConfigContext = createContext<SiteConfigContextType | undefined>(undefined);

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [siteConfig, setSiteConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Clear title on mount to prevent flash
  useEffect(() => {
    document.title = '';
  }, []);

  const fetchConfig = async () => {
    try {
      setError(false);
      const response = await axios.get<Config[]>('/api/public-configs');
      const configMap: Record<string, string> = {};
      response.data.forEach(config => {
        configMap[config.key] = config.value;
      });
      setSiteConfig(configMap);
      // Immediately update document title if we have a site name
      if (configMap.SITE_NAME) {
        document.title = configMap.SITE_NAME;
      }
    } catch (error) {
      console.error('Failed to fetch site configuration:', error);
      setError(true);
      // Don't set default values immediately - let components handle it
    } finally {
      setLoading(false);
    }
  };

  const refreshConfig = () => {
    setLoading(true);
    fetchConfig();
  };

  const getSiteName = () => {
    if (loading) return ''; // Return empty during loading to prevent flash
    if (error) return ''; // Return empty on error too to prevent flash
    return siteConfig.SITE_NAME || '';
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Listen for config updates via WebSocket
  useRealtimeUpdates((event) => {
    if (event.event === 'config-update') {
      // Refresh config when any public config changes
      fetchConfig();
    }
  }, true);

  // Update document title whenever site config changes
  useEffect(() => {
    if (!loading && !error && siteConfig.SITE_NAME) {
      document.title = siteConfig.SITE_NAME;
    }
  }, [siteConfig.SITE_NAME, loading, error]);

  return (
    <SiteConfigContext.Provider value={{ siteConfig, loading, error, refreshConfig, getSiteName }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  const context = useContext(SiteConfigContext);
  if (context === undefined) {
    throw new Error('useSiteConfig must be used within a SiteConfigProvider');
  }
  return context;
} 