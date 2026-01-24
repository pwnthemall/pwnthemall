import { useState } from "react";
import { Challenge, Solve } from "@/models/Challenge";
import { BadgeCheck, Trophy, Play, Square, Settings, Clock, Star, Lock } from "lucide-react";
import ConnectionInfo from "@/components/common/ConnectionInfo";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GeoPicker from "./GeoPicker";
import ChallengeImage from "@/components/challenge/ChallengeImage";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDate } from "./category-helpers";
import { ChallengeFiles } from "@/components/challenge/ChallengeFiles";
import { CTFStatus } from "@/hooks/use-ctf-status";

interface ChallengeDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  
  // Challenge actions
  flag: string;
  setFlag: (flag: string) => void;
  geoCoords: {lat: number; lng: number} | null;
  setGeoCoords: (coords: {lat: number; lng: number} | null) => void;
  handleSubmit: () => Promise<void>;
  loading: boolean;
  
  // Solves
  solves: Solve[];
  solvesLoading: boolean;
  
  // Hints
  teamScore: any;
  hintsLoading: boolean;
  purchaseHint: (hintId: number) => Promise<any>;
  setSelectedChallenge: (challenge: Challenge) => void;
  
  // Instance
  instanceStatus: Record<number, 'running' | 'stopped' | 'building' | 'expired' | 'stopping'>;
  connectionInfo: Record<number, any[]>;
  instanceOwner: Record<number, { userId: number; username?: string }>;
  instanceLoading: boolean;
  handleStartInstance: (challengeId: number) => Promise<void>;
  handleStopInstance: (challengeId: number) => Promise<void>;
  isInstanceChallenge: (challenge: Challenge) => boolean;
  getLocalInstanceStatus: (challengeId: number) => 'running' | 'stopped' | 'building' | 'expired' | 'stopping';
  
  // CTF Status
  ctfStatus: CTFStatus;
  ctfLoading: boolean;
  
  // Translation
  t: (key: string, params?: any) => string;
}

