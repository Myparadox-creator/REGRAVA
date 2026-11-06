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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#1C2028]">
        <div>
          <h1 className="text-xl font-bold text-[#F5F6F8] tracking-tight flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-[#896EFF]" />
            Pull Request Analysis
          </h1>
          <p className="text-xs text-[#9299A5] mt-1">
            Pre-merge pull request security scanning and API contract regression detection.
          </p>
        </div>

        {/* Repository Switcher */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-[#9299A5] font-medium">Repository:</label>
          <select
            value={selectedRepo?.id || ''}
            onChange={(e) => {
              const r = repositories.find((x) => x.id === e.target.value);
              if (r) onSelectRepo(r);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#15181F] border border-[#252932] text-xs text-[#F5F6F8] font-mono focus:outline-none focus:border-[#7657FF]"
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
              return (
                <div
                  key={pr.number}
                  className={`p-5 rounded-2xl bg-[#111318] border transition-all ${
                    isAnalyzed
                      ? 'border-[#7657FF]/60 shadow-lg shadow-purple-950/20'
                      : 'border-[#252932] hover:border-[#454B58]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-[#896EFF]">
                          #{pr.number}
                        </span>
                        <h3 className="text-sm font-bold text-[#F5F6F8]">{pr.title}</h3>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#1B1F27] text-[#9299A5] border border-[#252932]">
                          {pr.state}
                        </span>
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

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          selectedRepo && onAnalyzePR(selectedRepo.owner, selectedRepo.name, pr.number)
                        }
                        disabled={isLoading}
                        className="px-4 py-2 rounded-xl bg-[#7657FF] hover:bg-[#896EFF] text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
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
        <div className="space-y-6 pt-4 border-t border-[#1C2028]">
          {/* Analysis Header & Metrics Card */}
          <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#707783]">
                    Analysis Report for PR #{currentAnalysis.pr_number}
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                    DETERMINISTIC
                  </span>
                </div>
                <h2 className="text-base font-bold text-[#F5F6F8] mt-1">
                  {currentAnalysis.pr_title}
                </h2>
                <div className="text-xs text-[#9299A5] mt-0.5">
                  Scan completed in <span className="font-mono text-[#F5F6F8]">{currentAnalysis.execution_time_ms}ms</span> across {currentAnalysis.changed_files?.length || 0} modified files.
                </div>
              </div>

              {/* Severity Summary Pills */}
              <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-1 border-b border-[#1C2028] pt-2">
              <button
                onClick={() => setActiveSubTab('findings')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeSubTab === 'findings'
                    ? 'border-[#7657FF] text-[#F5F6F8] bg-[#211A35]/30'
                    : 'border-transparent text-[#9299A5] hover:text-[#F5F6F8]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Security & Contract Findings ({currentAnalysis.findings.length})</span>
              </button>

              <button
                onClick={() => setActiveSubTab('contracts')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
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
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
                  activeSubTab === 'tests'
                    ? 'border-[#7657FF] text-[#F5F6F8] bg-[#211A35]/30'
                    : 'border-transparent text-[#9299A5] hover:text-[#F5F6F8]'
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
                  className="p-5 rounded-2xl bg-[#111318] border border-[#252932] hover:border-[#454B58] transition-all cursor-pointer space-y-3 group shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
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
                  <div className="pt-2 border-t border-[#1C2028] flex flex-wrap items-center gap-4 text-xs font-mono text-[#9299A5]">
                    {finding.changed_file && (
                      <span className="flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                        <span>
                          {finding.changed_file.path}:{finding.changed_file.line}
                        </span>
                      </span>
                    )}

                    {finding.affected_file && (
                      <span className="flex items-center gap-1.5 text-[#896EFF]">
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Consumer: {finding.affected_file.path}:{finding.affected_file.line}</span>
                      </span>
                    )}

                    <span className="text-[#707783] font-sans text-[11px] ml-auto">
                      Confidence: <strong className="text-[#D1D5DC] uppercase">{finding.confidence}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SubTab 2: API Contract Diffs */}
          {activeSubTab === 'contracts' && (
            <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-[#F5F6F8] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#896EFF]" />
                <span>Backend & Frontend Contract Deltas</span>
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
                    <div key={i} className="p-2 rounded-lg bg-[#15181F] border border-[#1C2028] flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-[#707783]" />
                      <span>{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SubTab 3: Test Evidence */}
          {activeSubTab === 'tests' && (
            <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-[#F5F6F8] flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-[#896EFF]" />
                <span>Test Coverage & Evidence Analysis</span>
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
                      <div className="flex items-center justify-between">
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
                              className="text-xs font-mono text-[#9299A5] bg-[#0B0D11] p-2 rounded-lg border border-[#1C2028] flex items-center justify-between"
                            >
                              <span>
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
        </div>
      )}
    </div>
  );
};
