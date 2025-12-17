import { useState, useEffect, lazy, Suspense } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { CTFStatus } from "@/hooks/use-ctf-status";
import { Challenge, Solve } from "@/models/Challenge";
import axios from "@/lib/axios";
import Head from "next/head";
import { Skeleton } from "@/components/ui/skeleton";
import { useInstances } from "@/hooks/use-instances";
import { useHints } from "@/hooks/use-hints";
import { debugError, debugLog } from "@/lib/debug";
import { toast } from "sonner";
import type { User } from "@/models/User";
import { useChallengeFilters } from "@/hooks/useChallengeFilters";
import { useChallengeWebSocket } from "@/hooks/useChallengeWebSocket";
import { useChallengeActions } from "@/hooks/useChallengeActions";

const ChallengeDetailModal = lazy(() => import('./ChallengeDetailModal'));
import ChallengeTable from './ChallengeTable';
import ChallengeGrid from './ChallengeGrid';
import MostSolvedSection from './MostSolvedSection';
import { ChallengeFilterBar } from './ChallengeFilterBar';
import { AnimatedSeparator } from '@/components/ui/animated-separator';

interface CategoryContentProps {
  cat: string;
  challenges: Challenge[];
  onChallengeUpdate?: () => void;
  ctfStatus: CTFStatus;
  ctfLoading: boolean;
  initialCategory?: string;
  loading?: boolean;
}

/**
 * Validates WebSocket instance update events to prevent malicious event injection
 * @param event - The event object to validate
 * @returns true if event is valid, false otherwise
 */
const validateInstanceUpdate = (event: any): boolean => {
  if (!event?.detail) return false;
  const { challengeId, status, event: eventType } = event.detail;
  
  // Validate event type
  if (eventType !== 'instance_update') return false;
  
  // Validate required fields
  if (!challengeId || !status) return false;
  
  // Validate types
  if (typeof challengeId !== 'number' && typeof challengeId !== 'string') return false;
  if (!['running', 'stopped', 'building', 'expired', 'stopping'].includes(status)) return false;
  
  return true;
};

