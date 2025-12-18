// Classic Style - Matches main website theme with timeline graph and top 3 podium
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Head from 'next/head';
import { Trophy, Medal, Award, Users, User, TrendingUp, Settings, Zap, ZapOff, RefreshCw } from 'lucide-react';
import { IndividualLeaderboardEntry, TeamLeaderboardEntry } from '@/models/Leaderboard';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Line, LineChart, Scatter, ScatterChart, ZAxis } from 'recharts';

const REFRESH_INTERVAL = 10000;

export default function LiveClassic() {
  const [individualData, setIndividualData] = useState<IndividualLeaderboardEntry[]>([]);
  const [teamData, setTeamData] = useState<TeamLeaderboardEntry[]>([]);
  const [timelineData, setTimelineData] = useState<{ teams?: any[], users?: any[], timeline: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'individual' | 'team'>('team');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showControls, setShowControls] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [autoSwitch, setAutoSwitch] = useState(false);
  const [autoSwitchInterval, setAutoSwitchInterval] = useState(10);

  // Auto-switch between modes
  useEffect(() => {
    if (!autoSwitch) return;
    const interval = setInterval(() => {
      setMode(prev => prev === 'team' ? 'individual' : 'team');
    }, autoSwitchInterval * 1000);
    return () => clearInterval(interval);
  }, [autoSwitch, autoSwitchInterval]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const fetchData = async () => {
    try {
      const [teamsResponse, individualResponse, timelineResponse] = await Promise.all([
        axios.get('/api/teams/leaderboard'),
        axios.get('/api/users/leaderboard'),
        axios.get(mode === 'team' ? '/api/teams/timeline' : '/api/users/timeline')
      ]);
      
      const teamsData = teamsResponse.data || [];
      const individualDataRaw = individualResponse.data || [];
      const timeline = timelineResponse.data;
      
      const teams = teamsData.map((t: any, index: number) => ({
        rank: index + 1,
        id: t.team?.id || t.id,
        name: t.team?.name || t.name,
        points: t.totalScore || t.points || 0,
        solves: t.solveCount || t.solves || 0,
        memberCount: t.team?.users?.length || 0
      }));

      const users = individualDataRaw.map((entry: any, index: number) => ({
        rank: index + 1,
        id: entry.user?.id || entry.id,
        username: entry.user?.username || entry.username,
        points: entry.totalScore || entry.points || 0,
        solves: entry.solveCount || entry.solves || 0,
        teamId: entry.user?.teamId || entry.teamId,
        teamName: entry.teamName || ''
      }));

      setIndividualData(users);
      setTeamData(teams);
      
      if (timeline && (timeline.teams || timeline.users) && timeline.timeline) {
        setTimelineData(timeline);
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentData = mode === 'individual' ? individualData : teamData;
  const top3 = currentData.slice(0, 3);

  return (
    <>
      <Head>
        <title>Live Scoreboard - Classic</title>
      </Head>
      <div className="h-screen bg-muted text-foreground p-4 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 dark:border-cyan-400"></div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col px-4 min-h-0">
            {/* Timeline Graph - Full height */}
            <div className="bg-card rounded-lg border border-border p-4 flex-1 min-h-0 flex flex-col relative">
              {/* Controls */}
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={() => setShowControls(!showControls)}
                  className={`p-2 rounded-lg transition-all ${
                    showControls 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                  title="Controls"
                >
                  <Settings className="h-4 w-4" />
                </button>
                
                {showControls && (
                  <div className="absolute top-full right-0 mt-2 bg-card border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
                    <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Controls</div>
                      
                      {/* Mode Toggle */}
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground mb-1">Scoreboard Mode</div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setMode('individual')}
                            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                              mode === 'individual'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            <User className="inline h-3 w-3 mr-1" />
                            Individual
                          </button>
                          <button
                            onClick={() => setMode('team')}
                            className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                              mode === 'team'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            <Users className="inline h-3 w-3 mr-1" />
                            Teams
                          </button>
                        </div>
                      </div>
                      
                      {/* Animation Toggle */}
                      <div className="mb-3">
                        <div className="text-xs text-muted-foreground mb-1">Graph Transitions</div>
                        <button
                          onClick={() => setAnimationsEnabled(!animationsEnabled)}
                          className={`w-full px-2 py-1 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                            animationsEnabled
                              ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {animationsEnabled ? (
                            <>
                              <Zap className="h-3 w-3" />
                              Smooth (Enabled)
                            </>
                          ) : (
                            <>
                              <ZapOff className="h-3 w-3" />
                              Instant (Disabled)
                            </>
                          )}
                        </button>
                      </div>
                      
                      {/* Auto-Switch Toggle */}
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Auto-Switch Mode</div>
                        <button
                          onClick={() => setAutoSwitch(!autoSwitch)}
                          className={`w-full px-2 py-1 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                            autoSwitch
                              ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          <RefreshCw className={`h-3 w-3 ${autoSwitch ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                          {autoSwitch ? 'Auto-Switch ON' : 'Auto-Switch OFF'}
                        </button>
                        {autoSwitch && (
                          <div className="mt-2">
                            <div className="text-xs text-muted-foreground mb-1">Interval (seconds)</div>
                            <input
                              type="number"
                              min="5"
                              max="120"
                              value={autoSwitchInterval}
                              onChange={(e) => setAutoSwitchInterval(Math.max(5, Math.min(120, parseInt(e.target.value) || 10)))}
                              className="w-full px-2 py-1 rounded text-xs bg-muted border border-border text-foreground"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  <h2 className="text-xl font-semibold">Score Progression</h2>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                    {mode === 'team' ? 'Teams' : 'Individual'}
                  </span>
                </div>
              </div>
              {!timelineData || timelineData.timeline.length === 0 ? (
                <div className="flex items-center justify-center flex-1 text-muted-foreground">
                  No data available yet
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData.timeline.map(point => ({
                        time: point.time,
                        ...point.scores
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis 
                          dataKey="time" 
                          stroke="currentColor"
                          className="text-xs"
                        />
                        <YAxis 
                          stroke="currentColor"
                          className="text-xs"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '0.5rem',
                            color: 'hsl(var(--popover-foreground))'
                          }}
                        />
                        {(timelineData.teams || timelineData.users || []).slice(0, 10).map((entity: any, index: number) => {
                          const entityName = entity.name || entity.username;
                          return (
                            <Line
                              key={entity.id}
                              type="monotone"
                              dataKey={entityName}
                              stroke={entity.color}
                              strokeWidth={2}
                              isAnimationActive={animationsEnabled}
                              animationDuration={animationsEnabled ? 300 : 0}
                              dot={(props: any) => {
                                const { cx, cy, payload, index } = props;
                                if (index === 0) return <circle cx={cx} cy={cy} r={4} fill={entity.color} />;
                                const prevPoint = timelineData.timeline[index - 1];
                                const currentScore = payload[entityName];
                                const prevScore = prevPoint?.scores?.[entityName] || 0;
                                if (currentScore > prevScore) {
                                  return <circle cx={cx} cy={cy} r={4} fill={entity.color} />;
                                }
                                return <></>;
                              }}
                              activeDot={{ r: 6 }}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legend with team names and colors */}
                  <div className="flex flex-wrap justify-center gap-2 mt-3 pt-3 border-t border-border flex-shrink-0">
                    {(timelineData.teams || timelineData.users || []).slice(0, 10).map((entity: any) => {
                      const entityName = entity.name || entity.username;
                      return (
                        <div key={entity.id} className="flex items-center gap-1.5">
                          <div 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: entity.color }}
                          />
                          <span className="text-xs font-medium truncate">
                            {entityName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
