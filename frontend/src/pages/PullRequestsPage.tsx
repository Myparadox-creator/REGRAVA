import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  ShieldAlert,
  FileCode,
  GitBranch,
  RefreshCw,
  Layers,
  FileSearch,
  ChevronRight,
  Code2,
  Sparkles,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MessageSquareCode,
  RotateCcw,
  ShieldCheck,
  Clock,
  GitCommit,
  Eye,
} from 'lucide-react';
import {
  RepositoryItem,
  PullRequestItem,
  PRAnalysisResult,
  Finding,
  PRReviewsBundle,
  ReviewJobRecord,
  ReviewJobState,
  RepoReviewSettings,
  LifecycleStatus,
} from '../types';

interface PullRequestsPageProps {
  repositories: RepositoryItem[];
  selectedRepo: RepositoryItem | null;
  onSelectRepo: (repo: RepositoryItem) => void;
  pullRequests: PullRequestItem[];
  currentAnalysis: PRAnalysisResult | null;
  isLoading: boolean;
  onAnalyzePR: (owner: string, repo: string, prNumber: number) => Promise<void>;
  onSelectFinding: (finding: Finding) => void;
  prReviewsBundle?: PRReviewsBundle | null;
  activeReviewJob?: ReviewJobRecord | null;
  repoSettings?: RepoReviewSettings | null;
  githubAppConfigured?: boolean;
  onReviewWithRegrava?: (
    owner: string,
    repo: string,
    prNumber: number,
    options?: { force_re_review?: boolean; dry_run?: boolean }
  ) => Promise<void>;
  onRetryPublish?: (reviewRecordId: string) => Promise<void>;
  onToggleAutoReview?: (owner: string, repo: string, enabled: boolean) => Promise<void>;
  onLoadPRReviews?: (owner: string, repo: string, prNumber: number) => Promise<void>;
  onUpdateLifecycleStatus?: (
    recordId: string,
    status: LifecycleStatus,
    notes?: string,
    verificationEvidence?: string
  ) => Promise<void>;
}

const JOB_STATE_LABEL: Record<ReviewJobState, string> = {
  ready: 'Ready to Review',
  in_progress: 'Review in Progress',
  collecting_pr_changes: 'Collecting PR Changes',
  running_security_checks: 'Running Security Checks',
  generating_review: 'Generating Review',
  publishing_review: 'Publishing Review',
  published: 'Review Published',
  dry_run: 'Dry-Run Review Ready',
  failed: 'Review Failed',
  already_reviewed: 'Already Reviewed',
};