const CategoryContent = ({ cat, challenges = [], onChallengeUpdate, ctfStatus, ctfLoading, initialCategory, loading: externalLoading }: CategoryContentProps) => {
  const { t } = useLanguage();
  const { getSiteName } = useSiteConfig();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Load view mode from localStorage with 'table' as default
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('challengeViewMode');
      return (saved as 'table' | 'grid') || 'table';
    }
    return 'table';
  });
  
  // Save view mode to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('challengeViewMode', viewMode);
    }
  }, [viewMode]);
  
  // Instance management hooks
  const { loading: instanceLoading, startInstance, stopInstance, getInstanceStatus: fetchInstanceStatus } = useInstances();
  const { teamScore, loading: hintsLoading, purchaseHint, refreshTeamScore } = useHints();
  
  // Challenge filters hook
  const {
    query,
    categoryFilter,
    solveFilter,
    sortBy,
    sortOrder,
    setQuery,
    setCategoryFilter,
    setSolveFilter,
    handleSort,
    filteredChallenges,
    categories,
  } = useChallengeFilters({ challenges, initialCategory });
  
  const {
    selectedChallenge,
    flag,
    geoCoords,
    loading,
    solves,
    solvesLoading,
    open,
    activeTab,
    instanceStatus,
    connectionInfo,
    instanceOwner,
    setSelectedChallenge,
    setFlag,
    setGeoCoords,
    setOpen,
    setActiveTab,
    setInstanceStatus,
    setConnectionInfo,
    setInstanceOwner,
    handleChallengeSelect,
    handleSubmit,
    handleStartInstance,
    handleStopInstance,
    fetchSolves,
    isInstanceChallenge,
    getLocalInstanceStatus,
  } = useChallengeActions({
    currentUser,
    onChallengeUpdate,
    stopInstance,
    startInstance,
    fetchInstanceStatus,
    refreshTeamScore,
    t,
  });
  
  const [statusFetched, setStatusFetched] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    axios.get<User>("/api/me").then((res) => {
      if (mounted) setCurrentUser(res.data as User);
    }).catch(() => {});
    return () => { mounted = false };
  }, []);

  useEffect(() => {
    if (!challenges || challenges.length === 0 || statusFetched) return;
    
    const fetchAllInstanceStatuses = async () => {
      const dockerChallenges = challenges.filter(challenge => isInstanceChallenge(challenge));
      
      await Promise.all(
        dockerChallenges.map(async (challenge) => {
          try {
            const status = await fetchInstanceStatus(challenge.id.toString());
            if (status) {
              let localStatus: 'running' | 'stopped' | 'building' | 'expired' = 'stopped';
              if (status.status === 'running') {
                localStatus = 'running';
              } else if (status.status === 'building') {
                localStatus = 'building';
              } else if (status.status === 'expired') {
                localStatus = 'expired';
              }
              
              setInstanceStatus(prev => ({
                ...prev,
                [challenge.id]: localStatus
              }));

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
        })
      );
      
      setStatusFetched(true);
    };

    fetchAllInstanceStatuses();
  }, [challenges.map(c => c.id).join(','), statusFetched, fetchInstanceStatus, isInstanceChallenge, setInstanceStatus, setConnectionInfo]);

  // Reset status fetched flag when challenges change
  useEffect(() => {
    setStatusFetched(false);
  }, [challenges.map(c => c.id).join(',')]);

  // Listen to WebSocket instance updates via window events
  useEffect(() => {
    const handleInstanceUpdate = (e: any) => {
      if (!validateInstanceUpdate(e)) {
        debugError('[Security] Invalid instance update event received:', e);
        return;
      }

      const data = e.detail;
      const challengeId = Number(data.challengeId);

      // Map status
      let newStatus: 'running' | 'stopped' | 'building' | 'expired' | 'stopping' = 'stopped';
      if (data.status === 'running') newStatus = 'running';
      else if (data.status === 'stopped') newStatus = 'stopped';
      else if (data.status === 'building') newStatus = 'building';
      else if (data.status === 'stopping') newStatus = 'stopping';
      else if (data.status === 'expired') newStatus = 'expired';
      
      debugLog('[CategoryContent] Instance update received:', { challengeId, status: data.status, newStatus });
      setInstanceStatus(prev => ({ ...prev, [challengeId]: newStatus }));
      
      // Update connection info
      if (newStatus === 'running' && data.connectionInfo) {
        const connInfo = Array.isArray(data.connectionInfo) ? data.connectionInfo : [];
        setConnectionInfo(prev => ({ ...prev, [challengeId]: connInfo }));
      } else if (newStatus === 'stopped' || newStatus === 'building') {
        setConnectionInfo(prev => ({ ...prev, [challengeId]: [] }));
      }

      // Update instance owner info
      if (data.userId && data.username) {
        setInstanceOwner(prev => ({
          ...prev,
          [challengeId]: { userId: Number(data.userId), username: data.username }
        }));
      }

      // If team solved, refresh challenges
      if (onChallengeUpdate && data.status === 'stopped') {
        debugLog('[CategoryContent] Instance stopped, refreshing challenges');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('instance-update', handleInstanceUpdate as EventListener);
      return () => window.removeEventListener('instance-update', handleInstanceUpdate as EventListener);
    }
  }, [onChallengeUpdate, setInstanceStatus, setConnectionInfo, setInstanceOwner]);

  useChallengeWebSocket({
    socket: null, // Using window events instead of socket.io in this codebase
    selectedChallengeId: selectedChallenge?.id || null,
    currentTeamId: currentUser?.teamId,
    onTeamSolve: (data) => {
      // Trigger challenge update
      if (onChallengeUpdate) onChallengeUpdate();
    },
    onHintPurchase: (data) => {
      // Update selected challenge hints
      if (selectedChallenge && selectedChallenge.id === data.challengeId) {
        const updatedHints = selectedChallenge.hints?.map((h: any) => 
          h.id === data.hintId 
            ? { ...h, purchased: true }
            : h
        ) || [];
        
        setSelectedChallenge({ ...selectedChallenge, hints: updatedHints });
      }
      
      // Refresh team score
      refreshTeamScore();
    },
    onInstanceUpdate: () => {}, // Handled by window event listener above
  });
  
  // Safety check for challenges
  if (!challenges || challenges.length === 0) {
    return (
      <>
        <Head>
          <title>{getSiteName()} - {cat}</title>
        </Head>
        <main className="flex flex-col items-center justify-center min-h-screen px-6 py-10 text-center">
          <h1 className="text-3xl font-bold mb-6">
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

      <main className="flex min-h-screen flex-col items-center justify-start px-4 py-10">
        <div className="w-full max-w-screen-2xl">
          {/* Page Header */}
          {externalLoading && challenges.length === 0 ? (
            <div className="mb-8 space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
          ) : (
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">{cat}</h1>
              <p className="text-sm text-muted-foreground">
                {t("browse_challenges") !== "browse_challenges" ? t("browse_challenges") : "Browse, search, and solve challenges"}
              </p>
            </div>
          )}

          <MostSolvedSection
            challenges={challenges}
            loading={!!externalLoading}
            onChallengeSelect={handleChallengeSelect}
            t={t}
          />

          <AnimatedSeparator />

          <section>
            <ChallengeFilterBar
              query={query}
              onQueryChange={setQuery}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              solveFilter={solveFilter}
              onSolveFilterChange={setSolveFilter}
              categories={categories}
              t={t}
              loading={!!externalLoading}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            {viewMode === 'table' ? (
              <ChallengeTable
                challenges={filteredChallenges}
                loading={externalLoading || challenges.length === 0}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                onChallengeSelect={handleChallengeSelect}
                instanceStatus={instanceStatus}
                isInstanceChallenge={isInstanceChallenge}
                t={t}
              />
            ) : (
              <ChallengeGrid
                challenges={filteredChallenges}
                loading={externalLoading || challenges.length === 0}
                onChallengeSelect={handleChallengeSelect}
                instanceStatus={instanceStatus}
                isInstanceChallenge={isInstanceChallenge}
                t={t}
              />
            )}
          </section>
        </div>

        <Suspense fallback={
          <div 
            role="status" 
            aria-live="polite" 
            className="flex items-center justify-center p-8"
          >
            <span className="sr-only">Loading challenge details...</span>
            <Skeleton className="h-96 w-full max-w-3xl" />
          </div>
        }>
          <ChallengeDetailModal
            open={open}
            onOpenChange={setOpen}
            challenge={selectedChallenge}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            flag={flag}
            setFlag={setFlag}
            geoCoords={geoCoords}
            setGeoCoords={setGeoCoords}
            handleSubmit={handleSubmit}
            loading={loading}
            solves={solves}
            solvesLoading={solvesLoading}
            teamScore={teamScore}
            hintsLoading={hintsLoading}
            purchaseHint={purchaseHint}
            setSelectedChallenge={setSelectedChallenge}
            instanceStatus={instanceStatus}
            connectionInfo={connectionInfo}
            instanceOwner={instanceOwner}
            instanceLoading={instanceLoading}
            handleStartInstance={handleStartInstance}
            handleStopInstance={handleStopInstance}
            isInstanceChallenge={isInstanceChallenge}
            getLocalInstanceStatus={getLocalInstanceStatus}
            ctfStatus={ctfStatus}
            ctfLoading={ctfLoading}
            t={t}
          />
        </Suspense>

        <div 
          role="status" 
          aria-live="polite" 
          aria-atomic="true" 
          className="sr-only"
        >
        </div>
      </main>
    </>
  );
};

export default CategoryContent;
