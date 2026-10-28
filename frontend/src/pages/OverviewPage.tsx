import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  GitPullRequest,
  FolderGit2,
  ArrowRight,
  Sparkles,
  Layers,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  RepositoryItem,
  PRAnalysisResult,
  Finding,
} from '../types';

interface OverviewPageProps {
  repositories: RepositoryItem[];
  latestAnalysis: PRAnalysisResult | null;
  isLoading: boolean;
  onScanPR: (owner: string, repo: string, prNumber: number) => Promise<void>;
  onSelectFinding: (finding: Finding) => void;
  onNavigateToTab: (tab: string) => void;
  onConnectGitHub: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  repositories,
  latestAnalysis,
  isLoading,
  onScanPR,
  onSelectFinding,
  onNavigateToTab,
  onConnectGitHub,
}) => {
  const highSeverityCount = latestAnalysis?.metrics?.high_severity_count || 0;
  const mediumSeverityCount = latestAnalysis?.metrics?.medium_severity_count || 0;
  const totalFindings = latestAnalysis?.findings?.length || 0;
  const contractGaps = latestAnalysis?.metrics?.breaking_contract_changes || 0;
  const testGaps = latestAnalysis?.metrics?.test_evidence_gaps || 0;

  const sampleRepo = repositories[0];
  const samplePRNumber = 42;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-navy-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            Security & Regression Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time, evidence-based triage across connected repositories and active pull requests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {sampleRepo && (
            <button
              onClick={() => onScanPR(sampleRepo.owner, sampleRepo.name, samplePRNumber)}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-sentinel-cyan/15 hover:bg-sentinel-cyan/25 border border-sentinel-cyan/40 text-sentinel-cyan text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Analyzing Diff...' : 'Run Demo Scan (PR #42)'}</span>
            </button>
          )}

          <button
            onClick={onConnectGitHub}
            className="px-3.5 py-2 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Manage Repositories</span>
          </button>
        </div>
      </div>

      {/* The 4 Core Questions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Question 1: Which repositories are connected? */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sentinel-cyan/10 border border-sentinel-cyan/25 flex items-center justify-center text-sentinel-cyan">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  1. Connected Repositories
                </h2>
                <p className="text-[11px] text-slate-400">
                  {repositories.length} authorized repositories available
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('repos')}
              className="text-xs text-sentinel-cyan hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {repositories.length === 0 ? (
            <div className="p-6 rounded-xl bg-navy-850/50 border border-navy-800 border-dashed text-center space-y-3">
              <p className="text-xs text-slate-400">No GitHub repositories connected yet.</p>
              <button
                onClick={onConnectGitHub}
                className="px-3 py-1.5 rounded-lg bg-sentinel-cyan text-navy-950 font-bold text-xs"
              >
                Connect GitHub Repository
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {repositories.slice(0, 3).map((repo) => (
                <div
                  key={repo.id}
                  className="p-3 rounded-xl bg-navy-850 border border-navy-800 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-mono text-xs font-semibold text-slate-200">
                      {repo.full_name}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1">
                      {repo.description || 'FastAPI + React microservice with payment flow'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-navy-800 text-slate-400 border border-navy-750">
                      {repo.open_pull_requests_count} open PR
                    </span>
                    <button
                      onClick={() => onNavigateToTab('pulls')}
                      className="p-1 rounded hover:bg-navy-750 text-slate-400 hover:text-white"
                      title="View PRs"
                    >
                      <GitPullRequest className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Question 2: Which pull requests need attention? */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sentinel-amber/10 border border-sentinel-amber/25 flex items-center justify-center text-sentinel-amber">
                <GitPullRequest className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  2. Pull Requests Needing Attention
                </h2>
                <p className="text-[11px] text-slate-400">
                  Code changes with pending security reviews or breaking contracts
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('pulls')}
              className="text-xs text-sentinel-cyan hover:underline flex items-center gap-1 font-medium"
            >
              <span>View Pulls</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-navy-850 border border-navy-800 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-sentinel-cyan">PR #42</span>
                  <span className="text-xs font-semibold text-slate-100">
                    Migrate payment flow to v2 with discount support
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                  <span>Author: @dev-aditya</span>
                  <span>&bull;</span>
                  <span className="font-mono text-[10px] text-slate-300">feat/payment-v2 &rarr; main</span>
                </div>
              </div>

              {latestAnalysis ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sentinel-rose/20 text-sentinel-rose border border-sentinel-rose/40">
                  {highSeverityCount} High Risk
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-navy-800 text-slate-400 border border-navy-750">
                  Ready to scan
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-navy-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Changed files: 4 (FastAPI + React)</span>
              <button
                onClick={() => sampleRepo && onScanPR(sampleRepo.owner, sampleRepo.name, 42)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded bg-sentinel-cyan/15 hover:bg-sentinel-cyan/25 text-sentinel-cyan border border-sentinel-cyan/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isLoading ? 'Scanning...' : 'Inspect Diff'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Question 3: What security findings have been identified? */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sentinel-rose/10 border border-sentinel-rose/25 flex items-center justify-center text-sentinel-rose">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  3. Identified Security & Contract Findings
                </h2>
                <p className="text-[11px] text-slate-400">
                  {latestAnalysis
                    ? `${totalFindings} deterministic findings in last scan`
                    : 'Awaiting initial scan of repository'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('findings')}
              className="text-xs text-sentinel-cyan hover:underline flex items-center gap-1 font-medium"
            >
              <span>Explore All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-navy-850 border border-navy-800">
              <div className="text-lg font-bold text-sentinel-rose font-mono">
                {highSeverityCount}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">High</div>
            </div>
            <div className="p-2.5 rounded-xl bg-navy-850 border border-navy-800">
              <div className="text-lg font-bold text-sentinel-amber font-mono">
                {mediumSeverityCount}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Medium</div>
            </div>
            <div className="p-2.5 rounded-xl bg-navy-850 border border-navy-800">
              <div className="text-lg font-bold text-sentinel-cyan font-mono">
                {contractGaps}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Contract</div>
            </div>
            <div className="p-2.5 rounded-xl bg-navy-850 border border-navy-800">
              <div className="text-lg font-bold text-slate-300 font-mono">
                {testGaps}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Test Gaps</div>
            </div>
          </div>

          {/* Preview of Top Findings */}
          {latestAnalysis?.findings && latestAnalysis.findings.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {latestAnalysis.findings.slice(0, 3).map((f) => (
                <div
                  key={f.id}
                  onClick={() => onSelectFinding(f)}
                  className="p-2.5 rounded-lg bg-navy-850 hover:bg-navy-800 border border-navy-800 hover:border-navy-750 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-200 line-clamp-1">
                      {f.title}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {f.changed_file?.path || f.affected_file?.path || 'source code'}
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      f.severity === 'high'
                        ? 'bg-sentinel-rose/20 text-sentinel-rose border border-sentinel-rose/40'
                        : 'bg-sentinel-amber/20 text-sentinel-amber border border-sentinel-amber/40'
                    }`}
                  >
                    {f.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Question 4: What should the developer do next? */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sentinel-emerald/10 border border-sentinel-emerald/25 flex items-center justify-center text-sentinel-emerald">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                4. Actionable Next Steps
              </h2>
              <p className="text-[11px] text-slate-400">Prioritized developer remediation path</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {highSeverityCount > 0 ? (
              <div className="p-3 rounded-xl bg-sentinel-rose/10 border border-sentinel-rose/25 space-y-1">
                <div className="text-xs font-bold text-sentinel-rose flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Review High-Severity Findings Before Merge</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  SQL injection and credential exposure detected in PR #42 diff. Rotate exposed keys and use parameterized queries.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-sentinel-emerald/10 border border-sentinel-emerald/25 space-y-1">
                <div className="text-xs font-bold text-sentinel-emerald flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>No Critical Blockers In Current Scan</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Run a PR scan to analyze the latest diff or connect new repositories.
                </p>
              </div>
            )}

            {contractGaps > 0 && (
              <div className="p-3 rounded-xl bg-sentinel-amber/10 border border-sentinel-amber/25 space-y-1">
                <div className="text-xs font-bold text-sentinel-amber flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Update Frontend Consumer for API Schema Change</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Backend response model removed <code>user_id</code> and replaced with <code>id</code>. Update TSX component.
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-navy-850 border border-navy-800 flex items-center justify-between">
              <div className="text-[11px] text-slate-300">
                Need to authorize other repositories or organizations?
              </div>
              <button
                onClick={onConnectGitHub}
                className="px-2.5 py-1 rounded bg-navy-800 hover:bg-navy-750 text-slate-200 border border-navy-700 text-xs font-medium"
              >
                App Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
