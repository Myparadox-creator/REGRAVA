import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
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
  onAnalyzeSecurity?: (repoFullName: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  repositories,
  latestAnalysis,
  isLoading,
  onScanPR,
  onSelectFinding,
  onNavigateToTab,
  onConnectGitHub,
  onAnalyzeSecurity,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#1C2028]">
        <div>
          <h1 className="text-xl font-bold text-[#F5F6F8] tracking-tight flex items-center gap-2.5">
            Security & Regression Overview
          </h1>
          <p className="text-xs text-[#9299A5] mt-1">
            Real-time, evidence-based triage across connected repositories and active pull requests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateToTab('security')}
            className="px-3.5 py-2 rounded-xl bg-[#211A35] hover:bg-[#2c2247] border border-[#48366F] text-[#896EFF] text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#896EFF]" />
            <span>Security Posture</span>
          </button>

          {sampleRepo && (
            <button
              onClick={() => onScanPR(sampleRepo.owner, sampleRepo.name, samplePRNumber)}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-[#7657FF] hover:bg-[#896EFF] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Analyzing Diff...' : 'Run Demo Scan (PR #42)'}</span>
            </button>
          )}

          <button
            onClick={onConnectGitHub}
            className="px-3.5 py-2 rounded-xl bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[#F5F6F8] text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-[#9299A5]" />
            <span>Manage Repositories</span>
          </button>
        </div>
      </div>

      {/* The 4 Core Questions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Question 1: Which repositories are connected? */}
        <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] hover:border-[#454B58] transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#211A35] border border-[#48366F] flex items-center justify-center text-[#896EFF]">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#F5F6F8] uppercase tracking-wider">
                  1. Connected Repositories
                </h2>
                <p className="text-[11px] text-[#707783]">
                  {repositories.length} authorized repositories available
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('repos')}
              className="text-xs text-[#896EFF] hover:underline flex items-center gap-1 font-medium"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {repositories.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#15181F]/50 border border-[#252932] border-dashed text-center space-y-3">
              <p className="text-xs text-[#9299A5]">No GitHub repositories connected yet.</p>
              <button
                onClick={onConnectGitHub}
                className="px-3.5 py-1.5 rounded-lg bg-[#7657FF] text-white font-semibold text-xs"
              >
                Connect GitHub Repository
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {repositories.slice(0, 3).map((repo) => (
                <div
                  key={repo.id}
                  className="p-3 rounded-xl bg-[#15181F] border border-[#1C2028] hover:border-[#252932] flex items-center justify-between transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="font-mono text-xs font-semibold text-[#F5F6F8]">
                      {repo.full_name}
                    </div>
                    <div className="text-[11px] text-[#707783] line-clamp-1">
                      {repo.description || 'FastAPI + React microservice with payment flow'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111318] text-[#9299A5] border border-[#252932]">
                      {repo.open_pull_requests_count} open PR
                    </span>
                    <button
                      onClick={() =>
                        onAnalyzeSecurity
                          ? onAnalyzeSecurity(repo.full_name)
                          : onNavigateToTab('security')
                      }
                      className="p-1 rounded hover:bg-[#1B1F27] text-[#9299A5] hover:text-[#896EFF] transition-colors"
                      title="Analyze Security Health"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onNavigateToTab('pulls')}
                      className="p-1 rounded hover:bg-[#1B1F27] text-[#9299A5] hover:text-[#F5F6F8] transition-colors"
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
        <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] hover:border-[#454B58] transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/25 flex items-center justify-center text-[#F59E0B]">
                <GitPullRequest className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#F5F6F8] uppercase tracking-wider">
                  2. Pull Requests Needing Attention
                </h2>
                <p className="text-[11px] text-[#707783]">
                  Code changes with pending security reviews or breaking contracts
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('pulls')}
              className="text-xs text-[#896EFF] hover:underline flex items-center gap-1 font-medium"
            >
              <span>View Pulls</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-[#15181F] border border-[#1C2028] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#896EFF]">PR #42</span>
                  <span className="text-xs font-semibold text-[#F5F6F8]">
                    Migrate payment flow to v2 with discount support
                  </span>
                </div>
                <div className="text-[11px] text-[#707783] mt-1 flex items-center gap-2">
                  <span>Author: @dev-aditya</span>
                  <span>&bull;</span>
                  <span className="font-mono text-[10px] text-[#9299A5]">feat/payment-v2 &rarr; main</span>
                </div>
              </div>

              {latestAnalysis ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#F04452]/15 text-[#F04452] border border-[#F04452]/30">
                  {highSeverityCount} High Risk
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#1B1F27] text-[#9299A5] border border-[#252932]">
                  Ready to scan
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-[#1C2028] flex items-center justify-between text-[11px]">
              <span className="text-[#9299A5]">Changed files: 4 (FastAPI + React)</span>
              <button
                onClick={() => sampleRepo && onScanPR(sampleRepo.owner, sampleRepo.name, 42)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded bg-[#211A35] hover:bg-[#2c2247] text-[#896EFF] border border-[#48366F] text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isLoading ? 'Scanning...' : 'Inspect Diff'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Question 3: What security findings have been identified? */}
        <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] hover:border-[#454B58] transition-all space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F04452]/10 border border-[#F04452]/25 flex items-center justify-center text-[#F04452]">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#F5F6F8] uppercase tracking-wider">
                  3. Identified Security & Contract Findings
                </h2>
                <p className="text-[11px] text-[#707783]">
                  {latestAnalysis
                    ? `${totalFindings} deterministic findings in last scan`
                    : 'Awaiting initial scan of repository'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateToTab('findings')}
              className="text-xs text-[#896EFF] hover:underline flex items-center gap-1 font-medium"
            >
              <span>Explore All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-[#15181F] border border-[#1C2028]">
              <div className="text-lg font-bold text-[#F04452] font-mono">
                {highSeverityCount}
              </div>
              <div className="text-[10px] text-[#707783] uppercase font-semibold">High</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[#15181F] border border-[#1C2028]">
              <div className="text-lg font-bold text-[#F59E0B] font-mono">
                {mediumSeverityCount}
              </div>
              <div className="text-[10px] text-[#707783] uppercase font-semibold">Medium</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[#15181F] border border-[#1C2028]">
              <div className="text-lg font-bold text-[#896EFF] font-mono">
                {contractGaps}
              </div>
              <div className="text-[10px] text-[#707783] uppercase font-semibold">Contract</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[#15181F] border border-[#1C2028]">
              <div className="text-lg font-bold text-[#9299A5] font-mono">
                {testGaps}
              </div>
              <div className="text-[10px] text-[#707783] uppercase font-semibold">Test Gaps</div>
            </div>
          </div>

          {/* Preview of Top Findings */}
          {latestAnalysis?.findings && latestAnalysis.findings.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {latestAnalysis.findings.slice(0, 3).map((f) => (
                <div
                  key={f.id}
                  onClick={() => onSelectFinding(f)}
                  className="p-2.5 rounded-lg bg-[#15181F] hover:bg-[#1B1F27] border border-[#1C2028] hover:border-[#252932] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-[#F5F6F8] line-clamp-1">
                      {f.title}
                    </div>
                    <div className="text-[10px] font-mono text-[#707783]">
                      {f.changed_file?.path || f.affected_file?.path || 'source code'}
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      f.severity === 'high'
                        ? 'bg-[#F04452]/15 text-[#F04452] border border-[#F04452]/30'
                        : 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
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
        <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] hover:border-[#454B58] transition-all space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/25 flex items-center justify-center text-[#10B981]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#F5F6F8] uppercase tracking-wider">
                4. Actionable Next Steps
              </h2>
              <p className="text-[11px] text-[#707783]">Prioritized developer remediation path</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {highSeverityCount > 0 ? (
              <div className="p-3 rounded-xl bg-[#F04452]/10 border border-[#F04452]/25 space-y-1">
                <div className="text-xs font-bold text-[#F04452] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Review High-Severity Findings Before Merge</span>
                </div>
                <p className="text-[11px] text-[#D1D5DC]">
                  SQL injection and credential exposure detected in PR #42 diff. Rotate exposed keys and use parameterized queries.
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#10B981]/10 border border-[#10B981]/25 space-y-1">
                <div className="text-xs font-bold text-[#10B981] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>No Critical Blockers In Current Scan</span>
                </div>
                <p className="text-[11px] text-[#D1D5DC]">
                  Run a PR scan to analyze the latest diff or connect new repositories.
                </p>
              </div>
            )}

            {contractGaps > 0 && (
              <div className="p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/25 space-y-1">
                <div className="text-xs font-bold text-[#F59E0B] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Update Frontend Consumer for API Schema Change</span>
                </div>
                <p className="text-[11px] text-[#D1D5DC]">
                  Backend response model removed <code>user_id</code> and replaced with <code>id</code>. Update TSX component.
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#15181F] border border-[#1C2028] flex items-center justify-between">
              <div className="text-[11px] text-[#9299A5]">
                Need to authorize other repositories or organizations?
              </div>
              <button
                onClick={onConnectGitHub}
                className="px-2.5 py-1 rounded bg-[#1B1F27] hover:bg-[#252932] text-[#F5F6F8] border border-[#252932] text-xs font-medium transition-colors"
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
