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
  ArrowLeft,
  Activity,
  Clock,
  Layers,
  ChevronRight,
  FileCode2,
  ExternalLink,
} from 'lucide-react';
import {
  FleetSecurityPosture,
  Finding,
} from '../types';

interface SecurityDashboardPageProps {
  posture: FleetSecurityPosture | null;
  isLoading: boolean;
  selectedRepoName: string | null;
  onSelectRepoName: (repoFullName: string | null) => void;
  onRefresh: () => Promise<void>;
  onAuditRepo: (owner: string, repo: string) => Promise<void>;
  onSelectRepoForPRs: (repoFullName: string) => void;
  onNavigateToFindings: () => void;
  onSelectFinding?: (finding: Finding) => void;
}

export const SecurityDashboardPage: React.FC<SecurityDashboardPageProps> = ({
  posture,
  isLoading,
  selectedRepoName,
  onSelectRepoName,
  onRefresh,
  onAuditRepo,
  onSelectRepoForPRs,
  onNavigateToFindings,
  onSelectFinding,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | 'a' | 'bc' | 'df'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [auditingRepo, setAuditingRepo] = useState<string | null>(null);
  const [activeLayerFilter, setActiveLayerFilter] = useState<string | null>(null);

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

  // Find currently selected repository for individual deep-dive analysis
  const selectedRepo = useMemo(() => {
    if (!selectedRepoName || !posture?.repositories) return null;
    return (
      posture.repositories.find(
        (r) => r.repo_full_name.toLowerCase() === selectedRepoName.toLowerCase()
      ) || null
    );
  }, [selectedRepoName, posture]);

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

  // =========================================================================
  // VIEW 2: INDIVIDUAL REPOSITORY SECURITY ANALYSIS VIEW
  // =========================================================================
  if (selectedRepo) {
    const isAuditing = auditingRepo === selectedRepo.repo_full_name;

    // Filter findings for this repository if a specific layer is clicked
    const filteredFindings = (selectedRepo.open_findings || []).filter((f) => {
      if (!activeLayerFilter) return true;
      const cat = f.category.toLowerCase();
      if (activeLayerFilter === 'secrets') return cat.includes('secret');
      if (activeLayerFilter === 'injection')
        return cat.includes('inject') || cat.includes('xss') || cat.includes('sqli');
      if (activeLayerFilter === 'authorization')
        return cat.includes('auth') || cat.includes('idor');
      if (activeLayerFilter === 'input_validation')
        return cat.includes('path') || cat.includes('traversal') || cat.includes('ssrf');
      if (activeLayerFilter === 'configuration')
        return cat.includes('config') || cat.includes('cors');
      if (activeLayerFilter === 'dependency') return cat.includes('depend');
      if (activeLayerFilter === 'api_contract')
        return (
          cat.includes('contract') ||
          cat.includes('field') ||
          cat.includes('model') ||
          cat.includes('route')
        );
      return true;
    });

    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto animate-fade-in">
        {/* Navigation Breadcrumb & Repository Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-navy-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectRepoName(null)}
              className="px-3 py-1.5 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-sentinel-cyan" />
              <span>All Repositories</span>
            </button>

            <span className="text-slate-600">/</span>

            {/* Quick Switcher Dropdown */}
            <select
              value={selectedRepo.repo_full_name}
              onChange={(e) => onSelectRepoName(e.target.value)}
              className="bg-navy-900 border border-navy-700 text-white text-xs font-mono font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-sentinel-cyan"
            >
              {posture?.repositories?.map((r) => (
                <option key={r.repo_full_name} value={r.repo_full_name}>
                  {r.repo_full_name} ({r.health_score}%)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onSelectRepoForPRs(selectedRepo.repo_full_name)}
              className="px-3.5 py-2 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <GitPullRequest className="w-3.5 h-3.5 text-slate-400" />
              <span>Inspect PRs</span>
            </button>

            <button
              onClick={() => handleAudit(selectedRepo.owner, selectedRepo.repo_name)}
              disabled={isAuditing}
              className="px-4 py-2 rounded-xl bg-sentinel-cyan/15 hover:bg-sentinel-cyan/25 border border-sentinel-cyan/40 text-sentinel-cyan text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
              <span>{isAuditing ? 'Analyzing Diff...' : 'Run Security Health Audit'}</span>
            </button>
          </div>
        </div>

        {/* Repository Health Hero Card */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 shadow-xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-xl text-white tracking-tight">
                {selectedRepo.repo_full_name}
              </span>
              {selectedRepo.is_private ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-navy-800 text-slate-400 border border-navy-750">
                  <Lock className="w-2.5 h-2.5" /> Private
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-navy-800 text-slate-400 border border-navy-750">
                  <Globe className="w-2.5 h-2.5" /> Public
                </span>
              )}
              {getStatusBadge(selectedRepo.status)}
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap">
              <span>
                Default branch: <code className="text-slate-300 font-mono">{selectedRepo.default_branch}</code>
              </span>
              <span>&bull;</span>
              <span>
                {selectedRepo.total_prs_analyzed} Pull Request(s) audited
              </span>
              {selectedRepo.last_scan_at && (
                <>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    Last audit: {new Date(selectedRepo.last_scan_at).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>

            {/* Top Risk Warning Box */}
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                selectedRepo.high_severity_count > 0
                  ? 'bg-sentinel-rose/10 border-sentinel-rose/30 text-rose-200'
                  : selectedRepo.breaking_contracts_count > 0
                  ? 'bg-sentinel-amber/10 border-sentinel-amber/30 text-amber-200'
                  : 'bg-navy-950/80 border-navy-800 text-slate-300'
              }`}
            >
              {selectedRepo.high_severity_count > 0 ? (
                <ShieldAlert className="w-4 h-4 text-sentinel-rose shrink-0 mt-0.5" />
              ) : selectedRepo.breaking_contracts_count > 0 ? (
                <AlertTriangle className="w-4 h-4 text-sentinel-amber shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-sentinel-emerald shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-bold">Security Status: </span>
                <span className="leading-relaxed">{selectedRepo.top_risk_summary}</span>
              </div>
            </div>
          </div>

          {/* Graphical Radial Gauge & Score Metric */}
          <div className="flex items-center gap-6 p-4 rounded-xl bg-navy-950/60 border border-navy-800 shrink-0">
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke="#1e293b"
                  strokeWidth="7"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke={getStrokeColor(selectedRepo.health_score)}
                  strokeWidth="7"
                  strokeDasharray={238.76}
                  strokeDashoffset={
                    238.76 - (238.76 * selectedRepo.health_score) / 100
                  }
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-extrabold text-white font-mono leading-none">
                  {selectedRepo.health_score}%
                </span>
                <span className="text-[10px] text-slate-400 font-sans mt-0.5">Health</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Overall Grade
              </div>
              <div
                className={`text-base font-extrabold px-3 py-1 rounded-xl border font-mono inline-block ${getGradeColor(
                  selectedRepo.health_grade
                )}`}
              >
                Grade {selectedRepo.health_grade}
              </div>
              <div className="text-[11px] text-slate-400 pt-0.5">
                {selectedRepo.checks_passed_count} of {selectedRepo.total_checks_count} Checks Passing
              </div>
            </div>
          </div>
        </div>

        {/* 4 Quick Stat Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-navy-900 border border-navy-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              High / Critical Alerts
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
                selectedRepo.high_severity_count > 0
                  ? 'text-sentinel-rose'
                  : 'text-sentinel-emerald'
              }`}
            >
              {selectedRepo.high_severity_count}
            </div>
            <div className="text-[10px] text-slate-500">Immediate action required</div>
          </div>

          <div className="p-4 rounded-xl bg-navy-900 border border-navy-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Breaking API Contracts
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
                selectedRepo.breaking_contracts_count > 0
                  ? 'text-sentinel-amber'
                  : 'text-slate-200'
              }`}
            >
              {selectedRepo.breaking_contracts_count}
            </div>
            <div className="text-[10px] text-slate-500">Cross-boundary schema breaking</div>
          </div>

          <div className="p-4 rounded-xl bg-navy-900 border border-navy-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Test Evidence Gaps
            </div>
            <div className="text-2xl font-bold font-mono text-slate-200">
              {selectedRepo.test_evidence_gaps_count}
            </div>
            <div className="text-[10px] text-slate-500">Uncovered code pathways</div>
          </div>

          <div className="p-4 rounded-xl bg-navy-900 border border-navy-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              7-Layer Check Ratio
            </div>
            <div className="text-2xl font-bold font-mono text-sentinel-cyan">
              {selectedRepo.checks_passed_count} / {selectedRepo.total_checks_count}
            </div>
            <div className="text-[10px] text-slate-500">AST verification pass rate</div>
          </div>
        </div>

        {/* 7-Layer AST Security Inspection Matrix */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sentinel-cyan" />
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                7-Layer AST Security Inspection
              </h2>
            </div>
            <div className="text-xs text-slate-400">
              Click any layer to filter open findings below
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {selectedRepo.checks.map((check) => {
              const isSelected = activeLayerFilter === check.id;

              return (
                <button
                  key={check.id}
                  onClick={() =>
                    setActiveLayerFilter(isSelected ? null : check.id)
                  }
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2.5 ${
                    isSelected
                      ? 'border-sentinel-cyan bg-sentinel-cyan/10 ring-1 ring-sentinel-cyan'
                      : check.status === 'passed'
                      ? 'bg-navy-950/60 border-navy-800 hover:border-navy-750'
                      : 'bg-sentinel-rose/10 border-sentinel-rose/30 hover:border-sentinel-rose/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-navy-800 text-slate-400">
                      Layer {check.layer}
                    </span>
                    {check.status === 'passed' ? (
                      <span className="text-sentinel-emerald flex items-center gap-1 font-semibold text-[10px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pass
                      </span>
                    ) : (
                      <span className="text-sentinel-rose flex items-center gap-1 font-bold text-[10px]">
                        <XCircle className="w-3.5 h-3.5" /> {check.alerts_count} Alert(s)
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-bold text-white leading-tight">
                      {check.name}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {check.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {activeLayerFilter && (
            <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
              <span>
                Filtering findings for: <strong className="text-white font-mono">{activeLayerFilter}</strong>
              </span>
              <button
                onClick={() => setActiveLayerFilter(null)}
                className="text-sentinel-cyan hover:underline font-semibold"
              >
                Clear Layer Filter
              </button>
            </div>
          )}
        </div>

        {/* Detailed Findings for this Individual Repository */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-sentinel-rose" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Active Security Findings ({filteredFindings.length})
              </h3>
            </div>
            <button
              onClick={onNavigateToFindings}
              className="text-xs text-sentinel-cyan hover:underline flex items-center gap-1 font-medium"
            >
              <span>View in Findings Hub</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {filteredFindings.length === 0 ? (
            <div className="p-8 rounded-2xl bg-navy-900 border border-navy-800 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-sentinel-emerald mx-auto" />
              <div className="text-sm font-bold text-white">No Open Findings in this Layer</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                All AST security checks for this layer passed clean with zero detected vulnerabilities.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="p-5 rounded-2xl bg-navy-900 border border-navy-800 hover:border-navy-750 transition-all space-y-3 shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                            finding.severity === 'high'
                              ? 'bg-sentinel-rose/15 text-sentinel-rose border border-sentinel-rose/30'
                              : finding.severity === 'medium'
                              ? 'bg-sentinel-amber/15 text-sentinel-amber border border-sentinel-amber/30'
                              : 'bg-sentinel-cyan/15 text-sentinel-cyan border border-sentinel-cyan/30'
                          }`}
                        >
                          {finding.severity}
                        </span>
                        <span className="text-xs font-bold text-white">
                          {finding.title}
                        </span>
                      </div>

                      {finding.changed_file && (
                        <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                          <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {finding.changed_file.path}:{finding.changed_file.line}
                          </span>
                        </div>
                      )}
                    </div>

                    {onSelectFinding && (
                      <button
                        onClick={() => onSelectFinding(finding)}
                        className="px-3 py-1 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-sentinel-cyan text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <span>Inspect Finding</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {finding.summary}
                  </p>

                  <div className="pt-2 border-t border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-300">Remediation:</span>
                      <span className="truncate max-w-xl">{finding.recommendation}</span>
                    </div>

                    {finding.test_evidence === 'not_found_by_analyzer' && (
                      <span className="text-sentinel-amber font-mono font-bold flex items-center gap-1 shrink-0">
                        <AlertTriangle className="w-3 h-3" /> Test Missing
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: ALL REPOSITORIES FLEET DIRECTORY VIEW (DEFAULT)
  // =========================================================================
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto animate-fade-in">
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
            First browse your repository fleet, review high-level health scores, and select any repository to inspect its individual 7-layer security checks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onRefresh()}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isLoading ? 'animate-spin text-sentinel-cyan' : ''
              }`}
            />
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
              Fleet 7-Layer Security Coverage
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
            placeholder="Search repositories..."
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
        /* --- CARD GRID VIEW: ALL REPOSITORIES --- */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRepositories.map((repo) => {
            const isAuditing = auditingRepo === repo.repo_full_name;

            return (
              <div
                key={repo.repo_id || repo.repo_full_name}
                className="p-6 rounded-2xl bg-navy-900 border border-navy-800 hover:border-navy-750 transition-all space-y-5 flex flex-col justify-between shadow-lg shadow-black/20 group"
              >
                {/* Repo Top Bar */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => onSelectRepoName(repo.repo_full_name)}
                          className="font-mono font-bold text-base text-white hover:text-sentinel-cyan transition-colors text-left group-hover:text-sentinel-cyan flex items-center gap-1.5"
                        >
                          <span>{repo.repo_full_name}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
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
                        <span>
                          Branch: <code className="text-slate-300 font-mono">{repo.default_branch}</code>
                        </span>
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

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
                    <div className="p-2 rounded-lg bg-navy-950 border border-navy-800 flex flex-col">
                      <span className="text-[9px] text-slate-500 uppercase font-sans">Checks</span>
                      <span className="text-white font-bold">{repo.checks_passed_count}/7 Passed</span>
                    </div>

                    <div className="p-2 rounded-lg bg-navy-950 border border-navy-800 flex flex-col">
                      <span className="text-[9px] text-slate-500 uppercase font-sans">High Alerts</span>
                      <span
                        className={`font-bold ${
                          repo.high_severity_count > 0 ? 'text-sentinel-rose' : 'text-sentinel-emerald'
                        }`}
                      >
                        {repo.high_severity_count} Alert(s)
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-navy-950 border border-navy-800 flex flex-col">
                      <span className="text-[9px] text-slate-500 uppercase font-sans">API Drift</span>
                      <span
                        className={`font-bold ${
                          repo.breaking_contracts_count > 0 ? 'text-sentinel-amber' : 'text-slate-300'
                        }`}
                      >
                        {repo.breaking_contracts_count} Breaking
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-navy-950 border border-navy-800 flex flex-col">
                      <span className="text-[9px] text-slate-500 uppercase font-sans">Audited PRs</span>
                      <span className="text-slate-300 font-bold">{repo.total_prs_analyzed} PRs</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-4 border-t border-navy-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAudit(repo.owner, repo.repo_name)}
                      disabled={isAuditing}
                      className="px-3 py-1.5 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                      title="Run quick security audit"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isAuditing ? 'animate-spin text-sentinel-cyan' : ''}`}
                      />
                      <span>{isAuditing ? 'Auditing...' : 'Audit'}</span>
                    </button>

                    <button
                      onClick={() => onSelectRepoForPRs(repo.repo_full_name)}
                      className="px-3 py-1.5 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <GitPullRequest className="w-3 h-3 text-slate-500" />
                      <span>PRs</span>
                    </button>
                  </div>

                  {/* Primary Highlighted Action: Analyze Security Health */}
                  <button
                    onClick={() => onSelectRepoName(repo.repo_full_name)}
                    className="px-4 py-1.5 rounded-xl bg-sentinel-cyan text-navy-950 hover:bg-cyan-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950/40"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Analyze Security Health</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* --- COMPLIANCE TABLE VIEW: ALL REPOSITORIES --- */
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
                      className="hover:bg-navy-850/50 transition-colors cursor-pointer"
                      onClick={() => onSelectRepoName(repo.repo_full_name)}
                    >
                      <td className="py-4 px-6 font-mono font-bold text-white">
                        <div className="flex items-center gap-2">
                          <span className="hover:text-sentinel-cyan transition-colors">
                            {repo.repo_full_name}
                          </span>
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

                      <td
                        className="py-4 px-6 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAudit(repo.owner, repo.repo_name)}
                            disabled={isAuditing}
                            className="px-2.5 py-1 rounded-lg bg-navy-800 hover:bg-navy-750 border border-navy-700 text-slate-300 text-xs font-semibold"
                          >
                            {isAuditing ? 'Scanning...' : 'Audit'}
                          </button>
                          <button
                            onClick={() => onSelectRepoName(repo.repo_full_name)}
                            className="px-3 py-1 rounded-lg bg-sentinel-cyan/15 hover:bg-sentinel-cyan/25 border border-sentinel-cyan/40 text-sentinel-cyan text-xs font-semibold flex items-center gap-1"
                          >
                            <span>Analyze</span>
                            <ArrowRight className="w-3 h-3" />
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