const ChallengeDetailModal = ({
  open,
  onOpenChange,
  challenge,
  activeTab,
  onTabChange,
  flag,
  setFlag,
  geoCoords,
  setGeoCoords,
  handleSubmit,
  loading,
  solves,
  solvesLoading,
  teamScore,
  hintsLoading,
  purchaseHint,
  setSelectedChallenge,
  instanceStatus,
  connectionInfo,
  instanceOwner,
  instanceLoading,
  handleStartInstance,
  handleStopInstance,
  isInstanceChallenge,
  getLocalInstanceStatus,
  ctfStatus,
  ctfLoading,
  t,
}: ChallengeDetailModalProps) => {
  if (!challenge) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className={`${
            challenge?.solved 
              ? 'text-green-600 dark:text-green-300' 
              : 'dark:text-cyan-300'
          }`}>
            {challenge?.name || 'Unnamed Challenge'}
            {challenge?.solved && (
              <BadgeCheck className="inline-block w-6 h-6 ml-2 text-green-600 dark:text-green-400" />
            )}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t('difficulty')}: {challenge?.challengeDifficulty?.name || 'Unknown'} - {t('author')}: {challenge?.author || 'Unknown'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-full flex-1 flex flex-col">
            <TabsList className={`grid w-full mb-4 flex-shrink-0 bg-card border rounded-lg p-1 relative z-[1200] ${
              challenge && isInstanceChallenge(challenge) 
                ? (challenge.hints && challenge.hints.length > 0 ? 'grid-cols-4' : 'grid-cols-3')
                : (challenge?.hints && challenge.hints.length > 0 ? 'grid-cols-3' : 'grid-cols-2')
            }`}>
              <TabsTrigger value="description">{t('description')}</TabsTrigger>
              {challenge?.hints && challenge.hints.length > 0 && (
                <TabsTrigger value="hints">{t('hints') || 'Hints'}</TabsTrigger>
              )}
              <TabsTrigger value="solves">{t('solves')}</TabsTrigger>
              {challenge && isInstanceChallenge(challenge) && (
                <TabsTrigger value="instance">{t('instance.docker_instance')}</TabsTrigger>
              )}
            </TabsList>
                
            <div className="flex-1 min-h-0 relative overflow-hidden z-[1100] min-h-[30vh]">
              {/* Description Tab */}
              <TabsContent value="description" className="absolute inset-0 overflow-y-auto mt-0 pt-2 pr-2 z-[1100]">
                <div className="text-left text-foreground leading-relaxed min-h-full">
                  {challenge?.files && challenge.files.length > 0 && (
                    <ChallengeFiles 
                      challengeId={challenge.id} 
                      files={challenge.files} 
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
                    {challenge?.description || 'No description available'}
                  </ReactMarkdown>

                  {challenge?.solved ? (
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
                      {challenge?.challengeType?.name?.toLowerCase() === 'geo' ? (
                        <div className="w-full" style={{ height: '40vh', maxHeight: 420 }}>
                          <GeoPicker value={geoCoords} onChange={setGeoCoords} height={'100%'} radiusKm={challenge?.geoRadiusKm ?? null} />
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
                          (challenge?.challengeType?.name?.toLowerCase() === 'geo' ? !geoCoords : !flag.trim()) ||
                          !!(challenge?.maxAttempts && challenge.maxAttempts > 0 && (challenge.teamFailedAttempts || 0) >= challenge.maxAttempts)
                        }
                        // className="bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600"
                      >
                        {loading ? t('submitting') : t('submit')}
                      </Button>
                      {challenge?.maxAttempts != null && challenge.maxAttempts > 0 ? (
                        <div className="text-center -mt-2">
                          <span className="text-xs text-muted-foreground opacity-70">
                            {t('attempts_left')}: {challenge.maxAttempts - (challenge.teamFailedAttempts || 0)}/{challenge.maxAttempts}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Hints Tab */}
              {challenge?.hints && challenge.hints.length > 0 && (
                <TabsContent value="hints" className="absolute inset-0 overflow-y-auto mt-0 pt-2 pr-2 z-[1100]">
                  <div className="min-h-full">
                    <div className="space-y-4">
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
                          {t('available_hints') || 'Available Hints'} ({challenge.hints.length})
                        </h3>
                        <div className="space-y-3">
                          {challenge.hints.map((hint, index) => (
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
                                      const canPurchase = teamScore?.testMode || 
                                        (teamScore?.availableScore !== undefined && teamScore.availableScore >= hint.cost);
                                      if (!canPurchase && !teamScore?.testMode) return;
                                      
                                      try {
                                        const result = await purchaseHint(hint.id);
                                        if (result.success && challenge) {
                                          const updatedHints = challenge.hints?.map(h => 
                                            h.id === hint.id ? { 
                                              ...h, 
                                              purchased: true,
                                              content: result.hint?.content || h.content
                                            } : h
                                          ) || [];
                                          
                                          setSelectedChallenge({
                                            ...challenge,
                                            hints: updatedHints
                                          });
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
              
              {/* Solves Tab */}
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
                        {challenge?.enableFirstBlood && (
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
                                      +{solve.firstBlood.bonuses.reduce((sum: number, bonus: number) => sum + bonus, 0)} pts
                                    </span>
                                    <span className="text-xs text-yellow-600 dark:text-yellow-400">(firstblood)</span>
                                  </div>
                                  <div className="text-xs font-normal text-muted-foreground border-t pt-1">
                                    Total: +{solve.currentPoints + solve.firstBlood.bonuses.reduce((sum: number, bonus: number) => sum + bonus, 0)} pts (now)
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

              {/* Instance Tab */}
              {challenge && isInstanceChallenge(challenge) && (
                <TabsContent value="instance" className="absolute inset-0 overflow-y-auto mt-0 pt-2 pr-2 z-[1100]">
                  <div className="min-h-full">
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg border bg-card">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{t('instance.instance_status')}:</span>
                            <div className="flex items-center gap-2">
                              {getLocalInstanceStatus(challenge.id) === 'running' && (
                                <>
                                  <Play className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-medium text-green-600">{t('instance_actions.running')}</span>
                                </>
                              )}
                              {getLocalInstanceStatus(challenge.id) === 'building' && (
                                <>
                                  <Settings className="w-4 h-4 text-orange-600 animate-spin" />
                                  <span className="text-sm font-medium text-orange-600">{t('instance_actions.building')}</span>
                                </>
                              )}
                              {getLocalInstanceStatus(challenge.id) === 'stopping' && (
                                <>
                                  <Settings className="w-4 h-4 text-orange-600 animate-spin" />
                                  <span className="text-sm font-medium text-orange-600">{t('instance_actions.stopping')}</span>
                                </>
                              )}
                              {getLocalInstanceStatus(challenge.id) === 'expired' && (
                                <>
                                  <Square className="w-4 h-4 text-red-600" />
                                  <span className="text-sm font-medium text-red-600">{t('instance_actions.expired')}</span>
                                </>
                              )}
                              {getLocalInstanceStatus(challenge.id) === 'stopped' && (
                                <>
                                  <Square className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm font-medium text-gray-600">{t('instance_actions.stopped')}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {getLocalInstanceStatus(challenge.id) === 'running' && instanceOwner[challenge.id] && (
                            <div className="text-sm text-muted-foreground">
                              {t('instance_actions.instance_started_by_user', { username: instanceOwner[challenge.id]?.username || t('instance_actions.a_teammate') })}
                            </div>
                          )}
                          {getLocalInstanceStatus(challenge.id) === 'running' && 
                           connectionInfo[challenge.id] && 
                           connectionInfo[challenge.id].length > 0 && (
                             <ConnectionInfo 
                               challengeId={challenge.id} 
                               connectionInfo={connectionInfo[challenge.id]} 
                             />
                           )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {(getLocalInstanceStatus(challenge.id) === 'stopped' || 
                         getLocalInstanceStatus(challenge.id) === 'expired') && (
                          <Button
                            onClick={() => handleStartInstance(challenge.id)}
                            disabled={instanceLoading}
                            className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                          >
                            {instanceLoading ? (
                              <>
                                <Settings className="w-4 h-4 mr-2 animate-spin" />
                                {t('instance_actions.starting')}
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                {t('instance_actions.start_instance')}
                              </>
                            )}
                          </Button>
                        )}
                        
                        {getLocalInstanceStatus(challenge.id) === 'running' && (
                          <Button
                            onClick={() => handleStopInstance(challenge.id)}
                            disabled={instanceLoading}
                            variant="destructive"
                          >
                            {instanceLoading ? (
                              <>
                                <Settings className="w-4 h-4 mr-2 animate-spin" />
                                {t('instance_actions.stopping')}
                              </>
                            ) : (
                              <>
                                <Square className="w-4 h-4 mr-2" />
                                {t('instance_actions.stop_instance')}
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
      </DialogContent>
    </Dialog>
  );
};

export default ChallengeDetailModal;
