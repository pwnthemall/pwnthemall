import React, { useState, useEffect } from 'react';
import axios from '@/lib/axios';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Trophy, Medal, Award, Users, User, Search, ChevronLeft, ChevronRight, TrendingUp, ExternalLink, ChevronDown, Settings, Zap, ZapOff, RefreshCw, Download, FileText } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@/context/UserContext';
import { IndividualLeaderboardEntry, TeamLeaderboardEntry } from '@/models/Leaderboard';
import { cn } from '@/lib/utils';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, LineChart } from 'recharts';

export default function ScoreboardContent() {
  const { t } = useLanguage();
  const { user } = useUser();
  
  const [individualData, setIndividualData] = useState<IndividualLeaderboardEntry[]>([]);
  const [teamData, setTeamData] = useState<TeamLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('individual');
  const [individualPage, setIndividualPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);
  const [timelineData, setTimelineData] = useState<{ teams?: any[], users?: any[], timeline: any[] } | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [hiddenEntities, setHiddenEntities] = useState<Set<string>>(new Set());
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [autoSwitch, setAutoSwitch] = useState(false);
  const [autoSwitchInterval, setAutoSwitchInterval] = useState(10);
  const itemsPerPage = 25;

  // Toggle entity visibility in chart
  const toggleEntityVisibility = (entityName: string) => {
    setHiddenEntities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entityName)) {
        newSet.delete(entityName);
      } else {
        newSet.add(entityName);
      }
      return newSet;
    });
  };

  // Auto-switch between modes
  useEffect(() => {
    if (!autoSwitch) return;
    const interval = setInterval(() => {
      setActiveTab(prev => prev === 'team' ? 'individual' : 'team');
    }, autoSwitchInterval * 1000);
    return () => clearInterval(interval);
  }, [autoSwitch, autoSwitchInterval]);

  // Reset hidden entities when tab changes
  useEffect(() => {
    setHiddenEntities(new Set());
    setHoveredEntity(null);
  }, [activeTab]);

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  // Fetch timeline data when active tab changes
  useEffect(() => {
    fetchTimelineData(activeTab);
  }, [activeTab]);

  const fetchTimelineData = async (tab: string) => {
    setChartLoading(true);
    try {
      // Fetch appropriate timeline based on active tab
      const endpoint = tab === 'individual' ? '/api/users/timeline' : '/api/teams/timeline';
      const response = await axios.get(endpoint);
      const data = response.data;
      // Format: { teams/users: [...], timeline: [...] }
      if (data && (data.teams || data.users) && data.timeline) {
        setTimelineData(data);
      } else {
        setTimelineData(null);
      }
    } catch (error) {
      console.error('Failed to fetch timeline data:', error);
      setTimelineData(null);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchLeaderboards = async () => {
    setLoading(true);
    try {
      // Fetch both leaderboards in parallel
      const [teamsResponse, individualResponse] = await Promise.all([
        axios.get('/api/teams/leaderboard'),
        axios.get('/api/users/leaderboard')
      ]);
      
      const teamsData = teamsResponse.data || [];
      const individualData = individualResponse.data || [];
      
      // Map team leaderboard data
      const teams = teamsData.map((t: any, index: number) => ({
        rank: index + 1,
        id: t.team?.id || t.id,
        name: t.team?.name || t.name,
        points: t.totalScore || t.points || 0,
        solves: t.solveCount || t.solves || 0,
        memberCount: t.memberCount || t.team?.users?.length || 0
      }));

      // Map individual leaderboard data from the new API
      const users = individualData.map((entry: any, index: number) => ({
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
    } catch (error) {
      console.error('Failed to fetch leaderboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">1st</Badge>;
      case 2:
        return <Badge variant="default" className="bg-gray-400 hover:bg-gray-500">2nd</Badge>;
      case 3:
        return <Badge variant="default" className="bg-amber-600 hover:bg-amber-700">3rd</Badge>;
      default:
        return <span className="text-muted-foreground font-medium">{rank}</span>;
    }
  };

  const filteredIndividualData = individualData.filter(entry => {
    if (!searchTerm) return true;
    return (entry.username && entry.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
           (entry.teamName && entry.teamName.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const filteredTeamData = teamData.filter(entry =>
    !searchTerm || entry.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination calculations
  const totalIndividualPages = Math.ceil(filteredIndividualData.length / itemsPerPage);
  const totalTeamPages = Math.ceil(filteredTeamData.length / itemsPerPage);
  
  const paginatedIndividualData = filteredIndividualData.slice(
    (individualPage - 1) * itemsPerPage,
    individualPage * itemsPerPage
  );
  
  const paginatedTeamData = filteredTeamData.slice(
    (teamPage - 1) * itemsPerPage,
    teamPage * itemsPerPage
  );

  // Render compact numeric page buttons (with ellipsis) for pagination
  const renderPageButtons = (current: number, total: number, setPage: (n: number) => void) => {
    if (total < 1) return null;
    const maxButtons = 7;
    let start = Math.max(1, current - Math.floor(maxButtons / 2));
    let end = Math.min(total, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) start = Math.max(1, end - maxButtons + 1);

    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);

    return (
      <>
        {start > 1 && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setPage(1)}>1</Button>
            {start > 2 && <span className="px-2">…</span>}
          </>
        )}

        {pages.map(p => (
          <Button
            key={p}
            variant={p === current ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setPage(p)}
            className={p === current ? 'font-semibold' : ''}
          >
            {p}
          </Button>
        ))}

        {end < total && (
          <>
            {end < total - 1 && <span className="px-2">…</span>}
            <Button variant="ghost" size="sm" onClick={() => setPage(total)}>{total}</Button>
          </>
        )}
      </>
    );
  };

  // Reset pages when search changes or when switching tabs so users always start at page 1
  useEffect(() => {
    setIndividualPage(1);
    setTeamPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setIndividualPage(1);
    setTeamPage(1);
  }, [activeTab]);

  // Export leaderboard data to various formats (CSV implemented)
  const exportScoreboard = (format: 'csv' | string) => {
    try {
      const now = new Date();
      const ts = now.toISOString().replace(/[:.]/g, '-');
      const active = activeTab === 'individual' ? filteredIndividualData : filteredTeamData;

      if (format === 'csv') {
        let columns: string[] = [];
        let rows: any[] = [];

        if (activeTab === 'individual') {
          columns = ['rank', 'username', 'teamName', 'points', 'solves'];
          rows = active.map((r: any) => ({
            rank: r.rank,
            username: r.username || '',
            teamName: r.teamName || '',
            points: r.points ?? 0,
            solves: r.solves ?? 0,
          }));
        } else {
          columns = ['rank', 'name', 'memberCount', 'points', 'solves'];
          rows = active.map((r: any) => ({
            rank: r.rank,
            name: r.name || '',
            memberCount: r.memberCount ?? 0,
            points: r.points ?? 0,
            solves: r.solves ?? 0,
          }));
        }

        const escapeCell = (v: any) => {
          if (v === null || v === undefined) return '';
          const s = String(v);
          if (s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
          if (s.includes(',') || s.includes('\n')) return '"' + s + '"';
          return s;
        };

        const header = columns.join(',');
        const lines = rows.map(r => columns.map(c => escapeCell(r[c])).join(','));
        const csv = [header, ...lines].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const name = `scoreboard_${activeTab}_${ts}.csv`;
        a.setAttribute('download', name);
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else if (format === 'html') {
        try {
          // capture SVG chart if present
          const root = document.getElementById('scoreboard-root');
          const svgEl = root?.querySelector('svg');
          const svgHtml = svgEl ? svgEl.outerHTML : '';

          const title = activeTab === 'individual' ? 'Individual Scoreboard' : 'Team Scoreboard';

          const headerRow = activeTab === 'individual'
            ? '<th>Rank</th><th>Player</th><th>Team</th><th>Points</th><th>Solves</th>'
            : '<th>Rank</th><th>Team</th><th>Members</th><th>Points</th><th>Solves</th>';

          const rowsHtml = active.map((r: any) => {
            if (activeTab === 'individual') {
              return `<tr><td>${r.rank}</td><td>${r.username || ''}</td><td>${r.teamName || ''}</td><td>${r.points ?? 0}</td><td>${r.solves ?? 0}</td></tr>`;
            }
            return `<tr><td>${r.rank}</td><td>${r.name || ''}</td><td>${r.memberCount ?? 0}</td><td>${r.points ?? 0}</td><td>${r.solves ?? 0}</td></tr>`;
          }).join('');

          const htmlDoc = `<!doctype html><html><head><meta charset="utf-8"><title>${title} export</title><style>body{font-family:system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#f3f4f6;font-weight:600} .chart{max-width:100%}</style></head><body><h1>${title}</h1><p>Exported at ${now.toLocaleString()}</p>${svgHtml ? `<div class="chart">${svgHtml}</div>` : ''}<table><thead><tr>${headerRow}</tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;

          const blobHtml = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
          const urlHtml = URL.createObjectURL(blobHtml);
          const ah = document.createElement('a');
          ah.href = urlHtml;
          const nameh = `scoreboard_${activeTab}_${ts}.html`;
          ah.setAttribute('download', nameh);
          document.body.appendChild(ah);
          ah.click();
          ah.remove();
          URL.revokeObjectURL(urlHtml);
        } catch (e) {
          console.error('HTML export failed', e);
        }
      } else {
        // Future formats can be implemented here
        console.warn('Export format not supported:', format);
      }
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 dark:border-cyan-400 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div id="scoreboard-root" className="min-h-screen">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold">{t('scoreboard.scoreboard')}</h1>
            <p className="text-muted-foreground">
              {t('scoreboard.scoreboard_description')}
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {t('scoreboard.live_view')}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => window.open('/live/classic', '_blank')}>
                  {t('scoreboard.live_view')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Timeline Chart */}
        <Card className="relative">
          {/* Controls */}
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => setShowControls(!showControls)}
              className={`p-2 rounded-lg transition-all ${
                showControls 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
              title={t('scoreboard.controls')}
            >
              <Settings className="h-4 w-4" />
            </button>
            
            {showControls && (
              <div className="absolute top-full right-0 mt-2 bg-card border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
                <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  {t('scoreboard.controls')}
                </div>
                  
                {/* Mode Toggle */}
                <div className="mb-3">
                  <div className="text-xs text-muted-foreground mb-1">{t('scoreboard.scoreboard_mode')}</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActiveTab('individual')}
                      className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                        activeTab === 'individual'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      <User className="inline h-3 w-3 mr-1" />
                      {t('scoreboard.individual')}
                    </button>
                    <button
                      onClick={() => setActiveTab('team')}
                      className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                        activeTab === 'team'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      <Users className="inline h-3 w-3 mr-1" />
                      {t('scoreboard.teams')}
                    </button>
                  </div>
                </div>
                
                {/* Animation Toggle */}
                <div className="mb-3">
                  <div className="text-xs text-muted-foreground mb-1">{t('scoreboard.graph_transitions')}</div>
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
                        {t('scoreboard.smooth_enabled')}
                      </>
                    ) : (
                      <>
                        <ZapOff className="h-3 w-3" />
                        {t('scoreboard.instant_disabled')}
                      </>
                    )}
                  </button>
                </div>
                
                {/* Auto-Switch Toggle */}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{t('scoreboard.auto_switch_mode')}</div>
                  <button
                    onClick={() => setAutoSwitch(!autoSwitch)}
                    className={`w-full px-2 py-1 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                      autoSwitch
                        ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <RefreshCw className={`h-3 w-3 ${autoSwitch ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                    {autoSwitch ? t('scoreboard.auto_switch_on') : t('scoreboard.auto_switch_off')}
                  </button>
                  {autoSwitch && (
                    <div className="mt-2">
                      <div className="text-xs text-muted-foreground mb-1">{t('scoreboard.interval_seconds')}</div>
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

                  {/* Export controls */}
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-1">Export</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="w-full px-2 py-1 rounded text-xs font-medium flex items-center justify-center gap-1">
                          <Download className="h-3 w-3" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-44">
                        <DropdownMenuItem onClick={() => exportScoreboard('csv')}>
                          <FileText className="h-4 w-4 mr-2" />
                          CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportScoreboard('html')}>
                          <FileText className="h-4 w-4 mr-2" />
                          HTML
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          {t('scoreboard.more_formats_coming')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            )}
          </div>

          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              {t('scoreboard.solve_activity')}
            </CardTitle>
            <CardDescription>
              {activeTab === 'individual' 
                ? t('scoreboard.solve_activity_description_individual')
                : t('scoreboard.solve_activity_description')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 dark:border-cyan-400"></div>
              </div>
            ) : !timelineData || timelineData.timeline.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {t('scoreboard.no_solve_data')}
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timelineData.timeline.map(point => ({
                    time: point.time,
                    ...point.scores
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="time" 
                      className="text-xs"
                      tick={{ fill: 'currentColor' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'currentColor' }}
                      label={{ value: t('scoreboard.points'), angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '0.5rem'
                      }}
                    />
                    {/* Render lines for either teams or users - only show non-hidden entities */}
                    {(timelineData.teams || timelineData.users || [])
                      .filter((entity: any) => {
                        const entityName = entity.name || entity.username;
                        // If hovering, only show the hovered entity
                        if (hoveredEntity) {
                          return entityName === hoveredEntity;
                        }
                        // Otherwise respect the hidden state
                        return !hiddenEntities.has(entityName);
                      })
                      .map((entity: any) => {
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
                              if (index === 0) return <circle key={`dot-${entity.id}-${index}`} cx={cx} cy={cy} r={4} fill={entity.color} />;
                              const prevPoint = timelineData.timeline[index - 1];
                              const currentScore = payload[entityName];
                              const prevScore = prevPoint?.scores?.[entityName] || 0;
                              if (currentScore > prevScore) {
                                return <circle key={`dot-${entity.id}-${index}`} cx={cx} cy={cy} r={4} fill={entity.color} />;
                              }
                              return null;
                            }}
                            activeDot={{ r: 6 }}
                          />
                        );
                      })}
                  </LineChart>
                </ResponsiveContainer>
                {/* Custom clickable legend - simple style matching live/classic */}
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {(timelineData.teams || timelineData.users || []).map((entity: any) => {
                    const entityName = entity.name || entity.username;
                    const isHidden = hiddenEntities.has(entityName);
                    const isHovered = hoveredEntity === entityName;
                    return (
                      <button
                        key={entity.id}
                        onClick={() => toggleEntityVisibility(entityName)}
                        onMouseEnter={() => setHoveredEntity(entityName)}
                        onMouseLeave={() => setHoveredEntity(null)}
                        className={cn(
                          "flex items-center gap-1.5 transition-all",
                          isHidden && "opacity-40 line-through",
                          isHovered && "scale-110"
                        )}
                      >
                        <div 
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: isHidden ? '#888' : entity.color }}
                        />
                        <span className="text-xs font-medium truncate">
                          {entityName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <TabsList className="grid w-full sm:w-auto grid-cols-2">
                  <TabsTrigger value="individual" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t('scoreboard.individual')}
                  </TabsTrigger>
                  <TabsTrigger value="team" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {t('scoreboard.teams')}
                  </TabsTrigger>
                </TabsList>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('scoreboard.search')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <TabsContent value="individual" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {t('scoreboard.individual_leaderboard')}
                    </CardTitle>
                    <CardDescription>
                      {t('scoreboard.top_players_ranked')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredIndividualData.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchTerm ? t('scoreboard.no_results_found') : t('scoreboard.no_players_yet')}
                      </div>
                    ) : (
                      <>
                        <div className="mb-2 text-sm text-muted-foreground">
                          {filteredIndividualData.length === 1 
                            ? t('scoreboard.showing_players', { count: filteredIndividualData.length })
                            : t('scoreboard.showing_players_plural', { count: filteredIndividualData.length })
                          }
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[100px]">{t('scoreboard.rank')}</TableHead>
                                <TableHead>{t('scoreboard.player')}</TableHead>
                                <TableHead>{t('scoreboard.team')}</TableHead>
                                <TableHead className="text-right">{t('scoreboard.points')}</TableHead>
                                <TableHead className="text-right">{t('scoreboard.solves')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedIndividualData.map((entry) => (
                                <TableRow
                                  key={entry.id}
                                  className={cn(
                                    "transition-colors",
                                    entry.id === user?.id && "bg-primary/10 hover:bg-primary/15"
                                  )}
                                >
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {getRankIcon(entry.rank)}
                                      {getRankBadge(entry.rank)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <Link 
                                      href={`/users/${encodeURIComponent(entry.username)}`}
                                      className="hover:text-primary hover:underline transition-colors"
                                    >
                                      {entry.username}
                                    </Link>
                                    {entry.id === user?.id && (
                                      <Badge variant="outline" className="ml-2">
                                        {t('scoreboard.you')}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {entry.teamName || <span className="italic">{t('scoreboard.no_team')}</span>}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {entry.points.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {entry.solves}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {totalIndividualPages >= 1 && (
                          <div className="flex items-center justify-between mt-4">
                            <div className="text-sm text-muted-foreground">
                              {t('scoreboard.page_of', { current: individualPage, total: totalIndividualPages })}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIndividualPage(p => Math.max(1, p - 1))}
                                disabled={individualPage === 1}
                              >
                                <ChevronLeft className="h-4 w-4" />
                                {t('common.previous')}
                              </Button>

                              <div className="flex items-center gap-1">
                                {renderPageButtons(individualPage, totalIndividualPages, setIndividualPage)}
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIndividualPage(p => Math.min(totalIndividualPages, p + 1))}
                                disabled={individualPage === totalIndividualPages}
                              >
                                {t('common.next')}
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="team" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {t('scoreboard.team_leaderboard')}
                    </CardTitle>
                    <CardDescription>
                      {t('scoreboard.top_teams_ranked')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredTeamData.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchTerm ? t('scoreboard.no_results_found') : t('scoreboard.no_teams_yet')}
                      </div>
                    ) : (
                      <>
                        <div className="mb-2 text-sm text-muted-foreground">
                          {filteredTeamData.length === 1
                            ? t('scoreboard.showing_teams', { count: filteredTeamData.length })
                            : t('scoreboard.showing_teams_plural', { count: filteredTeamData.length })
                          }
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[100px]">{t('scoreboard.rank')}</TableHead>
                                <TableHead>{t('scoreboard.team')}</TableHead>
                                <TableHead className="text-right">{t('scoreboard.members')}</TableHead>
                                <TableHead className="text-right">{t('scoreboard.points')}</TableHead>
                                <TableHead className="text-right">{t('scoreboard.solves')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedTeamData.map((entry) => (
                                <TableRow
                                  key={entry.id}
                                  className={cn(
                                    "transition-colors",
                                    entry.id === user?.teamId && "bg-primary/10 hover:bg-primary/15"
                                  )}
                                >
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {getRankIcon(entry.rank)}
                                      {getRankBadge(entry.rank)}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {entry.name}
                                    {entry.id === user?.teamId && (
                                      <Badge variant="outline" className="ml-2">
                                        {t('scoreboard.your_team')}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {entry.memberCount}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {entry.points.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {entry.solves}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        {totalTeamPages >= 1 && (
                          <div className="flex items-center justify-between mt-4">
                            <div className="text-sm text-muted-foreground">
                              {t('scoreboard.page_of', { current: teamPage, total: totalTeamPages })}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTeamPage(p => Math.max(1, p - 1))}
                                disabled={teamPage === 1}
                              >
                                <ChevronLeft className="h-4 w-4" />
                                {t('common.previous')}
                              </Button>

                              <div className="flex items-center gap-1">
                                {renderPageButtons(teamPage, totalTeamPages, setTeamPage)}
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTeamPage(p => Math.min(totalTeamPages, p + 1))}
                                disabled={teamPage === totalTeamPages}
                              >
                                {t('common.next')}
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
