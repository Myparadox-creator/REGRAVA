import React, { useState, useEffect } from 'react';
import {
  CircleDot,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Clock,
  Layers,
  FileCode,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import {
  RepositoryItem,
  IssueItem,
  IssueSentinelStats,
  IssueSentinelSettings,
} from '../types';
import {
  fetchRepoIssues,
  triageRepoIssue,
  reopenRepoIssue,
  fetchIssueStats,
  fetchRepoSentinelSettings,
  updateRepoSentinelSettings,
} from '../services/api';

interface IssuesPageProps {
  repositories: RepositoryItem[];
  selectedRepo: RepositoryItem | null;
  onSelectRepo: (repo: RepositoryItem) => void;
}

export const IssuesPage: React.FC<IssuesPageProps> = ({
  repositories,
  selectedRepo,
  onSelectRepo,
}) => {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [stats, setStats] = useState<IssueSentinelStats | null>(null);
  const [settings, setSettings] = useState<IssueSentinelSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [triagingId, setTriagingId] = useState<number | null>(null);
  const [reopeningId, setReopeningId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'triaged'>('all');
  const [expandedIssues, setExpandedIssues] = useState<Record<number, boolean>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const activeRepo = selectedRepo || (repositories.length > 0 ? repositories[0] : null);

  const loadData = async (repoName: string) => {
    setIsLoading(true);
    try {
      const [owner, repo] = repoName.split('/');
      const [issuesRes, statsRes, settingsRes] = await Promise.all([
        fetchRepoIssues(owner, repo, 'all'),
        fetchIssueStats(repoName),
        fetchRepoSentinelSettings(owner, repo),
      ]);
      setIssues(issuesRes);
      setStats(statsRes);
      setSettings(settingsRes);
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Failed to load issues', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeRepo) {
      loadData(activeRepo.full_name);
    }
  }, [activeRepo?.full_name]);

  const toggleExpand = (issueNumber: number) => {
    setExpandedIssues((prev) => ({
      ...prev,
      [issueNumber]: !prev[issueNumber],
    }));
  };

  const handleTriage = async (issueNumber: number) => {
    if (!activeRepo) return;
    const [owner, repo] = activeRepo.full_name.split('/');
    setTriagingId(issueNumber);
    setFeedbackMsg(null);
    try {
      const res = await triageRepoIssue(owner, repo, issueNumber, true, false);
      setFeedbackMsg({
        text: `Issue #${issueNumber} triaged: ${res.classification} (${res.action_taken})`,
        type: 'success',
      });
      // Refresh list and stats
      await loadData(activeRepo.full_name);
      // Automatically expand this issue to show the evidence
      setExpandedIssues((prev) => ({ ...prev, [issueNumber]: true }));
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Failed to triage issue', type: 'error' });
    } finally {
      setTriagingId(null);
    }
  };

  const handleReopen = async (issueNumber: number) => {
    if (!activeRepo) return;
    const [owner, repo] = activeRepo.full_name.split('/');
    setReopeningId(issueNumber);
    setFeedbackMsg(null);
    try {
      await reopenRepoIssue(owner, repo, issueNumber);
      setFeedbackMsg({ text: `Issue #${issueNumber} reopened successfully.`, type: 'success' });
      await loadData(activeRepo.full_name);
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Failed to reopen issue', type: 'error' });
    } finally {
      setReopeningId(null);
    }
  };

  const handleToggleAutoClose = async () => {
    if (!activeRepo || !settings) return;
    const [owner, repo] = activeRepo.full_name.split('/');
    const nextAutoClose = !settings.auto_close;
    try {
      const updated = await updateRepoSentinelSettings(owner, repo, {
        enabled: settings.enabled,
        auto_close: nextAutoClose,
        mode: nextAutoClose ? 'comment_and_close' : 'comment_only',
      });
      setSettings(updated);
      setFeedbackMsg({
        text: `Auto-close ${nextAutoClose ? 'enabled' : 'disabled'} for ${activeRepo.full_name}`,
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || 'Failed to update settings', type: 'error' });
    }
  };

  const filteredIssues = issues.filter((i) => {
    if (statusFilter === 'open') return i.state === 'open';
    if (statusFilter === 'closed') return i.state === 'closed';
    if (statusFilter === 'triaged') return Boolean(i.triage);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Repo Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-2xl bg-[#0E1015] border border-[#1C2028] shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400">
            <CircleDot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[#F5F6F8]">Issue Sentinel</h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold tracking-wide rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                AST Grounding
              </span>
            </div>
            <p className="text-xs text-[#8A919E] mt-0.5">
              Validates incoming issues against repository AST and automatically closes redundant or hallucinated tickets.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Repo dropdown */}
          <div className="flex items-center gap-2 bg-[#14171F] border border-[#232732] rounded-xl px-3 py-1.5">
            <span className="text-xs text-[#707783]">Repo:</span>
            <select
              value={activeRepo?.full_name || ''}
              onChange={(e) => {
                const found = repositories.find((r) => r.full_name === e.target.value);
                if (found) onSelectRepo(found);
              }}
              className="bg-transparent text-xs text-[#E1E4EA] font-medium outline-none cursor-pointer"
            >
              {repositories.map((r) => (
                <option key={r.id || r.full_name} value={r.full_name} className="bg-[#14171F] text-[#E1E4EA]">
                  {r.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-Close Switch */}
          {settings && (
            <button
              onClick={handleToggleAutoClose}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                settings.auto_close
                  ? 'bg-purple-950/40 border-purple-600/40 text-purple-300 hover:bg-purple-900/50'
                  : 'bg-[#14171F] border-[#252932] text-[#8A919E] hover:text-[#E1E4EA]'
              }`}
              title="Toggle automatic closing of verified redundant or hallucinated issues"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Auto-Close: {settings.auto_close ? 'ON' : 'OFF'}</span>
            </button>
          )}

          <button
            onClick={() => activeRepo && loadData(activeRepo.full_name)}
            disabled={isLoading}
            className="p-2 rounded-xl bg-[#14171F] border border-[#232732] text-[#8A919E] hover:text-[#F5F6F8] transition-colors disabled:opacity-50"
            title="Refresh issues"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-[#8A919E] hover:text-white ml-2">
            ×
          </button>
        </div>
      )}

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-[#0E1015] border border-[#1C2028]">
            <div className="flex items-center justify-between text-[#707783] mb-1">
              <span className="text-[11px] font-medium">Total Triaged</span>
              <Layers className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-[#F5F6F8]">{stats.total_triaged}</div>
            <div className="text-[10px] text-[#707783] mt-0.5">Issues grounded</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0E1015] border border-purple-500/20 bg-gradient-to-b from-purple-950/10 to-transparent">
            <div className="flex items-center justify-between text-purple-300 mb-1">
              <span className="text-[11px] font-medium">Already Implemented</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-purple-300">{stats.already_implemented}</div>
            <div className="text-[10px] text-purple-400/80 mt-0.5">Feature already exists</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0E1015] border border-[#1C2028]">
            <div className="flex items-center justify-between text-[#707783] mb-1">
              <span className="text-[11px] font-medium">Non-Existent Context</span>
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-bold text-rose-300">{stats.non_existent_context}</div>
            <div className="text-[10px] text-[#707783] mt-0.5">Hallucinated / spam</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0E1015] border border-[#1C2028]">
            <div className="flex items-center justify-between text-[#707783] mb-1">
              <span className="text-[11px] font-medium">Verified Open</span>
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-300">{stats.valid_open_issues}</div>
            <div className="text-[10px] text-[#707783] mt-0.5">Real bugs / security</div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0E1015] border border-emerald-500/20 bg-gradient-to-b from-emerald-950/10 to-transparent col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-emerald-300 mb-1">
              <span className="text-[11px] font-medium">Hours Saved</span>
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-300">{stats.hours_saved}h</div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">{stats.auto_closed} auto-closed</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1C2028] pb-2">
        {(['all', 'open', 'closed', 'triaged'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === tab
                ? 'bg-[#1E232E] text-white'
                : 'text-[#8A919E] hover:text-[#E1E4EA] hover:bg-[#14171F]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({
              tab === 'all'
                ? issues.length
                : tab === 'open'
                ? issues.filter((i) => i.state === 'open').length
                : tab === 'closed'
                ? issues.filter((i) => i.state === 'closed').length
                : issues.filter((i) => i.triage).length
            })
          </button>
        ))}
      </div>

      {/* Issues List */}
      <div className="space-y-3">
        {filteredIssues.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-[#0E1015] border border-[#1C2028]">
            <CircleDot className="w-8 h-8 text-[#505763] mx-auto mb-2" />
            <div className="text-sm font-medium text-[#C8CDD6]">No issues match the selected filter</div>
            <div className="text-xs text-[#707783] mt-1">
              All issues for {activeRepo?.full_name} are triaged or none match.
            </div>
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isExpanded = Boolean(expandedIssues[issue.number]);
            const triage = issue.triage;
            const isTriaging = triagingId === issue.number;
            const isReopening = reopeningId === issue.number;

            return (
              <div
                key={issue.number}
                className="rounded-2xl bg-[#0E1015] border border-[#1C2028] overflow-hidden transition-all duration-200 hover:border-[#2C313E]"
              >
                {/* Main Card Header */}
                <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="pt-0.5">
                      {issue.state === 'open' ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <CircleDot className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-[#707783]">#{issue.number}</span>
                        <h3 className="text-sm font-semibold text-[#F5F6F8] truncate">{issue.title}</h3>
                        <a
                          href={issue.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#707783] hover:text-[#E1E4EA] transition-colors"
                          title="Open on GitHub"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-[#8A919E]">
                        <span>by {issue.author}</span>
                        <span>•</span>
                        <span>{new Date(issue.created_at).toLocaleDateString()}</span>

                        {/* Labels */}
                        {issue.labels?.map((label) => (
                          <span
                            key={label.name}
                            className="px-2 py-0.5 text-[10px] rounded-md font-medium"
                            style={{
                              backgroundColor: `#${label.color}15`,
                              color: `#${label.color}`,
                              border: `1px solid #${label.color}40`,
                            }}
                          >
                            {label.name}
                          </span>
                        ))}

                        {/* Classification Badge if triaged */}
                        {triage && (
                          <span
                            className={`px-2 py-0.5 text-[10px] rounded-md font-semibold tracking-wide flex items-center gap-1 border ${
                              triage.classification === 'ALREADY_IMPLEMENTED'
                                ? 'bg-purple-950/40 text-purple-300 border-purple-500/30'
                                : triage.classification === 'NON_EXISTENT_CONTEXT'
                                ? 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                                : triage.classification === 'VALID_OPEN_ISSUE'
                                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-950/40 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {triage.classification === 'ALREADY_IMPLEMENTED' && '🟣 Already Implemented'}
                            {triage.classification === 'NON_EXISTENT_CONTEXT' && '🔴 Foreign / Spam Context'}
                            {triage.classification === 'VALID_OPEN_ISSUE' && '🟢 Valid Open Issue'}
                            {triage.classification === 'NEEDS_MORE_INFO' && '🟡 Needs More Info'}
                          </span>
                        )}

                        {triage?.action_taken === 'CLOSED' && (
                          <span className="px-1.5 py-0.5 text-[9px] rounded font-bold bg-purple-500/20 text-purple-300">
                            AUTO-CLOSED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {triage && (
                      <button
                        onClick={() => toggleExpand(issue.number)}
                        className="flex items-center gap-1 text-xs text-[#8A919E] hover:text-[#F5F6F8] px-2 py-1 rounded-lg hover:bg-[#15181F] transition-colors"
                      >
                        <span>Evidence</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {issue.state === 'closed' ? (
                      <button
                        onClick={() => handleReopen(issue.number)}
                        disabled={isReopening}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1C2028] border border-[#2B303C] text-[#E1E4EA] hover:bg-[#252932] transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isReopening ? 'animate-spin' : ''}`} />
                        <span>Reopen</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTriage(issue.number)}
                        disabled={isTriaging}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-colors disabled:opacity-50"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isTriaging ? 'animate-spin' : ''}`} />
                        <span>{isTriaging ? 'Triaging...' : 'Triage with REGRAVA'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Issue Body preview if open and not triaged yet */}
                {!triage && (
                  <div className="px-4 pb-3 pt-1 text-xs text-[#707783] border-t border-[#161820] bg-[#0A0B0E]/50">
                    <p className="line-clamp-2 italic">{issue.body || 'No description provided.'}</p>
                  </div>
                )}

                {/* Expanded Triage Analysis & Grounding Evidence */}
                {triage && isExpanded && (
                  <div className="p-4 border-t border-[#1C2028] bg-[#0A0B0E] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-semibold text-[#E1E4EA] flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-purple-400" />
                        <span>Codebase Grounding Analysis</span>
                      </div>
                      <span className="text-[11px] text-[#707783]">
                        Confidence: <strong className="text-purple-300">{triage.confidence}</strong>
                      </span>
                    </div>

                    <p className="text-xs text-[#B2B8C2] leading-relaxed">{triage.summary}</p>

                    {/* Code Evidence Snippets */}
                    {triage.evidence && triage.evidence.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <div className="text-[11px] font-semibold text-[#8A919E] uppercase tracking-wider">
                          Extracted Evidence
                        </div>
                        {triage.evidence.map((ev, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-[#111318] border border-[#232732] text-xs font-mono space-y-2"
                          >
                            <div className="flex items-center justify-between text-[11px] text-[#8A919E]">
                              <span className="text-purple-300 font-semibold">{ev.file_path || 'Repository'}</span>
                              {ev.line_start && (
                                <span>
                                  Lines {ev.line_start}–{ev.line_end || ev.line_start}
                                </span>
                              )}
                            </div>

                            {ev.code_snippet && (
                              <pre className="p-2.5 rounded-lg bg-[#08090C] text-[#D1D5DB] text-[11px] overflow-x-auto leading-relaxed border border-[#191B22]">
                                <code>{ev.code_snippet}</code>
                              </pre>
                            )}

                            {ev.referenced_files && (
                              <div className="text-[11px] text-rose-300">
                                <strong>Absent Files:</strong> {ev.referenced_files.join(', ')} (not found in git tree)
                              </div>
                            )}

                            {ev.vulnerability_type && (
                              <div className="text-[11px] text-emerald-300">
                                <strong>Vulnerability Detected:</strong> {ev.vulnerability_type}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Taken Audit footer */}
                    <div className="pt-2 flex items-center justify-between text-[11px] text-[#707783] border-t border-[#181B22]">
                      <span>Action: <strong>{triage.action_taken}</strong></span>
                      <span>Triaged at: {new Date(triage.updated_at).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
