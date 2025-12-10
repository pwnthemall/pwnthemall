import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { CTFStatus } from "@/hooks/use-ctf-status";
import { Challenge, Solve } from "@/models/Challenge";
import { BadgeCheck, Trophy, Play, Square, Settings, Clock, Star, Lock } from "lucide-react";
import ConnectionInfo from "@/components/ConnectionInfo";
import axios from "@/lib/axios";
import { toast } from "sonner";
import Head from "next/head";
import Link from "next/link";
import {
  Card,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GeoPicker from "./GeoPicker";
import ChallengeImage from "@/components/ChallengeImage";
import { useInstances } from "@/hooks/use-instances";
import { useHints } from "@/hooks/use-hints";
import { debugError, debugLog } from "@/lib/debug";
import type { User } from "@/models/User";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChallengeInstances } from "@/hooks/use-challenge-instances";
import { buildSubmitPayload, formatDate, GeoCoords } from "./category-helpers";
import { ChallengeFiles } from "@/components/ChallengeFiles";

interface CategoryContentProps {
  cat: string;
  challenges: Challenge[];
  onChallengeUpdate?: () => void;
  ctfStatus: CTFStatus;
  ctfLoading: boolean;
}

const CategoryContent = ({ cat, challenges = [], onChallengeUpdate, ctfStatus, ctfLoading }: CategoryContentProps) => {
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [flag, setFlag] = useState("");
  const [loading, setLoading] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{lat: number; lng: number} | null>(null);
  const [open, setOpen] = useState(false);
  const [solves, setSolves] = useState<Solve[]>([]);
  const [solvesLoading, setSolvesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [instanceStatus, setInstanceStatus] = useState<{[key: number]: 'running' | 'stopped' | 'building' | 'expired' | 'stopping'}>({});
  const [instanceDetails, setInstanceDetails] = useState<{[key: number]: any}>({});
  const [connectionInfo, setConnectionInfo] = useState<{[key: number]: string[]}>({});
  const [instanceOwner, setInstanceOwner] = useState<{[key: number]: { userId: number; username?: string } }>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { getSiteName } = useSiteConfig();
  const { loading: instanceLoading, startInstance, stopInstance, killInstance, getInstanceStatus: fetchInstanceStatus } = useInstances();
  const { teamScore, loading: hintsLoading, purchaseHint, refreshTeamScore } = useHints();

  // Fetch instance status for all Docker challenges when challenges are loaded
  const [statusFetched, setStatusFetched] = useState(false);
  
  useEffect(() => {
    if (!challenges || challenges.length === 0 || statusFetched) return;
    
    const fetchAllInstanceStatuses = async () => {
      const dockerChallenges = challenges.filter(challenge => isDockerChallenge(challenge));
      
      for (const challenge of dockerChallenges) {
        try {
          const status = await fetchInstanceStatus(challenge.id.toString());
          if (status) {
            // Map API status to local status
            let localStatus: 'running' | 'stopped' | 'building' | 'expired' = 'stopped';
            if (status.status === 'running') {
              localStatus = 'running';
            } else if (status.status === 'building') {
              localStatus = 'building';
            } else if (status.status === 'expired') {
              localStatus = 'expired';
            } else {
              // 'no_instance', 'stopped', 'no_team', etc. all map to 'stopped'
              localStatus = 'stopped';
            }
            
            setInstanceStatus(prev => ({
              ...prev,
              [challenge.id]: localStatus
            }));

            // Store connection info if available
            if (status.connection_info && status.connection_info.length > 0) {
              setConnectionInfo(prev => ({
                ...prev,
                [challenge.id]: status.connection_info
              }));
            } else {
              setConnectionInfo(prev => ({
                ...prev,
                [challenge.id]: []
              }));
            }
          }
        } catch (error) {
          debugError(`Failed to fetch status for challenge ${challenge.id}:`, error);
        }
      }
      setStatusFetched(true);
    };

    fetchAllInstanceStatuses();
  }, [challenges.length, statusFetched]); // Only run once when challenges load

  // Real-time: listen to hint purchases over WebSocket
  useEffect(() => {
    debugLog('[WebSocket] Registering hint-purchase event listener');
    
    const handler = (e: any) => {
      const data = e?.detail;
      if (!data || data.event !== 'hint_purchase') {
        return;
      }

      debugLog('[WebSocket] Received hint_purchase event:', data);

      // Update selected challenge - use functional update to get current state
      setSelectedChallenge(prev => {
        if (!prev || prev.id !== data.challengeId) {
          return prev;
        }
        
        debugLog('[WebSocket] Updating hints for challenge', prev.id);
        
        const updatedHints = prev.hints?.map(h => 
          h.id === data.hintId 
            ? { ...h, purchased: true, content: data.hintContent }
            : h
        ) || [];
        
        return { ...prev, hints: updatedHints };
      });

      // Show toast notification to inform team member
      if (data.username) {
        toast.info(`${data.username} a acheté l'indice "${data.hintTitle}"`);
      }

      // Refresh team score
      refreshTeamScore();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('hint-purchase', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('hint-purchase', handler as EventListener);
      }
    };
  }, [refreshTeamScore]);

  // Real-time: listen to instance updates over WebSocket
  useEffect(() => {
    debugLog('[WebSocket] Registering instance-update event listener');
    
    const handler = (e: any) => {
      debugLog('[WebSocket] RAW EVENT RECEIVED:', e);
      const data = e?.detail || e?.data;
      debugLog('[WebSocket] Event data:', data);
      if (!data || data.event !== 'instance_update') {
        debugLog('[WebSocket] Ignoring event, not instance_update');
        return;
      }

      debugLog('[WebSocket] Received instance_update:', data);

      const challengeId = Number(data.challengeId);
      if (!challengeId) return;

      // Update status
      let newStatus: 'running' | 'stopped' | 'building' | 'expired' | 'stopping' = 'stopped';
      if (data.status === 'running') newStatus = 'running';
      else if (data.status === 'building') newStatus = 'building';
      else if (data.status === 'expired') newStatus = 'expired';
      else if (data.status === 'stopping') newStatus = 'stopping';

      debugLog(`[WebSocket] Challenge ${challengeId} status: ${data.status} → ${newStatus}`);
      setInstanceStatus(prev => {
        debugLog(`[WebSocket] Updating instance status from`, prev[challengeId], 'to', newStatus);
        return { ...prev, [challengeId]: newStatus };
      });

      // Update connection info when running
      if (newStatus === 'running' && Array.isArray(data.connectionInfo)) {
        debugLog(`[WebSocket] Setting connection info for challenge ${challengeId}:`, data.connectionInfo);
        setConnectionInfo(prev => ({ ...prev, [challengeId]: data.connectionInfo }));
      }
      if (newStatus !== 'running' && newStatus !== 'stopping') {
        debugLog(`[WebSocket] Clearing connection info for challenge ${challengeId}`);
        setConnectionInfo(prev => {
          const newInfo = { ...prev, [challengeId]: [] };
          debugLog(`[WebSocket] Connection info after clear:`, newInfo);
          return newInfo;
        });
      }

      // Track instance owner from event payload
      if (newStatus === 'running' && (typeof data.userId === 'number' || typeof data.userId === 'string')) {
        const ownerId = Number(data.userId);
        debugLog(`[WebSocket] Setting instance owner for challenge ${challengeId}:`, ownerId);
        setInstanceOwner(prev => ({
          ...prev,
          [challengeId]: { userId: ownerId, username: data.username }
        }));
      } else if (newStatus !== 'running') {
        debugLog(`[WebSocket] Clearing instance owner for challenge ${challengeId}`);
        setInstanceOwner(prev => {
          const copy = { ...prev } as any;
          delete copy[challengeId];
          debugLog(`[WebSocket] Instance owner after delete:`, copy);
          return copy;
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('instance-update', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('instance-update', handler as EventListener);
      }
    };
  }, []);

  // Clear solves data when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSolves([]);
      setSolvesLoading(false);
    }
  }, [open]);

  // Fetch current user (for ownership checks)
  useEffect(() => {
    let mounted = true;
    axios.get<User>("/api/me").then((res) => {
      if (mounted) setCurrentUser(res.data as User);
    }).catch(() => {
      // ignore
    });
    return () => { mounted = false };
  }, []);

  const handleSubmit = async () => {
    if (!selectedChallenge) return;
    setLoading(true);
    try {
      const payload = buildSubmitPayload(selectedChallenge, flag, geoCoords);
      const res = await axios.post(`/api/challenges/${selectedChallenge.id}/submit`, payload);

      toast.success(t(res.data.message) || 'Challenge solved!');
      if (onChallengeUpdate) onChallengeUpdate();
      
      fetchSolves(selectedChallenge.id);
      await handlePostSubmitInstanceCleanup(selectedChallenge.id);
    } catch (err: any) {
      const errorKey = err.response?.data?.error || err.response?.data?.result;
      toast.error(t(errorKey) || 'Try again');
      if (onChallengeUpdate) onChallengeUpdate();
    } finally {
      setLoading(false);
      setFlag("");
    }
  };

  const handlePostSubmitInstanceCleanup = async (challengeId: number) => {
    try {
      if (getLocalInstanceStatus(challengeId) === 'running') {
        await stopInstance(challengeId.toString());
        setInstanceStatus(prev => ({ ...prev, [challengeId]: 'stopped' }));
        toast.success(t('instance_stopped_success') || 'Instance stopped successfully');
      }
    } catch {}
  };

  const fetchSolves = async (challengeId: number) => {
    if (!Number.isInteger(challengeId) || challengeId <= 0) {
      debugError('Invalid challenge ID provided to fetchSolves');
      setSolves([]);
      setSolvesLoading(false);
      return;
    }
    
    setSolvesLoading(true);
    try {
      const response = await axios.get<Solve[]>(`/api/challenges/${challengeId}/solves`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      setSolves(response.data || []);
    } catch (err: any) {
      debugError('Failed to fetch solves:', err);
      setSolves([]);
    } finally {
      setSolvesLoading(false);
    }
  };

  const handleChallengeSelect = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setFlag("");
    setOpen(true);
    setActiveTab("description");
    // Clear previous solves data and fetch fresh data
    setSolves([]);
    setSolvesLoading(false);
    fetchSolves(challenge.id);
    // Refresh team score when opening challenge
    refreshTeamScore();
  };



  const handleStartInstance = async (challengeId: number) => {
    try {
      setInstanceStatus(prev => ({ ...prev, [challengeId]: 'building' }));
      await startInstance(challengeId.toString());
      // Fetch the actual status from backend after starting
      const status = await fetchInstanceStatus(challengeId.toString());
      if (status) {
        let localStatus: 'running' | 'stopped' | 'building' | 'expired' = 'running';
        if (status.status === 'running') {
          localStatus = 'running';
        } else if (status.status === 'building') {
          localStatus = 'building';
        } else if (status.status === 'expired') {
          localStatus = 'expired';
        } else {
          localStatus = 'stopped';
        }
        setInstanceStatus(prev => ({ ...prev, [challengeId]: localStatus }));

        // Store connection info if available
        if (status.connection_info && status.connection_info.length > 0) {
          setConnectionInfo(prev => ({
            ...prev,
            [challengeId]: status.connection_info
          }));
        } else {
          setConnectionInfo(prev => ({
            ...prev,
            [challengeId]: []
          }));
        }
      } else {
        setInstanceStatus(prev => ({ ...prev, [challengeId]: 'running' }));
      }
    } catch (error) {
      setInstanceStatus(prev => ({ ...prev, [challengeId]: 'stopped' }));
    }
  };

  const handleStopInstance = async (challengeId: number) => {
    try {
      // If we know the owner and it's not the current user (and not admin), show localized toast and abort
      const owner = instanceOwner[challengeId];
      if (owner && currentUser && owner.userId !== currentUser.id && currentUser.role !== 'admin') {
        const ownerName = owner.username || t('a_teammate');
        const key = 'cannot_stop_instance_not_owner';
        const translated = t(key, { username: ownerName });
        toast.error(translated !== key ? translated : `You can't stop this instance because it was started by ${ownerName}.`);
        return;
      }

      // Set status to 'stopping' to show stopping state
      setInstanceStatus(prev => ({ ...prev, [challengeId]: 'stopping' }));
      
      await stopInstance(challengeId.toString());
      
      // The status will be updated to 'stopped' via websocket when backend finishes stopping
      // No polling needed - websocket 'instance_update' event will handle it
    } catch (error: any) {
      // If backend denies or not found while we think it's running, assume non-owner attempt
      const errCode = error?.response?.data?.error;
      const httpStatus = error?.response?.status;
      if (
        (errCode === 'not_authorized' || errCode === 'forbidden' || errCode === 'instance_not_found') &&
        getLocalInstanceStatus(challengeId) === 'running'
      ) {
        const owner = instanceOwner[challengeId];
        const ownerName = owner?.username || t('a_teammate');
        const key = 'cannot_stop_instance_not_owner';
        const translated = t(key, { username: ownerName });
        toast.error(translated !== key ? translated : `You can't stop this instance because it was started by ${ownerName}.`);
      }
      // Keep current status on error otherwise
    }
  };

  const isDockerChallenge = (challenge: Challenge) => {
    if ((challenge.challengeType?.name?.toLowerCase() === 'docker') || (challenge.challengeType?.name?.toLowerCase() === 'compose')) {
      return true
    }
  };

  const getLocalInstanceStatus = (challengeId: number) => {
    return instanceStatus[challengeId] || 'stopped';
  };
  
  const { t } = useLanguage();
  
  // Safety check for challenges
  if (!challenges || challenges.length === 0) {
    return (
      <>
        <Head>
          <title>{getSiteName()} - {cat}</title>
        </Head>
        <main className="bg-muted flex flex-col items-center justify-center min-h-screen px-6 py-10 text-center">
          <h1 className="text-3xl font-bold mb-6 dark:text-cyan-400">
            {cat}
          </h1>
          <p className="text-muted-foreground">{t('no_challenges_available') || 'No challenges available'}</p>
        </main>
      </>
    );
  }
  
  return (
    <>
      <Head>
        <title>{getSiteName()} - {cat}</title>
      </Head>

      <main className="bg-muted flex flex-col items-center justify-start min-h-screen px-6 py-10 text-center">
        <h1 className="text-3xl font-bold mb-6 dark:text-cyan-400">
          {cat}
        </h1>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 w-full max-w-7xl">
          {(challenges || []).map((challenge) => (
            <Card
              key={challenge.id}
              onClick={() => !challenge.locked && handleChallengeSelect(challenge)}
              className={`hover:shadow-lg transition-shadow duration-200 relative overflow-hidden flex flex-col ${
                challenge.locked 
                  ? 'opacity-60 cursor-not-allowed' 
                  : challenge.solved 
                    ? 'bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-700 cursor-pointer' 
                    : 'cursor-pointer'
              }`}
            >
              {/* Cover Image or Emoji Placeholder - Fixed height zone */}
              <div className="h-48 flex-shrink-0 relative">
                {challenge.coverImg && challenge.id ? (
                  <ChallengeImage 
                    challengeId={challenge.id} 
                    alt={challenge.name || 'Challenge cover'}
                    className="h-full w-full object-cover rounded-t-lg"
                    positionX={challenge.coverPositionX}
                    positionY={challenge.coverPositionY}
                    zoom={challenge.coverZoom}
                  />
                ) : (
                  <div className="h-full w-full rounded-t-lg flex items-center justify-center bg-muted/50">
                    <span className="text-7xl opacity-30 select-none" aria-hidden="true">
                      {challenge.emoji || '🎯'}
                    </span>
                  </div>
                )}
                
                {/* Locked indicator */}
                {challenge.locked && (
                  <div className="absolute z-10 top-2 left-2">
                    <Lock className="w-6 h-6 text-white drop-shadow-lg" />
                  </div>
                )}
                
                {/* Solved check */}
                {challenge.solved && !challenge.locked && (
                  <div className="absolute top-2 left-2">
                    <BadgeCheck className="w-6 h-6 text-green-400 drop-shadow-lg" />
                  </div>
                )}

                {/* Points badge at top-right */}
                {(typeof challenge.currentPoints === 'number' || typeof challenge.points === 'number') && (
                  <div className="absolute z-10 pointer-events-none select-none top-2 right-2">
                    <div className="flex items-center gap-1 rounded-full border bg-muted/90 backdrop-blur-sm px-2 py-0.5 shadow-sm">
                      <Star className="w-5 h-5" />
                      <span className="text-sm font-semibold leading-none">
                        {typeof challenge.currentPoints === 'number' ? challenge.currentPoints : challenge.points}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide leading-none">{t('points') || 'Points'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Content zone */}
              <div className="flex flex-col p-4 pb-5">
                <CardTitle className={`text-xl font-bold mb-3 text-center ${
                  challenge.solved 
                    ? 'text-green-700 dark:text-green-200' 
                    : 'dark:text-cyan-300'
                }`}>
                  {challenge.name || 'Unnamed Challenge'}
                </CardTitle>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-400 dark:border-gray-500 pointer-events-none select-none"
                  >
                    {challenge.challengeDifficulty?.name || 'Unknown Difficulty'}
                  </Badge>
                  {isDockerChallenge(challenge) && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        getLocalInstanceStatus(challenge.id) === 'running' 
                          ? 'bg-green-300 dark:bg-green-700 text-green-900 dark:text-green-100 border border-green-500 dark:border-green-400' 
                          : getLocalInstanceStatus(challenge.id) === 'building'
                          ? 'bg-orange-300 dark:bg-orange-700 text-orange-900 dark:text-orange-100 border border-orange-500 dark:border-orange-400'
                          : getLocalInstanceStatus(challenge.id) === 'stopping'
                          ? 'bg-orange-300 dark:bg-orange-700 text-orange-900 dark:text-orange-100 border border-orange-500 dark:border-orange-400'
                          : getLocalInstanceStatus(challenge.id) === 'expired'
                          ? 'bg-red-300 dark:bg-red-700 text-red-900 dark:text-red-100 border border-red-500 dark:border-red-400'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-400 dark:border-gray-500'
                      } pointer-events-none select-none`}
                    >
                      {getLocalInstanceStatus(challenge.id) === 'running' ? t('running') : 
                       getLocalInstanceStatus(challenge.id) === 'building' ? t('building') : 
                       getLocalInstanceStatus(challenge.id) === 'stopping' ? t('stopping') : 
                       getLocalInstanceStatus(challenge.id) === 'expired' ? t('expired') : t('stopped')}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl w-[90vw] h-[80vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0 pb-4">
              <DialogTitle className={`${
                selectedChallenge?.solved 
                  ? 'text-green-600 dark:text-green-300' 
                  : 'dark:text-cyan-300'
              }`}>
                {selectedChallenge?.name || 'Unnamed Challenge'}
                {selectedChallenge?.solved && (
                  <BadgeCheck className="inline-block w-6 h-6 ml-2 text-green-600 dark:text-green-400" />
                )}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {t('difficulty')}: {selectedChallenge?.challengeDifficulty?.name || 'Unknown'} - {t('author')}: {selectedChallenge?.author || 'Unknown'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 flex flex-col min-h-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                <TabsList className={`grid w-full mb-4 flex-shrink-0 bg-card border rounded-lg p-1 relative z-[1200] ${
                  selectedChallenge && isDockerChallenge(selectedChallenge) 
                    ? (selectedChallenge.hints && selectedChallenge.hints.length > 0 ? 'grid-cols-4' : 'grid-cols-3')
                    : (selectedChallenge?.hints && selectedChallenge.hints.length > 0 ? 'grid-cols-3' : 'grid-cols-2')
                }`}>
                  <TabsTrigger value="description">{t('description')}</TabsTrigger>
                  {selectedChallenge?.hints && selectedChallenge.hints.length > 0 && (
                    <TabsTrigger value="hints">{t('hints') || 'Hints'}</TabsTrigger>
                  )}
                  <TabsTrigger value="solves">{t('solves')}</TabsTrigger>
                  {selectedChallenge && isDockerChallenge(selectedChallenge) && (
                    <TabsTrigger value="instance">{t('docker_instance')}</TabsTrigger>
                  )}
                </TabsList>
                    
                    <div className="flex-1 min-h-0 relative overflow-hidden z-[1100] min-h-[30vh]">
                      {/* Tab Panels: absolutely positioned & independently scrollable */}
                      <TabsContent value="description" className="absolute inset-0 overflow-y-auto mt-0 pt-2 pr-2 z-[1100]">
                        <div className="text-left text-foreground leading-relaxed min-h-full">
                          {selectedChallenge?.files && selectedChallenge.files.length > 0 && (
                            <ChallengeFiles 
                              challengeId={selectedChallenge.id} 
                              files={selectedChallenge.files} 
                            />
                          )}
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: (props: any) => (
                                <a
                                  {...props}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline dark:text-cyan-300 hover:text-cyan-800 dark:hover:text-cyan-200"
                                >
                                  {props.children}
                                </a>
                              ),
                              code: (props: any) => (
                                <code
                                  className={`rounded px-1.5 py-0.5 bg-muted text-foreground ${props.className || ''}`}
                                  {...props}
                                >
                                  {props.children}
                                </code>
                              ),
                              pre: (props: any) => (
                                <pre className="p-3 rounded-md bg-muted overflow-x-auto border">
                                  {props.children}
                                </pre>
                              ),
                              ul: (props: any) => (
                                <ul className="list-disc ml-6 space-y-1" {...props}>{props.children}</ul>
                              ),
                              ol: (props: any) => (
                                <ol className="list-decimal ml-6 space-y-1" {...props}>{props.children}</ol>
                              ),
                              h1: (props: any) => <h1 className="text-2xl font-bold mt-2 mb-2" {...props}>{props.children}</h1>,
                              h2: (props: any) => <h2 className="text-xl font-semibold mt-2 mb-2" {...props}>{props.children}</h2>,
                              h3: (props: any) => <h3 className="text-lg font-semibold mt-2 mb-2" {...props}>{props.children}</h3>,
                              p: (props: any) => <p className="mb-2" {...props} />,
                              table: (props: any) => (
                                <div className="overflow-x-auto my-3">
                                  <table className="w-full text-sm border border-border rounded-md" {...props} />
                                </div>
                              ),
                              thead: (props: any) => (
                                <thead className="bg-muted/50" {...props} />
                              ),
                              tbody: (props: any) => <tbody {...props} />,
                              tr: (props: any) => (
                                <tr className="border-b last:border-0" {...props} />
                              ),
                              th: (props: any) => (
                                <th className="text-left font-semibold px-3 py-2 border-r last:border-r-0" {...props} />
                              ),
                              td: (props: any) => (
                                <td className="px-3 py-2 align-top border-r last:border-r-0" {...props} />
                              ),
                            }}
                          >
                            {selectedChallenge?.description || 'No description available'}
                          </ReactMarkdown>

                          {/* Submission / Interaction area within Description tab */}
                          {selectedChallenge?.solved ? (
                            <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
                              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                                <BadgeCheck className="w-5 h-5" />
                                <span className="font-medium">{t('already_solved')}</span>
                              </div>
                              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                {t('challenge_already_solved')}
                              </p>
                            </div>
                          ) : !ctfLoading && (ctfStatus.status === 'not_started' || ctfStatus.status === 'ended') ? (
                            <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-lg">
                              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                                <Clock className="w-5 h-5" />
                                <span className="font-medium">
                                  {ctfStatus.status === 'not_started' 
                                    ? (t('ctf_not_started') || 'CTF Not Started')
                                    : (t('ctf_ended') || 'CTF Ended')}
                                </span>
                              </div>
                              <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                                {ctfStatus.status === 'not_started' 
                                  ? (t('flag_submission_not_available_yet') || 'Flag submission is not available yet. Please wait for the CTF to start.')
                                  : (t('flag_submission_no_longer_available') || 'Flag submission is no longer available. The CTF has ended.')}
                              </p>
                            </div>
                          ) : (
                            <div className="mt-4 flex flex-col gap-4 pb-2">
                              {selectedChallenge?.challengeType?.name?.toLowerCase() === 'geo' ? (
                                <div className="w-full" style={{ height: '40vh', maxHeight: 420 }}>
                                  <GeoPicker value={geoCoords} onChange={setGeoCoords} height={'100%'} radiusKm={selectedChallenge?.geoRadiusKm ?? null} />
                                </div>
                              ) : (
                                <Input
                                  placeholder={t('enter_your_flag')}
                                  value={flag}
                                  onChange={(e) => setFlag(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && flag.trim()) {
                                      handleSubmit();
                                    }
                                  }}
                                  className="w-full"
                                  disabled={loading}
                                />
                              )}
                              <Button
                                onClick={handleSubmit}
                                disabled={
                                  loading || 
                                  (selectedChallenge?.challengeType?.name?.toLowerCase() === 'geo' ? !geoCoords : !flag.trim()) ||
                                  !!(selectedChallenge?.maxAttempts && selectedChallenge.maxAttempts > 0 && (selectedChallenge.teamFailedAttempts || 0) >= selectedChallenge.maxAttempts)
                                }
                                className="bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600"
                              >
                                {loading ? t('submitting') : t('submit')}
                              </Button>
                              {/* Attempts indicator - small, subtle, under submit button */}
                              {selectedChallenge?.maxAttempts != null && selectedChallenge.maxAttempts > 0 ? (
                                <div className="text-center -mt-2">
                                  <span className="text-xs text-muted-foreground opacity-70">
                                    {t('attempts_left')}: {selectedChallenge.maxAttempts - (selectedChallenge.teamFailedAttempts || 0)}/{selectedChallenge.maxAttempts}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      {selectedChallenge?.hints && selectedChallenge.hints.length > 0 && (
                        <TabsContent value="hints" className="absolute inset-0 overflow-y-auto mt-0 pt-2 pr-2 z-[1100]">
                          <div className="min-h-full">
                            <div className="space-y-4">
                              {/* Team Score Display */}
                              {teamScore && (
                                <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                                  <h3 className="font-semibold text-lg text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                                    <Trophy className="w-5 h-5" />
                                    {t('hints.team_score') || 'Team Score'}
                                  </h3>
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-blue-600 dark:text-blue-400 font-medium">{t('hints.total') || 'Total'}:</span>
                                      <div className="font-bold text-blue-800 dark:text-blue-200">{teamScore.totalScore} pts</div>
                                    </div>
                                    <div>
                                      <span className="text-green-600 dark:text-green-400 font-medium">{t('hints.available') || 'Available'}:</span>
                                      <div className="font-bold text-green-800 dark:text-green-200">{teamScore.availableScore} pts</div>
                                    </div>
                                    <div>
                                      <span className="text-orange-600 dark:text-orange-400 font-medium">{t('hints.spent') || 'Spent'}:</span>
                                      <div className="font-bold text-orange-800 dark:text-orange-200">{teamScore.spentOnHints} pts</div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="p-4 rounded-lg border bg-card">
                                <h3 className="font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
                                  <Star className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                  {t('available_hints') || 'Available Hints'} ({selectedChallenge.hints.length})
                                </h3>
                                <div className="space-y-3">
                                  {selectedChallenge.hints.map((hint, index) => (
                                    <div 
                                      key={hint.id} 
                                      className={`p-4 rounded-lg border transition-colors duration-200 ${
                                        hint.purchased 
                                          ? 'bg-background/50 border-green-300 dark:border-green-700' 
                                          : 'bg-background/30 hover:bg-background/50 border-border'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between mb-3">
                                        <h4 className={`font-medium ${hint.purchased ? 'text-green-800 dark:text-green-200' : 'text-foreground'}`}>
                                          {hint.title || `${t('hint') || 'Hint'} ${index + 1}`}
                                        </h4>
                                        <div className="flex items-center gap-2">
                                          <div className={`text-sm px-2 py-1 rounded border font-medium ${
                                            hint.purchased 
                                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600'
                                              : 'bg-background text-muted-foreground'
                                          }`}>
                                            {hint.cost} {t('points') || 'points'}
                                          </div>
                                          {hint.purchased && (
                                            <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-600">
                                              ✓ {t('hints.purchased') || 'Purchased'}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {hint.purchased ? (
                                        <div className="text-sm leading-relaxed p-3 rounded border bg-background/30 text-foreground border-green-200 dark:border-green-700">
                                          {hint.content}
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          <div className="text-sm text-muted-foreground leading-relaxed italic">
                                            {t('hints.hint_locked') || 'This hint is locked. Buy it to reveal its content.'}
                                          </div>
                                          <Button
                                            onClick={async () => {
                                              // Admin test mode - allow even with insufficient points
                                              const canPurchase = teamScore?.testMode || 
                                                (teamScore?.availableScore !== undefined && teamScore.availableScore >= hint.cost);
                                              if (!canPurchase && !teamScore?.testMode) return;
                                              
                                              try {
                                                const result = await purchaseHint(hint.id);
                                                if (result.success && selectedChallenge) {
                                                  // Mettre à jour l'état local immédiatement pour un feedback instantané
                                                  const updatedHints = selectedChallenge.hints?.map(h => 
                                                    h.id === hint.id ? { 
                                                      ...h, 
                                                      purchased: true,
                                                      // Always update content from response if available
                                                      content: result.hint?.content || h.content
                                                    } : h
                                                  ) || [];
                                                  
                                                  setSelectedChallenge({
                                                    ...selectedChallenge,
                                                    hints: updatedHints
                                                  });
                                                  
                                                  // WebSocket will handle real-time updates for team members
                                                  // No need to refresh from server as local state is already updated
                                                }
                                              } catch (error) {
                                                console.error('Error purchasing hint:', error);
                                              }
                                            }}
                                            disabled={hintsLoading || (!teamScore?.testMode && teamScore?.availableScore !== undefined && teamScore.availableScore < hint.cost)}
                                            size="sm"
                                            className={`w-full ${
                                              !teamScore?.testMode && teamScore?.availableScore !== undefined && teamScore.availableScore < hint.cost
                                                ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed'
                                                : 'bg-blue-600 hover:bg-blue-700'
                                            }`}
                                          >
                                            {hintsLoading ? (
                                              <>
                                                <Settings className="w-4 h-4 mr-2 animate-spin" />
                                                {t('hints.purchasing') || 'Purchasing...'}
                                              </>
                                            ) : teamScore?.testMode ? (
                                              t('hints.reveal_hint') || 'Reveal hint (Admin)'
                                            ) : (
                                              teamScore?.availableScore !== undefined && teamScore.availableScore < hint.cost
                                                ? t('hints.insufficient_points', { cost: hint.cost }) || `Insufficient points (${hint.cost} required)`
                                                : t('hints.buy_for_points', { cost: hint.cost }) || `Buy for ${hint.cost} points`
                                            )}
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      )}
                      
                      <TabsContent value="solves" className="absolute inset-0 overflow-y-auto mt-0 pt-2 pr-2 z-[1100]">
                        <div className="min-h-full">
                          {solvesLoading ? (
                            <div className="text-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 dark:border-cyan-400 mx-auto mb-2"></div>
                              <p className="text-muted-foreground">{t('loading') || 'Loading...'}</p>
                            </div>
                          ) : !solves || solves.length === 0 ? (
                            <div className="text-center py-8">
                              <Trophy className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                              <p className="text-lg font-medium text-foreground mb-2">{t('no_solves_yet')}</p>
                              <p className="text-sm text-muted-foreground">{t('be_the_first')}</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-foreground">
                                  {t('solves')} ({solves?.length || 0})
                                </h3>
                                {selectedChallenge?.enableFirstBlood && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <div className="w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center">
                                      <svg viewBox="0 0 24 24" fill="white" className="w-1.5 h-1.5">
                                        <path d="M12 2L13.09 8.26L20 9L14 14.74L15.18 22L12 19.5L8.82 22L10 14.74L4 9L10.91 8.26L12 2Z"/>
                                      </svg>
                                    </div>
                                    <span>{t('firstblood_bonus') || 'FirstBlood bonus'}</span>
                                  </div>
                                )}
                              </div>
                              {solves?.map((solve, index) => (
                                <div 
                                  key={`${solve.teamId}-${solve.challengeId}`} 
                                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors duration-200"
                                >
                                  <div className="flex items-center space-x-3">
                                    <div className="relative">
                                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white font-bold text-sm shadow-sm">
                                        {index < 3 ? (
                                          <span className="text-lg">
                                            {index === 0 && '🥇'}
                                            {index === 1 && '🥈'}
                                            {index === 2 && '🥉'}
                                          </span>
                                        ) : (
                                          index + 1
                                        )}
                                      </div>
                                      {solve.firstBlood && solve.firstBlood.bonuses.length > 0 && (
                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                          <svg viewBox="0 0 24 24" fill="white" className="w-2.5 h-2.5">
                                            <path d="M12 2L13.09 8.26L20 9L14 14.74L15.18 22L12 19.5L8.82 22L10 14.74L4 9L10.91 8.26L12 2Z"/>
                                          </svg>
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <span className="font-semibold text-foreground">{solve.team?.name || 'Unknown Team'}</span>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {solve.username && (
                                          <>
                                            {t('solved_by')} <Link href={`/users/${encodeURIComponent(solve.username)}`} className="font-medium text-foreground/80 hover:text-primary hover:underline transition-colors">{solve.username}</Link>
                                            {' '}
                                          </>
                                        )}
                                        {t('on')} {formatDate(solve.createdAt)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-bold dark:text-cyan-400">
                                      {solve.firstBlood && solve.firstBlood.bonuses.length > 0 ? (
                                        <div className="space-y-1">
                                          <div className="flex items-center justify-end gap-1">
                                            <span>+{solve.currentPoints} pts</span>
                                            <span className="text-xs text-muted-foreground">(current)</span>
                                          </div>
                                          <div className="flex items-center justify-end gap-1">
                                            <div className="w-4 h-4 text-yellow-500">
                                              <svg viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 2L13.09 8.26L20 9L14 14.74L15.18 22L12 19.5L8.82 22L10 14.74L4 9L10.91 8.26L12 2Z"/>
                                              </svg>
                                            </div>
                                            <span className="text-yellow-600 dark:text-yellow-400">
                                              +{solve.firstBlood.bonuses.reduce((sum, bonus) => sum + bonus, 0)} pts
                                            </span>
                                            <span className="text-xs text-yellow-600 dark:text-yellow-400">(firstblood)</span>
                                          </div>
                                          <div className="text-xs font-normal text-muted-foreground border-t pt-1">
                                            Total: +{solve.currentPoints + solve.firstBlood.bonuses.reduce((sum, bonus) => sum + bonus, 0)} pts (now)
                                          </div>
                                          <div className="text-xs font-normal text-muted-foreground italic">
                                            Earned: {solve.points} pts (at solve time)
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <span>+{solve.currentPoints} pts</span>
                                          {solve.points !== solve.currentPoints && (
                                            <div className="text-xs font-normal text-muted-foreground italic">
                                              Earned: {solve.points} pts (at solve time)
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {formatDate(solve.createdAt)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      {selectedChallenge && isDockerChallenge(selectedChallenge) && (
                        <TabsContent value="instance" className="absolute inset-0 overflow-y-auto mt-0 pt-2 pr-2 z-[1100]">
                          <div className="min-h-full">
                            <div className="space-y-4">
                              <div className="p-4 rounded-lg border bg-card">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground">{t('instance_status')}:</span>
                                    <div className="flex items-center gap-2">
                                      {getLocalInstanceStatus(selectedChallenge.id) === 'running' && (
                                        <>
                                          <Play className="w-4 h-4 text-green-600" />
                                          <span className="text-sm font-medium text-green-600">{t('running')}</span>
                                        </>
                                      )}
                                      {getLocalInstanceStatus(selectedChallenge.id) === 'building' && (
                                        <>
                                          <Settings className="w-4 h-4 text-orange-600 animate-spin" />
                                          <span className="text-sm font-medium text-orange-600">{t('building')}</span>
                                        </>
                                      )}
                                      {getLocalInstanceStatus(selectedChallenge.id) === 'stopping' && (
                                        <>
                                          <Settings className="w-4 h-4 text-orange-600 animate-spin" />
                                          <span className="text-sm font-medium text-orange-600">{t('stopping')}</span>
                                        </>
                                      )}
                                      {getLocalInstanceStatus(selectedChallenge.id) === 'expired' && (
                                        <>
                                          <Square className="w-4 h-4 text-red-600" />
                                          <span className="text-sm font-medium text-red-600">{t('expired')}</span>
                                        </>
                                      )}
                                      {getLocalInstanceStatus(selectedChallenge.id) === 'stopped' && (
                                        <>
                                          <Square className="w-4 h-4 text-gray-600" />
                                          <span className="text-sm font-medium text-gray-600">{t('stopped')}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Connection Info Section */}
                                  {getLocalInstanceStatus(selectedChallenge.id) === 'running' && instanceOwner[selectedChallenge.id] && (
                                    <div className="text-sm text-muted-foreground">
                                      {t('instance_started_by_user', { username: instanceOwner[selectedChallenge.id]?.username || t('a_teammate') })}
                                    </div>
                                  )}
                                  {getLocalInstanceStatus(selectedChallenge.id) === 'running' && 
                                   connectionInfo[selectedChallenge.id] && 
                                   connectionInfo[selectedChallenge.id].length > 0 && (
                                     <ConnectionInfo 
                                       challengeId={selectedChallenge.id} 
                                       connectionInfo={connectionInfo[selectedChallenge.id]} 
                                     />
                                   )}
                                </div>
                              </div>
                              
                              <div className="flex gap-2">
                                {(getLocalInstanceStatus(selectedChallenge.id) === 'stopped' || 
                                 getLocalInstanceStatus(selectedChallenge.id) === 'expired') && (
                                  <Button
                                    onClick={() => handleStartInstance(selectedChallenge.id)}
                                    disabled={instanceLoading}
                                    className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                                  >
                                    {instanceLoading ? (
                                      <>
                                        <Settings className="w-4 h-4 mr-2 animate-spin" />
                                        {t('starting')}
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-4 h-4 mr-2" />
                                        {t('start_instance')}
                                      </>
                                    )}
                                  </Button>
                                )}
                                
                                {getLocalInstanceStatus(selectedChallenge.id) === 'running' && (
                                  <Button
                                    onClick={() => handleStopInstance(selectedChallenge.id)}
                                    disabled={instanceLoading}
                                    variant="destructive"
                                  >
                                    {instanceLoading ? (
                                      <>
                                        <Settings className="w-4 h-4 mr-2 animate-spin" />
                                        {t('stopping')}
                                      </>
                                    ) : (
                                      <>
                                        <Square className="w-4 h-4 mr-2" />
                                        {t('stop_instance')}
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      )}
                    </div>
                  </Tabs>
                </div>

                {/* Submission UI is now shown inside the Description tab content above */}
              </DialogContent>
            </Dialog>
          </main>
        </>
      );
    };

export default CategoryContent;