export const PullRequestsPage: React.FC<PullRequestsPageProps> = ({
  repositories,
  selectedRepo,
  onSelectRepo,
  pullRequests,
  currentAnalysis,
  isLoading,
  onAnalyzePR,
  onSelectFinding,
  prReviewsBundle,
  activeReviewJob,
  repoSettings,
  githubAppConfigured = false,
  onReviewWithRegrava,
  onRetryPublish,
  onToggleAutoReview,
  onLoadPRReviews,
  onUpdateLifecycleStatus,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'findings' | 'contracts' | 'tests' | 'github_review'>('findings');
  const [lifecycleNoteInput, setLifecycleNoteInput] = useState<Record<string, string>>({});
  const [activePRForReview, setActivePRForReview] = useState<number | null>(
    currentAnalysis?.pr_number || pullRequests[0]?.number || null
  );

  useEffect(() => {
    const targetPr = currentAnalysis?.pr_number || pullRequests[0]?.number || null;
    if (targetPr !== null && targetPr !== activePRForReview) {
      setActivePRForReview(targetPr);
    }
  }, [currentAnalysis?.pr_number, pullRequests]);

  useEffect(() => {
    if (selectedRepo && activePRForReview && onLoadPRReviews) {
      onLoadPRReviews(selectedRepo.owner, selectedRepo.name, activePRForReview);
    }
  }, [selectedRepo?.full_name, activePRForReview]);

  const highSeverityCount = currentAnalysis?.metrics?.high_severity_count || 0;
  const mediumSeverityCount = currentAnalysis?.metrics?.medium_severity_count || 0;
  const contractChanges = currentAnalysis?.metrics?.breaking_contract_changes || 0;
  const testGaps = currentAnalysis?.metrics?.test_evidence_gaps || 0;

  const jobForCurrentPR =
    activeReviewJob &&
    selectedRepo &&
    activeReviewJob.repo_full_name.toLowerCase() === selectedRepo.full_name.toLowerCase()
      ? activeReviewJob
      : prReviewsBundle?.latest_job || null;

  const isJobRunning = Boolean(
    jobForCurrentPR &&
      ['in_progress', 'collecting_pr_changes', 'running_security_checks', 'generating_review', 'publishing_review'].includes(
        jobForCurrentPR.state
      )
  );

  const latestReview = prReviewsBundle?.reviews?.[0] || jobForCurrentPR?.review || null;
  const autoReviewEnabled = repoSettings?.auto_review_enabled ?? prReviewsBundle?.settings?.auto_review_enabled ?? false;

  const getStatusBadgeStyle = (state?: string) => {
    switch (state) {
      case 'published':
        return 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30';
      case 'dry_run':
        return 'bg-[#211A35] text-[#896EFF] border-[#48366F]';
      case 'already_reviewed':
        return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30';
      case 'failed':
        return 'bg-[#F04452]/15 text-[#F04452] border-[#F04452]/30';
      case 'in_progress':
      case 'collecting_pr_changes':
      case 'running_security_checks':
      case 'generating_review':
      case 'publishing_review':
        return 'bg-[#7657FF]/20 text-[#896EFF] border-[#7657FF]/40 animate-pulse';
      default:
        return 'bg-[#15181F] text-[#9299A5] border-[#252932]';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Top Controls: Repository Selector & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-[#1C2028]">
        <div>
          <h1 className="text-xl font-bold text-[#F5F6F8] tracking-tight flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-[#896EFF]" />
            Pull Request Analysis &amp; GitHub Reviewer
          </h1>
          <p className="text-xs text-[#9299A5] mt-1">
            Pre-merge AST security scanning, API contract regression detection, and native GitHub PR review publication.
          </p>
        </div>

        {/* Repository Switcher & Auto-Review Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#9299A5] font-medium">Repository:</label>
            <select
              value={selectedRepo?.id || ''}
              onChange={(e) => {
                const r = repositories.find((x) => x.id === e.target.value);
                if (r) onSelectRepo(r);
              }}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-[#15181F] border border-[#252932] text-xs text-[#F5F6F8] font-mono focus:outline-none focus:border-[#7657FF]"
            >
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.full_name}
                </option>
              ))}
            </select>
          </div>

          {selectedRepo && onToggleAutoReview && (
            <button
              type="button"
              onClick={() => onToggleAutoReview(selectedRepo.owner, selectedRepo.name, !autoReviewEnabled)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                autoReviewEnabled
                  ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]'
                  : 'bg-[#15181F] border-[#252932] text-[#9299A5] hover:text-[#F5F6F8]'
              }`}
              title="Automatically run REGRAVA reviews when PRs are opened or updated with new commits"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  autoReviewEnabled ? 'bg-[#10B981]' : 'bg-[#454B58]'
                }`}
              />
              <span>Auto-Review: {autoReviewEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Pull Requests List for Selected Repo */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-[#707783] uppercase tracking-wider">
          Active Pull Requests in {selectedRepo?.name || 'Repository'}
        </h2>

        {pullRequests.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#111318] border border-[#252932] text-center text-xs text-[#9299A5]">
            No open pull requests found in this repository.
          </div>
        ) : (
          <div className="space-y-3">
            {pullRequests.map((pr) => {
              const isAnalyzed = currentAnalysis && currentAnalysis.pr_number === pr.number;
              const isThisPRJob = jobForCurrentPR && jobForCurrentPR.pr_number === pr.number;
              const prJobState: ReviewJobState = isThisPRJob ? jobForCurrentPR.state : 'ready';

              return (
                <div
                  key={pr.number}
                  className={`p-4 sm:p-5 rounded-2xl bg-[#111318] border transition-all ${
                    isAnalyzed
                      ? 'border-[#7657FF]/60 shadow-lg shadow-purple-950/20'
                      : 'border-[#252932] hover:border-[#454B58]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-[#896EFF]">
                          #{pr.number}
                        </span>
                        <h3 className="text-sm font-bold text-[#F5F6F8]">{pr.title}</h3>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#1B1F27] text-[#9299A5] border border-[#252932]">
                          {pr.state}
                        </span>
                        {isThisPRJob && (
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getStatusBadgeStyle(
                              prJobState
                            )}`}
                          >
                            {JOB_STATE_LABEL[prJobState] || prJobState}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#9299A5]">
                        <span>by {pr.author}</span>
                        <span>&bull;</span>
                        <div className="flex items-center gap-1 font-mono text-[11px] bg-[#15181F] px-2 py-0.5 rounded border border-[#1C2028]">
                          <GitBranch className="w-3 h-3 text-[#707783]" />
                          <span>{pr.head_ref}</span>
                          <span className="text-[#454B58]">&rarr;</span>
                          <span>{pr.base_ref}</span>
                        </div>
                        <span>&bull;</span>
                        <span className="text-[#9299A5] font-mono text-[11px]">
                          {pr.changed_files_count} files changed (+{pr.additions} / -{pr.deletions})
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
                      {/* Analyze PR Diff (Local Dashboard Scan) */}
                      <button
                        onClick={() => {
                          setActivePRForReview(pr.number);
                          if (selectedRepo) onAnalyzePR(selectedRepo.owner, selectedRepo.name, pr.number);
                        }}
                        disabled={isLoading || isJobRunning}
                        className="flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-xl bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[#D1D5DC] hover:text-[#F5F6F8] font-semibold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Analyze PR Diff</span>
                      </button>

                      {/* Primary Native GitHub Reviewer CTA: Review with REGRAVA */}
                      {onReviewWithRegrava && (
                        <button
                          onClick={() => {
                            setActivePRForReview(pr.number);
                            if (selectedRepo) {
                              onReviewWithRegrava(selectedRepo.owner, selectedRepo.name, pr.number, {
                                force_re_review: prJobState === 'already_reviewed',
                                dry_run: !githubAppConfigured,
                              });
                            }
                          }}
                          disabled={isJobRunning}
                          className="flex-1 sm:flex-initial justify-center px-4 py-2 rounded-xl bg-gradient-to-r from-[#7657FF] to-[#896EFF] hover:brightness-110 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-950/50 transition-all disabled:opacity-50"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isJobRunning ? 'animate-spin' : ''}`} />
                          <span>
                            {isJobRunning && isThisPRJob
                              ? JOB_STATE_LABEL[prJobState]
                              : prJobState === 'already_reviewed'
                              ? 'Re-Review with REGRAVA'
                              : 'Review with REGRAVA'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live REGRAVA Review Progress Panel */}
                  {isThisPRJob && jobForCurrentPR && (
                    <div className="mt-4 pt-4 border-t border-[#1C2028]">
                      <div className="p-4 rounded-xl bg-[#0B0D11] border border-[#252932] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#F5F6F8]">
                            <MessageSquareCode className="w-4 h-4 text-[#896EFF]" />
                            <span>REGRAVA REVIEW</span>
                            <span className="text-[10px] font-normal text-[#707783]">
                              ({JOB_STATE_LABEL[jobForCurrentPR.state]})
                            </span>
                            {jobForCurrentPR.head_sha && (
                              <span className="text-[10px] text-[#9299A5] bg-[#15181F] px-2 py-0.5 rounded border border-[#1C2028]">
                                {jobForCurrentPR.head_sha.slice(0, 7)}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {latestReview?.github_review_url && latestReview.publication_status === 'published' && (
                              <a
                                href={latestReview.github_review_url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1 rounded-lg bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/40 text-[#10B981] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              >
                                <span>View Review on GitHub</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}

                            {latestReview?.publication_status === 'failed' && onRetryPublish && (
                              <button
                                onClick={() => onRetryPublish(latestReview.id)}
                                className="px-3 py-1 rounded-lg bg-[#F04452]/15 hover:bg-[#F04452]/25 border border-[#F04452]/40 text-[#F04452] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Retry Publish</span>
                              </button>
                            )}

                            <button
                              onClick={() => setActiveSubTab('github_review')}
                              className="px-3 py-1 rounded-lg bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[#896EFF] text-xs font-semibold flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect Review Payload</span>
                            </button>
                          </div>
                        </div>

                        {/* Step-by-step progress log */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs font-mono">
                          {jobForCurrentPR.steps.map((step, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-[11px] text-[#D1D5DC] bg-[#111318] px-2.5 py-1.5 rounded-lg border border-[#1C2028]"
                            >
                              {step.status === 'error' ? (
                                <XCircle className="w-3.5 h-3.5 text-[#F04452] shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                              )}
                              <span className="truncate">{step.label}</span>
                            </div>
                          ))}
                        </div>

                        {jobForCurrentPR.state === 'already_reviewed' && (
                          <div className="text-xs text-[#10B981] font-medium">
                            Already reviewed for this commit. Existing review preserved to avoid duplicate comments.
                          </div>
                        )}

                        {jobForCurrentPR.state === 'dry_run' && (
                          <div className="text-xs text-[#896EFF] bg-[#211A35]/60 border border-[#48366F] px-3 py-2 rounded-lg">
                            <strong>Local Dry-Run Mode:</strong> Exact GitHub review summary and inline diff comments were prepared without publishing to GitHub
                            {!githubAppConfigured
                              ? ' (configure GITHUB_APP_ID and private key to publish under the REGRAVA GitHub App identity).'
                              : '.'}
                          </div>
                        )}

                        {jobForCurrentPR.error_message && (
                          <div className="text-xs text-[#F04452] bg-[#F04452]/10 border border-[#F04452]/30 px-3 py-2 rounded-lg">
                            {jobForCurrentPR.error_message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Analysis Results View */}
      {currentAnalysis && (
        <div className="space-y-6 pt-4 border-t border-[#1C2028]">
          {/* Analysis Header & Metrics Card */}
          <div className="p-4 sm:p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 sm:space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#707783]">
                    Analysis Report for PR #{currentAnalysis.pr_number}
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                    DETERMINISTIC
                  </span>
                  {latestReview && (
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border uppercase ${getStatusBadgeStyle(
                        latestReview.publication_status
                      )}`}
                    >
                      GitHub: {latestReview.publication_status}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-[#F5F6F8] mt-1">
                  {currentAnalysis.pr_title}
                </h2>
                <div className="text-xs text-[#9299A5] mt-0.5">
                  Scan completed in <span className="font-mono text-[#F5F6F8]">{currentAnalysis.execution_time_ms.toFixed(1)}ms</span> across {currentAnalysis.changed_files?.length || 0} modified files.
                </div>
              </div>

              {/* Severity Summary Pills */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                <div className="px-3 py-1.5 rounded-xl bg-[#F04452]/15 border border-[#F04452]/30 text-center">
                  <div className="text-sm font-bold text-[#F04452] font-mono">
                    {highSeverityCount}
                  </div>
                  <div className="text-[9px] uppercase font-bold text-[#F04452]">High Risk</div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-center">
                  <div className="text-sm font-bold text-[#F59E0B] font-mono">
                    {mediumSeverityCount}
                  </div>
                  <div className="text-[9px] uppercase font-bold text-[#F59E0B]">Medium</div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#211A35] border border-[#48366F] text-center">
                  <div className="text-sm font-bold text-[#896EFF] font-mono">
                    {contractChanges}
                  </div>
                  <div className="text-[9px] uppercase font-bold text-[#896EFF]">Contracts</div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#15181F] border border-[#252932] text-center">
                  <div className="text-sm font-bold text-[#D1D5DC] font-mono">
                    {testGaps}
                  </div>
                  <div className="text-[9px] uppercase font-bold text-[#707783]">Test Gaps</div>
                </div>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-1 border-b border-[#1C2028] pt-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveSubTab('findings')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                  activeSubTab === 'findings'
                    ? 'border-[#7657FF] text-[#F5F6F8] bg-[#211A35]/30'
                    : 'border-transparent text-[#9299A5] hover:text-[#F5F6F8]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Security &amp; Contract Findings ({currentAnalysis.findings.length})</span>
              </button>

              <button
                onClick={() => setActiveSubTab('contracts')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                  activeSubTab === 'contracts'
                    ? 'border-[#7657FF] text-[#F5F6F8] bg-[#211A35]/30'
                    : 'border-transparent text-[#9299A5] hover:text-[#F5F6F8]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>API Contract Diffs ({contractChanges})</span>
              </button>

              <button
                onClick={() => setActiveSubTab('tests')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                  activeSubTab === 'tests'
                    ? 'border-[#7657FF] text-[#F5F6F8] bg-[#211A35]/30'
                    : 'border-transparent text-[#9299A5] hover:text-[#F5F6F8]'
                }`}
              >
                <FileSearch className="w-3.5 h-3.5" />
                <span>Test Evidence &amp; Gaps</span>
              </button>

              <button
                onClick={() => setActiveSubTab('github_review')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                  activeSubTab === 'github_review'
                    ? 'border-[#7657FF] text-[#F5F6F8] bg-[#211A35]/30'
                    : 'border-transparent text-[#9299A5] hover:text-[#F5F6F8]'
                }`}
              >
                <MessageSquareCode className="w-3.5 h-3.5" />
                <span>GitHub Review &amp; Lifecycle ({prReviewsBundle?.reviews?.length || 0})</span>
              </button>
            </div>
          </div>

          {/* SubTab 1: Findings List */}
          {activeSubTab === 'findings' && (
            <div className="space-y-3">
              {currentAnalysis.findings.map((finding) => (
                <div
                  key={finding.id}
                  onClick={() => onSelectFinding(finding)}
                  className="p-4 sm:p-5 rounded-2xl bg-[#111318] border border-[#252932] hover:border-[#454B58] transition-all cursor-pointer space-y-3 group shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            finding.severity === 'high'
                              ? 'bg-[#F04452]/15 text-[#F04452] border border-[#F04452]/30'
                              : finding.severity === 'medium'
                              ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                              : 'bg-[#211A35] text-[#896EFF] border border-[#48366F]'
                          }`}
                        >
                          {finding.severity}
                        </span>

                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1B1F27] text-[#9299A5] border border-[#252932] uppercase">
                          {finding.category}
                        </span>

                        <span className="font-mono text-xs font-bold text-[#707783]">
                          {finding.id}
                        </span>

                        {finding.review_status && finding.review_status !== 'open' && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              finding.review_status === 'reviewed'
                                ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                                : 'bg-[#15181F] text-[#9299A5] border border-[#252932]'
                            }`}
                          >
                            {finding.review_status}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-[#F5F6F8] group-hover:text-[#896EFF] transition-colors">
                        {finding.title}
                      </h3>
                      <p className="text-xs text-[#9299A5] line-clamp-2">{finding.summary}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-[#896EFF] font-semibold flex items-center gap-1 group-hover:underline">
                        <span>Review Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* File references */}
                  <div className="pt-2 border-t border-[#1C2028] flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-[#9299A5]">
                    {finding.changed_file && (
                      <span className="flex items-center gap-1.5 break-all">
                        <Code2 className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                        <span>
                          {finding.changed_file.path}:{finding.changed_file.line}
                        </span>
                      </span>
                    )}

                    {finding.affected_file && (
                      <span className="flex items-center gap-1.5 text-[#896EFF] break-all">
                        <FileCode className="w-3.5 h-3.5 shrink-0" />
                        <span>Consumer: {finding.affected_file.path}:{finding.affected_file.line}</span>
                      </span>
                    )}

                    <span className="text-[#707783] font-sans text-[11px] sm:ml-auto">
                      Confidence: <strong className="text-[#D1D5DC] uppercase">{finding.confidence}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SubTab 2: API Contract Diffs */}
          {activeSubTab === 'contracts' && (
            <div className="p-4 sm:p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-[#F5F6F8] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#896EFF]" />
                <span>Backend &amp; Frontend Contract Deltas</span>
              </h3>
              <p className="text-xs text-[#9299A5]">
                Pydantic schema comparison against React/TypeScript client consumption.
              </p>

              <div className="space-y-3 pt-2">
                {currentAnalysis.summary?.contract_diff?.fields_removed?.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#F04452]/10 border border-[#F04452]/25 space-y-1"
                  >
                    <div className="text-xs font-bold text-[#F04452] flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#F04452]/20 text-[10px] uppercase">
                        Removed Field
                      </span>
                      <code className="font-mono text-[#F5F6F8]">{f}</code>
                    </div>
                    <p className="text-xs text-[#D1D5DC]">
                      The field was removed from the response schema. Frontend consumers expecting this
                      property will receive <code>undefined</code>.
                    </p>
                  </div>
                ))}

                {currentAnalysis.summary?.contract_diff?.fields_added?.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/25 space-y-1"
                  >
                    <div className="text-xs font-bold text-[#10B981] flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[10px] uppercase">
                        Added Field
                      </span>
                      <code className="font-mono text-[#F5F6F8]">{f}</code>
                    </div>
                    <p className="text-xs text-[#D1D5DC]">
                      New non-breaking field available in API response payload.
                    </p>
                  </div>
                ))}
              </div>

              {/* Changed files list */}
              <div className="pt-4 border-t border-[#1C2028] space-y-2">
                <div className="text-xs font-semibold text-[#707783] uppercase tracking-wider">
                  Files Modified In This Pull Request:
                </div>
                <div className="space-y-1 font-mono text-xs text-[#D1D5DC]">
                  {currentAnalysis.changed_files?.map((file, i) => (
                    <div key={i} className="p-2 rounded-lg bg-[#15181F] border border-[#1C2028] flex items-center gap-2 break-all">
                      <FileCode className="w-3.5 h-3.5 text-[#707783] shrink-0" />
                      <span>{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SubTab 3: Test Evidence */}
          {activeSubTab === 'tests' && (
            <div className="p-4 sm:p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-[#F5F6F8] flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-[#896EFF]" />
                <span>Test Coverage &amp; Evidence Analysis</span>
              </h3>
              <p className="text-xs text-[#9299A5]">
                Determines whether modified endpoints and contract fields have dedicated regression tests.
              </p>

              <div className="space-y-3 pt-2">
                {currentAnalysis.findings.map((f) => {
                  const hasEvidence = f.test_evidence === 'found';
                  return (
                    <div
                      key={f.id}
                      className="p-4 rounded-xl bg-[#15181F] border border-[#1C2028] space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-[#F5F6F8]">{f.title}</div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            hasEvidence
                              ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                              : 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                          }`}
                        >
                          {hasEvidence ? 'Test Evidence Found' : 'No Dedicated Test Detected'}
                        </span>
                      </div>

                      {f.test_evidence_items && f.test_evidence_items.length > 0 ? (
                        <div className="space-y-1">
                          {f.test_evidence_items.map((item, idx) => (
                            <div
                              key={idx}
                              className="text-xs font-mono text-[#9299A5] bg-[#0B0D11] p-2 rounded-lg border border-[#1C2028] flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                            >
                              <span className="break-all">
                                {item.file_path}:{item.line} ({item.test_name})
                              </span>
                              <span className="text-[10px] text-[#707783] font-sans">
                                {item.matched_target}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#9299A5]">
                          The analyzer searched test files for references to this endpoint and schema field, but found no matching assertions. Consider adding a regression test.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SubTab 4: Native GitHub Review & Lifecycle Tracking */}
          {activeSubTab === 'github_review' && (
            <div className="space-y-6">
              {/* Latest Review Publication Card */}
              <div className="p-4 sm:p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1C2028] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#F5F6F8] flex items-center gap-2">
                      <MessageSquareCode className="w-4 h-4 text-[#896EFF]" />
                      <span>GitHub PR Review Output</span>
                    </h3>
                    <p className="text-xs text-[#9299A5] mt-0.5">
                      Review summary and diff-anchored inline comments generated by REGRAVA.
                    </p>
                  </div>

                  {latestReview && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-lg border ${getStatusBadgeStyle(
                          latestReview.publication_status
                        )}`}
                      >
                        {latestReview.publication_status}
                      </span>
                      {latestReview.github_review_url && (
                        <a
                          href={latestReview.github_review_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-lg bg-[#211A35] hover:bg-[#2d234a] border border-[#48366F] text-[#896EFF] text-xs font-semibold flex items-center gap-1.5"
                        >
                          <span>Open on GitHub</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {latestReview.publication_status === 'failed' && onRetryPublish && (
                        <button
                          onClick={() => onRetryPublish(latestReview.id)}
                          className="px-3 py-1 rounded-lg bg-[#F04452]/15 hover:bg-[#F04452]/25 border border-[#F04452]/40 text-[#F04452] text-xs font-semibold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry Publish</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {!latestReview ? (
                  <div className="p-8 text-center rounded-xl bg-[#0B0D11] border border-[#1C2028] text-xs text-[#9299A5] space-y-2">
                    <p>No GitHub review has been generated for this PR yet.</p>
                    <p className="text-[#707783]">
                      Click <strong>Review with REGRAVA</strong> above to run analysis and prepare or publish the review.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Summary Markdown Preview */}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#707783] mb-1.5">
                        Review Summary Comment (Commit {latestReview.head_sha.slice(0, 7)})
                      </div>
                      <pre className="p-4 rounded-xl bg-[#08090C] border border-[#1C2028] font-mono text-xs text-[#D1D5DC] whitespace-pre-wrap overflow-x-auto leading-relaxed">
                        {latestReview.summary_body}
                      </pre>
                    </div>

                    {/* Inline Comments List */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#707783]">
                        Anchored Inline Diff Comments ({latestReview.inline_comments?.length || 0})
                      </div>
                      {latestReview.inline_comments?.length ? (
                        latestReview.inline_comments.map((c, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-[#0B0D11] border border-[#1C2028] space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                              <span className="text-[#896EFF] font-semibold break-all">
                                {c.path}:{c.line} ({c.side})
                              </span>
                              <div className="flex items-center gap-2">
                                {c.finding_id && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#15181F] border border-[#252932] text-[#D1D5DC]">
                                    {c.finding_id}
                                  </span>
                                )}
                                {c.html_url && (
                                  <a
                                    href={c.html_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[#10B981] hover:underline flex items-center gap-1 text-[11px]"
                                  >
                                    <span>GitHub Comment</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                            <pre className="text-xs font-sans text-[#D1D5DC] whitespace-pre-wrap leading-relaxed bg-[#111318] p-3 rounded-lg border border-[#1C2028]">
                              {c.body}
                            </pre>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 rounded-xl bg-[#0B0D11] border border-[#1C2028] text-xs text-[#9299A5]">
                          No inline diff comments were emitted (findings either had no diff-hunk anchor and were placed in the summary, or no actionable findings met threshold).
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Cross-Commit Finding Lifecycle Tracking */}
              <div className="p-4 sm:p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#F5F6F8] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                      <span>Cross-Commit Finding Lifecycle</span>
                    </h3>
                    <p className="text-xs text-[#9299A5] mt-0.5">
                      Tracks whether each finding remains present, had a fix attempted, or was verified fixed across commits.
                    </p>
                  </div>
                </div>

                {!prReviewsBundle?.finding_lifecycle?.length ? (
                  <div className="p-6 text-center rounded-xl bg-[#0B0D11] border border-[#1C2028] text-xs text-[#9299A5]">
                    No lifecycle records tracked yet for this pull request.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prReviewsBundle.finding_lifecycle.map((lf) => (
                      <div
                        key={lf.id}
                        className="p-4 rounded-xl bg-[#0B0D11] border border-[#1C2028] space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#F5F6F8]">
                              {lf.finding_id}
                            </span>
                            <span className="text-xs font-semibold text-[#F5F6F8]">{lf.title}</span>
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                                lf.current_status === 'Verified Fixed'
                                  ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                                  : lf.current_status === 'Still Present' || lf.current_status === 'Open'
                                  ? 'bg-[#F04452]/15 text-[#F04452] border-[#F04452]/30'
                                  : 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                              }`}
                            >
                              {lf.current_status}
                            </span>
                            {lf.published_to_github && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#211A35] text-[#896EFF] border border-[#48366F]">
                                Published to GitHub
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] font-mono text-[#707783]">
                            <GitCommit className="w-3 h-3" />
                            <span>First: {lf.original_head_sha.slice(0, 7)}</span>
                            <span>&rarr;</span>
                            <span>Latest: {lf.current_head_sha.slice(0, 7)}</span>
                          </div>
                        </div>

                        {lf.file_path && (
                          <div className="text-[11px] font-mono text-[#9299A5]">
                            {lf.file_path}:{lf.line_number || '?'}
                          </div>
                        )}

                        {lf.verification_evidence && (
                          <div className="text-[11px] text-[#D1D5DC] bg-[#111318] p-2 rounded border border-[#1C2028]">
                            <strong>Evidence:</strong> {lf.verification_evidence}
                          </div>
                        )}

                        {lf.resolution_notes && (
                          <div className="text-[11px] text-[#9299A5]">
                            <strong>Notes:</strong> {lf.resolution_notes}
                          </div>
                        )}

                        {onUpdateLifecycleStatus && (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                            <input
                              type="text"
                              placeholder="Reason or verification note..."
                              value={lifecycleNoteInput[lf.id] || ''}
                              onChange={(e) =>
                                setLifecycleNoteInput((prev) => ({ ...prev, [lf.id]: e.target.value }))
                              }
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#15181F] border border-[#252932] text-xs text-[#F5F6F8] placeholder-[#707783] focus:outline-none focus:border-[#7657FF]"
                            />
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() =>
                                  onUpdateLifecycleStatus(
                                    lf.id,
                                    'Dismissed with Reason',
                                    lifecycleNoteInput[lf.id] || 'Dismissed after manual context verification'
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[11px] text-[#9299A5] hover:text-[#F5F6F8]"
                              >
                                Dismiss
                              </button>
                              <button
                                onClick={() =>
                                  onUpdateLifecycleStatus(
                                    lf.id,
                                    'Accepted with Reason',
                                    lifecycleNoteInput[lf.id] || 'Risk accepted with compensating controls'
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[11px] text-[#F59E0B]"
                              >
                                Accept Risk
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historical Reviews Table for this PR */}
              {prReviewsBundle?.reviews && prReviewsBundle.reviews.length > 0 && (
                <div className="p-4 sm:p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-3 shadow-xl">
                  <h3 className="text-sm font-bold text-[#F5F6F8] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#896EFF]" />
                    <span>PR Review Publication History</span>
                  </h3>
                  <div className="space-y-2">
                    {prReviewsBundle.reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3 rounded-xl bg-[#0B0D11] border border-[#1C2028] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2 font-mono">
                          <span className="text-[#896EFF] font-bold">{rev.head_sha.slice(0, 7)}</span>
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-[#15181F] text-[#9299A5] border border-[#252932]">
                            {rev.mode}
                          </span>
                          <span
                            className={`text-[10px] uppercase px-2 py-0.5 rounded border ${getStatusBadgeStyle(
                              rev.publication_status
                            )}`}
                          >
                            {rev.publication_status}
                          </span>
                          <span className="text-[#9299A5]">
                            {rev.published_fingerprints?.length || 0} finding(s)
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[#707783]">
                          <span>{new Date(rev.created_at).toLocaleString()}</span>
                          {rev.github_review_url && (
                            <a
                              href={rev.github_review_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#896EFF] hover:underline flex items-center gap-1"
                            >
                              <span>GitHub</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
