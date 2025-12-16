import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { CTFStatus } from "@/hooks/use-ctf-status";
import { Challenge, Solve } from "@/models/Challenge";
import axios from "@/lib/axios";
import Head from "next/head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useInstances } from "@/hooks/use-instances";
import { useHints } from "@/hooks/use-hints";
import { debugError, debugLog } from "@/lib/debug";
import type { User } from "@/models/User";
import { useChallengeFilters } from "@/hooks/useChallengeFilters";
import { useChallengeWebSocket } from "@/hooks/useChallengeWebSocket";
import { useChallengeActions } from "@/hooks/useChallengeActions";

const ChallengeDetailModal = lazy(() => import('./ChallengeDetailModal'));
import ChallengeTable from './ChallengeTable';
import MostSolvedSection from './MostSolvedSection';
import { ChallengeFilterBar } from './ChallengeFilterBar';

interface CategoryContentProps {
  cat: string;
  challenges: Challenge[];
  onChallengeUpdate?: () => void;
  ctfStatus: CTFStatus;
  ctfLoading: boolean;
  initialCategory?: string;
  loading?: boolean;
}

const CategoryContent = ({ cat, challenges = [], onChallengeUpdate, ctfStatus, ctfLoading, initialCategory, loading: externalLoading }: CategoryContentProps) => {
  const { t } = useLanguage();
  const { getSiteName } = useSiteConfig();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [instanceDetails, setInstanceDetails] = useState<{[key: number]: any}>({});
  
  // Instance management hooks
  const { loading: instanceLoading, startInstance, stopInstance, killInstance, getInstanceStatus: fetchInstanceStatus } = useInstances();
  const { teamScore, loading: hintsLoading, purchaseHint, refreshTeamScore } = useHints();
  
  // NEW: Use extracted hooks for filters, actions, and WebSocket
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
  
  // Fetch instance status for all Docker challenges when challenges are loaded
  const [statusFetched, setStatusFetched] = useState(false);
  
  useEffect(() => {
    if (!challenges || challenges.length === 0 || statusFetched) return;
    
    const fetchAllInstanceStatuses = async () => {
      const dockerChallenges = challenges.filter(challenge => isInstanceChallenge(challenge));
      
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

  // Listen to WebSocket instance updates via window events
  useEffect(() => {
    const handleInstanceUpdate = (e: any) => {
      const data = e?.detail || e?.data;
      if (!data || data.event !== 'instance_update') return;

      const challengeId = Number(data.challengeId);
      if (!challengeId) return;

      // Map status
      let newStatus: 'running' | 'stopped' | 'building' | 'expired' | 'stopping' = 'stopped';
      if (data.status === 'running') newStatus = 'running';
      else if (data.status === 'stopped') newStatus = 'stopped';
      else if (data.status === 'building') newStatus = 'building';
      
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
  }, [onChallengeUpdate]);

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



  useEffect(() => {
    let mounted = true;
    axios.get<User>("/api/me").then((res) => {
      if (mounted) setCurrentUser(res.data as User);
    }).catch(() => {});
    return () => { mounted = false };
  }, []);

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
            />

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
          </section>
        </div>

        <Suspense fallback={null}>
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
      </main>
    </>
  );
};

export default CategoryContent;
