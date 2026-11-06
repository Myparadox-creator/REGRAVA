import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  GitPullRequest,
  Lock,
  Globe,
  ArrowRight,
  Activity,
  Clock,
  Layers,
} from 'lucide-react';
import { FleetSecurityPosture } from '../types';

interface SecurityDashboardPageProps {
  posture: FleetSecurityPosture | null;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onAuditRepo: (owner: string, repo: string) => Promise<void>;
  onSelectRepoForPRs: (repoFullName: string) => void;
  onNavigateToFindings: () => void;
}

export const SecurityDashboardPage: React.FC<SecurityDashboardPageProps> = ({
  posture,
  isLoading,
  onRefresh,
  onAuditRepo,
  onSelectRepoForPRs,
  onNavigateToFindings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | 'a' | 'bc' | 'df'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [auditingRepo, setAuditingRepo] = useState<string | null>(null);

  const handleAudit = async (owner: string, repo: string) => {
    const full = `${owner}/${repo}`;
    setAuditingRepo(full);
    try {
      await onAuditRepo(owner, repo);
    } finally {
      setAuditingRepo(null);
    }
  };

  const filteredRepositories = useMemo(() => {
    if (!posture?.repositories) return [];
    return posture.repositories.filter((repo) => {
      // 1. Keyword search
      const matchesSearch =
        repo.repo_full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.top_risk_summary.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Grade filter
      if (gradeFilter === 'all') return true;
      const g = repo.health_grade;
      if (gradeFilter === 'a') return g === 'A+' || g === 'A';
      if (gradeFilter === 'bc') return g === 'B' || g === 'C';
      if (gradeFilter === 'df') return g === 'D' || g === 'F';
      return true;
    });
  }, [posture, searchQuery, gradeFilter]);

  // Color mappings
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'text-sentinel-emerald border-sentinel-emerald/30 bg-sentinel-emerald/10';
      case 'B':
        return 'text-sentinel-cyan border-sentinel-cyan/30 bg-sentinel-cyan/10';
      case 'C':
        return 'text-sentinel-amber border-sentinel-amber/30 bg-sentinel-amber/10';
      default:
        return 'text-sentinel-rose border-sentinel-rose/30 bg-sentinel-rose/10';
    }
  };

  const getStrokeColor = (score: number) => {
    if (score >= 88) return '#10b981'; // emerald
    if (score >= 78) return '#06b6d4'; // cyan
    if (score >= 65) return '#f59e0b'; // amber
    return '#f43f5e'; // rose
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'hardened':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sentinel-emerald/15 text-sentinel-emerald border border-sentinel-emerald/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Hardened
          </span>
        );
      case 'compliant':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sentinel-cyan/15 text-sentinel-cyan border border-sentinel-cyan/30 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Compliant
          </span>
        );
      case 'moderate_risk':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sentinel-amber/15 text-sentinel-amber border border-sentinel-amber/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Moderate Risk
          </span>
        );
      case 'at_risk':
      case 'critical':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sentinel-rose/15 text-sentinel-rose border border-sentinel-rose/30 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Action Required
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-navy-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  const categories = [
    { id: 'secrets', name: 'Secrets & Keys', layer: 1 },
    { id: 'injection', name: 'Injection (SQLi/XSS)', layer: 2 },
    { id: 'authorization', name: 'Auth & IDOR', layer: 3 },
    { id: 'input_validation', name: 'Path / SSRF', layer: 4 },
    { id: 'configuration', name: 'Config & CORS', layer: 5 },
    { id: 'dependency', name: 'Supply Chain', layer: 6 },
    { id: 'api_contract', name: 'API Contracts', layer: 7 },
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-navy-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5 font-sans">
              <ShieldCheck className="w-5 h-5 text-sentinel-cyan" />
              Repository Security Posture & Health
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sentinel-cyan/15 text-sentinel-cyan border border-sentinel-cyan/30">
              Live AST
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Continuous deterministic evaluation of all 7 security layers and breaking API contracts across your repository fleet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onRefresh()}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sentinel-cyan' : ''}`} />
            <span>{isLoading ? 'Refreshing Fleet...' : 'Re-Evaluate Fleet'}</span>
          </button>
        </div>
      </div>

      {/* Fleet KPI Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Fleet Health Score with Radial Arc */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-navy-800 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Fleet Health Score
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white font-mono">
                {posture?.average_health_score ?? 100}%
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded border ${getGradeColor(
                  posture?.fleet_grade || 'A'
                )}`}
              >
                Grade {posture?.fleet_grade || 'A'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {posture?.hardened_repositories || 0} of {posture?.total_repositories || 0} Repos Hardened
            </div>
          </div>

          {/* Graphical Radial Gauge */}
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke="#1e293b"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke={getStrokeColor(posture?.average_health_score ?? 100)}
                strokeWidth="5"
                strokeDasharray={163.36}
                strokeDashoffset={
                  163.36 - (163.36 * (posture?.average_health_score ?? 100)) / 100
                }
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <ShieldCheck
              className="w-5 h-5 absolute"
              style={{ color: getStrokeColor(posture?.average_health_score ?? 100) }}
            />
          </div>
        </div>

        {/* KPI 2: Repositories Monitored */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-navy-800 space-y-1 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Connected Repositories
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">
            {posture?.total_repositories || 0}
          </div>
          <div className="flex items-center gap-2 pt-1 text-[11px]">
            <span className="text-sentinel-emerald font-semibold">
              {posture?.hardened_repositories || 0} Healthy
            </span>
            <span className="text-slate-600">&bull;</span>
            <span
              className={
                (posture?.at_risk_repositories || 0) > 0
                  ? 'text-sentinel-rose font-bold'
                  : 'text-slate-400'
              }
            >
              {posture?.at_risk_repositories || 0} At Risk
            </span>
          </div>
        </div>

        {/* KPI 3: Open Security Alerts */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-navy-800 space-y-1 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Open Security Alerts
          </div>
          <div className="text-3xl font-extrabold text-white font-mono flex items-baseline gap-2">
            <span
              className={
                (posture?.total_critical_high || 0) > 0
                  ? 'text-sentinel-rose'
                  : 'text-sentinel-emerald'
              }
            >
              {posture?.total_critical_high || 0}
            </span>
            <span className="text-xs text-slate-400 font-sans font-normal">
              High / Critical
            </span>
          </div>
          <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
            <span>{posture?.total_security_alerts || 0} findings awaiting review</span>
            <button
              onClick={onNavigateToFindings}
              className="text-[10px] text-sentinel-cyan hover:underline flex items-center gap-0.5 font-semibold"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* KPI 4: Contract Regressions & Test Gaps */}
        <div className="p-5 rounded-2xl bg-navy-900 border border-navy-800 space-y-1 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Contract Drift & Test Gaps
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <span
                className={`text-2xl font-bold font-mono ${
                  (posture?.total_breaking_contracts || 0) > 0
                    ? 'text-sentinel-amber'
                    : 'text-slate-200'
                }`}
              >
                {posture?.total_breaking_contracts || 0}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">Broken APIs</span>
            </div>
            <span className="text-slate-600">/</span>
            <div>
              <span className="text-2xl font-bold font-mono text-slate-200">
                {posture?.total_test_gaps || 0}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">Test Gaps</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sentinel-cyan" />
            <span>
              {posture?.compliance_readiness?.soc2_ready
                ? 'SOC2 / OWASP Audit Ready'
                : 'Remediation required for compliance'}
            </span>
          </div>
        </div>
      </div>

      {/* 7-Layer Security Coverage Radar Bar */}
      <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sentinel-cyan" />
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              7-Layer Security & Contract Checks Coverage
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {posture?.total_checks_passed || 0} / {posture?.total_checks_evaluated || 0} Checks Passed
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {categories.map((cat) => {
            const count = posture?.category_distribution?.[cat.id] || 0;
            const isClean = count === 0;

            return (
              <div
                key={cat.id}
                className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                  isClean
                    ? 'bg-navy-950/60 border-navy-800 hover:border-navy-750'
                    : 'bg-sentinel-rose/10 border-sentinel-rose/30 shadow-sm shadow-rose-950/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-navy-800 text-slate-400">
                    L{cat.layer}
                  </span>
                  {isClean ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-sentinel-emerald" />
                  ) : (
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-sentinel-rose/20 text-sentinel-rose border border-sentinel-rose/40">
                      {count}
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold text-white leading-tight">
                    {cat.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isClean ? '0 alerts' : `${count} issue(s)`}
                  </div>
                </div>

                {/* Mini graphical bar */}
                <div className="w-full bg-navy-800 h-1 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isClean ? 'bg-sentinel-emerald w-full' : 'bg-sentinel-rose w-full'
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search, Filter & View Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by repository..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-navy-900 border border-navy-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sentinel-cyan transition-colors"
          />
        </div>

        {/* Grade Filters & View Mode */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-navy-900 border border-navy-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setGradeFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                gradeFilter === 'all'
                  ? 'bg-navy-800 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({posture?.repositories?.length || 0})
            </button>
            <button
              onClick={() => setGradeFilter('a')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                gradeFilter === 'a'
                  ? 'bg-sentinel-emerald/20 text-sentinel-emerald font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Grade A
            </button>
            <button
              onClick={() => setGradeFilter('bc')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                gradeFilter === 'bc'
                  ? 'bg-sentinel-amber/20 text-sentinel-amber font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Grade B-C
            </button>
            <button
              onClick={() => setGradeFilter('df')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                gradeFilter === 'df'
                  ? 'bg-sentinel-rose/20 text-sentinel-rose font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              At Risk (D/F)
            </button>
          </div>

          {/* Toggle View */}
          <div className="flex items-center bg-navy-900 border border-navy-800 rounded-xl p-1 text-slate-400">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-navy-800 text-white' : 'hover:text-white'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-navy-800 text-white' : 'hover:text-white'
              }`}
              title="Compliance Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Repositories Display */}
      {filteredRepositories.length === 0 ? (
        <div className="p-12 rounded-2xl bg-navy-900 border border-navy-800 text-center space-y-3">
          <ShieldCheck className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Repositories Match Filters</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Try resetting your search query or switching your grade filter to view other repositories.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setGradeFilter('all');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-xs text-sentinel-cyan font-semibold transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* --- CARD GRID VIEW --- */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRepositories.map((repo) => {
            const isAuditing = auditingRepo === repo.repo_full_name;

            return (
              <div
                key={repo.repo_id || repo.repo_full_name}
                className="p-6 rounded-2xl bg-navy-900 border border-navy-800 hover:border-navy-750 transition-all space-y-5 flex flex-col justify-between shadow-lg shadow-black/20"
              >
                {/* Repo Top Bar */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-base text-white hover:text-sentinel-cyan transition-colors">
                          {repo.repo_full_name}
                        </span>
                        {repo.is_private ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-navy-800 text-slate-400 border border-navy-750">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-navy-800 text-slate-400 border border-navy-750">
                            <Globe className="w-2.5 h-2.5" /> Public
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <span>Branch: <code className="text-slate-300 font-mono">{repo.default_branch}</code></span>
                        {repo.last_scan_at && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              Last audit: {new Date(repo.last_scan_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Health Grade & Status Pill */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className={`text-sm font-extrabold px-3 py-1 rounded-xl border font-mono ${getGradeColor(
                          repo.health_grade
                        )}`}
                      >
                        Grade {repo.health_grade} ({repo.health_score}%)
                      </span>
                      {getStatusBadge(repo.status)}
                    </div>
                  </div>

                  {/* Top Risk Warning Box */}
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      repo.high_severity_count > 0
                        ? 'bg-sentinel-rose/10 border-sentinel-rose/25 text-rose-200'
                        : repo.breaking_contracts_count > 0
                        ? 'bg-sentinel-amber/10 border-sentinel-amber/25 text-amber-200'
                        : 'bg-navy-950/80 border-navy-800 text-slate-300'
                    }`}
                  >
                    {repo.high_severity_count > 0 ? (
                      <ShieldAlert className="w-4 h-4 text-sentinel-rose shrink-0 mt-0.5" />
                    ) : repo.breaking_contracts_count > 0 ? (
                      <AlertTriangle className="w-4 h-4 text-sentinel-amber shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-sentinel-emerald shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{repo.top_risk_summary}</span>
                  </div>

                  {/* 7-Layer Security Checks Grid */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>7-Layer Security Checks</span>
                      <span className="font-mono text-slate-500">
                        {repo.checks_passed_count} / {repo.total_checks_count} Passed
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {repo.checks.map((c) => (
                        <div
                          key={c.id}
                          className="px-2.5 py-1.5 rounded-lg bg-navy-950/70 border border-navy-800 flex items-center justify-between gap-2 text-[11px]"
                          title={c.description}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-[9px] text-slate-500 font-bold">
                              L{c.layer}
                            </span>
                            <span className="text-slate-300 truncate font-medium">
                              {c.name}
                            </span>
                          </div>

                          <div className="shrink-0 flex items-center">
                            {c.status === 'passed' && (
                              <span className="text-sentinel-emerald flex items-center gap-1 font-semibold text-[10px]">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                              </span>
                            )}
                            {c.status === 'failed' && (
                              <span className="text-sentinel-rose flex items-center gap-1 font-bold text-[10px]">
                                <XCircle className="w-3.5 h-3.5" /> {c.alerts_count} Alert
                              </span>
                            )}
                            {c.status === 'warning' && (
                              <span className="text-sentinel-amber flex items-center gap-1 font-bold text-[10px]">
                                <AlertTriangle className="w-3.5 h-3.5" /> Warning
                              </span>
                            )}
                            {c.status === 'pending' && (
                              <span className="text-slate-500 flex items-center gap-1 text-[10px]">
                                Ready
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-4 border-t border-navy-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <GitPullRequest className="w-3.5 h-3.5 text-slate-500" />
                      {repo.total_prs_analyzed} PR(s) audited
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectRepoForPRs(repo.repo_full_name)}
                      className="px-3 py-1.5 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <GitPullRequest className="w-3.5 h-3.5" />
                      <span>View PRs</span>
                    </button>

                    <button
                      onClick={() => handleAudit(repo.owner, repo.repo_name)}
                      disabled={isAuditing}
                      className="px-3.5 py-1.5 rounded-xl bg-sentinel-cyan/15 hover:bg-sentinel-cyan/25 border border-sentinel-cyan/40 text-sentinel-cyan text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`}
                      />
                      <span>{isAuditing ? 'Auditing...' : 'Run Audit'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* --- COMPLIANCE TABLE VIEW --- */
        <div className="rounded-2xl bg-navy-900 border border-navy-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-950 text-slate-400 font-bold uppercase tracking-wider border-b border-navy-800">
                <tr>
                  <th className="py-3.5 px-6">Repository</th>
                  <th className="py-3.5 px-4">Health Grade</th>
                  <th className="py-3.5 px-4">Score</th>
                  <th className="py-3.5 px-4">Checks Passed</th>
                  <th className="py-3.5 px-4">High Alerts</th>
                  <th className="py-3.5 px-4">API Drift</th>
                  <th className="py-3.5 px-4">Test Gaps</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60 text-slate-300">
                {filteredRepositories.map((repo) => {
                  const isAuditing = auditingRepo === repo.repo_full_name;

                  return (
                    <tr
                      key={repo.repo_id || repo.repo_full_name}
                      className="hover:bg-navy-850/50 transition-colors"
                    >
                      <td className="py-4 px-6 font-mono font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span>{repo.repo_full_name}</span>
                          {repo.is_private && (
                            <Lock className="w-3 h-3 text-slate-500" />
                          )}
                        </div>
                        <div className="text-[11px] font-sans font-normal text-slate-400 mt-0.5 truncate max-w-xs">
                          {repo.top_risk_summary}
                        </div>
                      </td>

                      <td className="py-4 px-4 font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded border text-[11px] ${getGradeColor(
                            repo.health_grade
                          )}`}
                        >
                          Grade {repo.health_grade}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-mono font-bold text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-navy-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${repo.health_score}%`,
                                backgroundColor: getStrokeColor(repo.health_score),
                              }}
                            />
                          </div>
                          <span>{repo.health_score}%</span>
                        </div>
                      </td>

                      <td className="py-4 px-4 font-mono">
                        <span className="text-slate-200">
                          {repo.checks_passed_count} / {repo.total_checks_count}
                        </span>
                      </td>

                      <td className="py-4 px-4 font-mono">
                        {repo.high_severity_count > 0 ? (
                          <span className="font-bold text-sentinel-rose px-2 py-0.5 rounded bg-sentinel-rose/15 border border-sentinel-rose/30">
                            {repo.high_severity_count} Alert(s)
                          </span>
                        ) : (
                          <span className="text-sentinel-emerald flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Clean
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 font-mono">
                        {repo.breaking_contracts_count > 0 ? (
                          <span className="text-sentinel-amber font-bold">
                            {repo.breaking_contracts_count} Breaking
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="py-4 px-4 font-mono">
                        {repo.test_evidence_gaps_count > 0 ? (
                          <span className="text-slate-300">
                            {repo.test_evidence_gaps_count} Gaps
                          </span>
                        ) : (
                          <span className="text-sentinel-emerald">Covered</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onSelectRepoForPRs(repo.repo_full_name)}
                            className="px-2.5 py-1 rounded-lg bg-navy-800 hover:bg-navy-750 border border-navy-700 text-slate-200 text-xs font-semibold"
                          >
                            PRs
                          </button>
                          <button
                            onClick={() => handleAudit(repo.owner, repo.repo_name)}
                            disabled={isAuditing}
                            className="px-2.5 py-1 rounded-lg bg-sentinel-cyan/15 hover:bg-sentinel-cyan/25 border border-sentinel-cyan/40 text-sentinel-cyan text-xs font-semibold"
                          >
                            {isAuditing ? 'Scanning...' : 'Audit'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
