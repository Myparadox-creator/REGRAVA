import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  RepositoryItem,
  PullRequestItem,
  PRAnalysisResult,
  Finding,
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
}

export const PullRequestsPage: React.FC<PullRequestsPageProps> = ({
  repositories,
  selectedRepo,
  onSelectRepo,
  pullRequests,
  currentAnalysis,
  isLoading,
  onAnalyzePR,
  onSelectFinding,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'findings' | 'contracts' | 'tests'>('findings');

  const highSeverityCount = currentAnalysis?.metrics?.high_severity_count || 0;
  const mediumSeverityCount = currentAnalysis?.metrics?.medium_severity_count || 0;
  const contractChanges = currentAnalysis?.metrics?.breaking_contract_changes || 0;
  const testGaps = currentAnalysis?.metrics?.test_evidence_gaps || 0;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Controls: Repository Selector & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-navy-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-sentinel-cyan" />
            Pull Request Analysis
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pre-merge pull request security scanning and API contract regression detection.
          </p>
        </div>

        {/* Repository Switcher */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium">Repository:</label>
          <select
            value={selectedRepo?.id || ''}
            onChange={(e) => {
              const r = repositories.find((x) => x.id === e.target.value);
              if (r) onSelectRepo(r);
            }}
            className="px-3 py-1.5 rounded-xl bg-navy-850 border border-navy-700 text-xs text-slate-200 font-mono focus:outline-none focus:border-sentinel-cyan"
          >
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pull Requests List for Selected Repo */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Active Pull Requests in {selectedRepo?.name || 'Repository'}
        </h2>

        {pullRequests.length === 0 ? (
          <div className="p-8 rounded-2xl bg-navy-900 border border-navy-800 text-center text-xs text-slate-400">
            No open pull requests found in this repository.
          </div>
        ) : (
          <div className="space-y-3">
            {pullRequests.map((pr) => {
              const isAnalyzed = currentAnalysis && currentAnalysis.pr_number === pr.number;
              return (
                <div
                  key={pr.number}
                  className={`p-5 rounded-2xl bg-navy-900 border transition-all ${
                    isAnalyzed ? 'border-sentinel-cyan/40 shadow-lg shadow-cyan-950/20' : 'border-navy-800'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-sentinel-cyan">
                          #{pr.number}
                        </span>
                        <h3 className="text-sm font-bold text-white">{pr.title}</h3>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-navy-800 text-slate-300 border border-navy-700">
                          {pr.state}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>by {pr.author}</span>
                        <span>&bull;</span>
                        <div className="flex items-center gap-1 font-mono text-[11px] bg-navy-850 px-2 py-0.5 rounded border border-navy-800">
                          <GitBranch className="w-3 h-3 text-slate-500" />
                          <span>{pr.head_ref}</span>
                          <span className="text-slate-600">&rarr;</span>
                          <span>{pr.base_ref}</span>
                        </div>
                        <span>&bull;</span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {pr.changed_files_count} files changed (+{pr.additions} / -{pr.deletions})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          selectedRepo && onAnalyzePR(selectedRepo.owner, selectedRepo.name, pr.number)
                        }
                        disabled={isLoading}
                        className="px-4 py-2 rounded-xl bg-sentinel-cyan hover:bg-cyan-400 text-navy-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-cyan-950/40 transition-all disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>{isLoading ? 'Running AST Scan...' : 'Analyze PR Diff'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Analysis Results View */}
      {currentAnalysis && (
        <div className="space-y-6 pt-4 border-t border-navy-800">
          {/* Analysis Header & Metrics Card */}
          <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Analysis Report for PR #{currentAnalysis.pr_number}
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-sentinel-emerald/15 text-sentinel-emerald border border-sentinel-emerald/30">
                    DETERMINISTIC
                  </span>
                </div>
                <h2 className="text-base font-bold text-white mt-1">
                  {currentAnalysis.pr_title}
                </h2>
                <div className="text-xs text-slate-400 mt-0.5">
                  Scan completed in <span className="font-mono text-slate-200">{currentAnalysis.execution_time_ms}ms</span> across {currentAnalysis.changed_files?.length || 0} modified files.
                </div>
              </div>

              {/* Severity Summary Pills */}
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-sentinel-rose/15 border border-sentinel-rose/30 text-center">
                  <div className="text-sm font-bold text-sentinel-rose font-mono">
                    {highSeverityCount}
                  </div>
                  <div className="text-[9px] uppercase font-bold text-sentinel-rose">High Risk</div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-sentinel-amber/15 border border-sentinel-amber/30 text-center">
                  <div className="text-sm font-bold text-sentinel-amber font-mono">
                    {mediumSeverityCount}
                  </div>
                  <div className="text-[9px] uppercase font-bold text-sentinel-amber">Medium</div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-sentinel-cyan/15 border border-sentinel-cyan/30 text-center">
                  <div className="text-sm font-bold text-sentinel-cyan font-mono">
                    {contractChanges}
                  </div>
                  <div className="text-[9px] uppercase font-bold text-sentinel-cyan">Contracts</div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-center">
                  <div className="text-sm font-bold text-slate-300 font-mono">
                    {testGaps}
                  </div>
                  <div className="text-[9px] uppercase font-bold text-slate-400">Test Gaps</div>
                </div>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex items-center gap-1 border-b border-navy-800 pt-2">
              <button
                onClick={() => setActiveSubTab('findings')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeSubTab === 'findings'
                    ? 'border-sentinel-cyan text-sentinel-cyan'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Security & Contract Findings ({currentAnalysis.findings.length})</span>
              </button>

              <button
                onClick={() => setActiveSubTab('contracts')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeSubTab === 'contracts'
                    ? 'border-sentinel-cyan text-sentinel-cyan'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>API Contract Diffs ({contractChanges})</span>
              </button>

              <button
                onClick={() => setActiveSubTab('tests')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeSubTab === 'tests'
                    ? 'border-sentinel-cyan text-sentinel-cyan'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSearch className="w-3.5 h-3.5" />
                <span>Test Evidence & Gaps</span>
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
                  className="p-5 rounded-2xl bg-navy-900 border border-navy-800 hover:border-navy-750 transition-all cursor-pointer space-y-3 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            finding.severity === 'high'
                              ? 'bg-sentinel-rose/20 text-sentinel-rose border border-sentinel-rose/40'
                              : finding.severity === 'medium'
                              ? 'bg-sentinel-amber/20 text-sentinel-amber border border-sentinel-amber/40'
                              : 'bg-sentinel-cyan/20 text-sentinel-cyan border border-sentinel-cyan/40'
                          }`}
                        >
                          {finding.severity}
                        </span>

                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-navy-800 text-slate-300 border border-navy-750 uppercase">
                          {finding.category}
                        </span>

                        <span className="font-mono text-xs font-bold text-slate-400">
                          {finding.id}
                        </span>

                        {finding.review_status && finding.review_status !== 'open' && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              finding.review_status === 'reviewed'
                                ? 'bg-sentinel-emerald/20 text-sentinel-emerald'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {finding.review_status}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-white group-hover:text-sentinel-cyan transition-colors">
                        {finding.title}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2">{finding.summary}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-sentinel-cyan font-semibold flex items-center gap-1 group-hover:underline">
                        <span>Review Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* File references */}
                  <div className="pt-2 border-t border-navy-850 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                    {finding.changed_file && (
                      <span className="flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-sentinel-amber" />
                        <span>
                          {finding.changed_file.path}:{finding.changed_file.line}
                        </span>
                      </span>
                    )}

                    {finding.affected_file && (
                      <span className="flex items-center gap-1.5 text-sentinel-cyan">
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Consumer: {finding.affected_file.path}:{finding.affected_file.line}</span>
                      </span>
                    )}

                    <span className="text-slate-500 font-sans text-[11px] ml-auto">
                      Confidence: <strong className="text-slate-300 uppercase">{finding.confidence}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SubTab 2: API Contract Diffs */}
          {activeSubTab === 'contracts' && (
            <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-sentinel-cyan" />
                <span>Backend & Frontend Contract Deltas</span>
              </h3>
              <p className="text-xs text-slate-400">
                Pydantic schema comparison against React/TypeScript client consumption.
              </p>

              <div className="space-y-3 pt-2">
                {currentAnalysis.summary?.contract_diff?.fields_removed?.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-sentinel-rose/10 border border-sentinel-rose/30 space-y-1"
                  >
                    <div className="text-xs font-bold text-sentinel-rose flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-sentinel-rose/20 text-[10px] uppercase">
                        Removed Field
                      </span>
                      <code className="font-mono">{f}</code>
                    </div>
                    <p className="text-xs text-slate-300">
                      The field was removed from the response schema. Frontend consumers expecting this
                      property will receive <code>undefined</code>.
                    </p>
                  </div>
                ))}

                {currentAnalysis.summary?.contract_diff?.fields_added?.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-sentinel-emerald/10 border border-sentinel-emerald/30 space-y-1"
                  >
                    <div className="text-xs font-bold text-sentinel-emerald flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-sentinel-emerald/20 text-[10px] uppercase">
                        Added Field
                      </span>
                      <code className="font-mono">{f}</code>
                    </div>
                    <p className="text-xs text-slate-300">
                      New non-breaking field available in API response payload.
                    </p>
                  </div>
                ))}
              </div>

              {/* Changed files list */}
              <div className="pt-4 border-t border-navy-800 space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Files Modified In This Pull Request:
                </div>
                <div className="space-y-1 font-mono text-xs text-slate-300">
                  {currentAnalysis.changed_files?.map((file, i) => (
                    <div key={i} className="p-2 rounded-lg bg-navy-850 border border-navy-800 flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-slate-400" />
                      <span>{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SubTab 3: Test Evidence */}
          {activeSubTab === 'tests' && (
            <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-sentinel-cyan" />
                <span>Test Coverage & Evidence Analysis</span>
              </h3>
              <p className="text-xs text-slate-400">
                Determines whether modified endpoints and contract fields have dedicated regression tests.
              </p>

              <div className="space-y-3 pt-2">
                {currentAnalysis.findings.map((f) => {
                  const hasEvidence = f.test_evidence === 'found';
                  return (
                    <div
                      key={f.id}
                      className="p-4 rounded-xl bg-navy-850 border border-navy-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-white">{f.title}</div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            hasEvidence
                              ? 'bg-sentinel-emerald/20 text-sentinel-emerald border border-sentinel-emerald/40'
                              : 'bg-sentinel-amber/20 text-sentinel-amber border border-sentinel-amber/40'
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
                              className="text-xs font-mono text-slate-400 bg-navy-900 p-2 rounded border border-navy-800 flex items-center justify-between"
                            >
                              <span>
                                {item.file_path}:{item.line} ({item.test_name})
                              </span>
                              <span className="text-[10px] text-slate-500 font-sans">
                                {item.matched_target}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          The analyzer searched test files for references to this endpoint and schema field, but found no matching assertions. Consider adding a regression test.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
