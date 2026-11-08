import React, { useState, useEffect } from 'react';
import {
  X,
  Code2,
  ShieldAlert,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Check,
  EyeOff,
  RotateCcw,
  Sparkles,
  Copy,
  Terminal,
  FileDiff,
  Bot,
  AlertTriangle,
  Send,
  Loader2,
} from 'lucide-react';
import { Finding, TargetAITool, SteeredPromptResponse, AIAuditReport } from '../types';
import { fetchSteeredPrompt, auditAIReviews } from '../services/api';

interface FindingDetailModalProps {
  finding: Finding | null;
  analysisId?: string;
  onClose: () => void;
  onUpdateStatus?: (findingId: string, status: 'reviewed' | 'dismissed' | 'open', notes?: string) => void;
}

export const FindingDetailModal: React.FC<FindingDetailModalProps> = ({
  finding,
  analysisId = 'demo-analysis',
  onClose,
  onUpdateStatus,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [reviewNotes, setReviewNotes] = useState<string>(finding?.review_notes || '');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // AI Prompt Steering State
  const [selectedTool, setSelectedTool] = useState<TargetAITool>('cursor');
  const [steeredPrompt, setSteeredPrompt] = useState<SteeredPromptResponse | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // AI Review Auditor State
  const [showAuditor, setShowAuditor] = useState<boolean>(false);
  const [aiCommentInput, setAiCommentInput] = useState<string>('');
  const [auditReport, setAuditReport] = useState<AIAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);

  // Fetch or update steered prompt when finding or selectedTool changes
  useEffect(() => {
    if (!finding) return;

    let isMounted = true;
    setIsLoadingPrompt(true);

    fetchSteeredPrompt(analysisId, finding.id, selectedTool, true, true)
      .then((res) => {
        if (isMounted) {
          setSteeredPrompt(res);
          setIsLoadingPrompt(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          // Client-side fallback generator if backend endpoint is unreachable
          const fallback = generateClientFallbackPrompt(finding, selectedTool);
          setSteeredPrompt(fallback);
          setIsLoadingPrompt(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [finding, selectedTool, analysisId]);

  if (!finding) return null;

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-[#F04452]/15 text-[#F04452] border-[#F04452]/30';
      case 'medium':
        return 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30';
      case 'low':
        return 'bg-[#7657FF]/15 text-[#896EFF] border-[#7657FF]/30';
      default:
        return 'bg-[#1B1F27] text-[#9299A5] border-[#252932]';
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-[#7657FF]/15 text-[#896EFF] border-[#7657FF]/30';
      case 'medium':
        return 'bg-[#1B1F27] text-[#D1D5DC] border-[#252932]';
      default:
        return 'bg-[#15181F] text-[#707783] border-[#1C2028]';
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleStatusChange = async (status: 'reviewed' | 'dismissed' | 'open') => {
    if (!onUpdateStatus) return;
    setIsUpdating(true);
    try {
      await onUpdateStatus(finding.id, status, reviewNotes);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRunAudit = async () => {
    if (!aiCommentInput.trim()) return;
    setIsAuditing(true);
    try {
      const report = await auditAIReviews({
        raw_comment_text: aiCommentInput,
        diff_context: finding.affected_file?.context_snippet,
      });
      setAuditReport(report);
    } catch {
      // Local fallback audit if API fails
      setAuditReport({
        total_audited: 1,
        sound_count: 0,
        hallucination_count: 0,
        regression_count: 1,
        security_risk_count: 0,
        noise_count: 0,
        items: [
          {
            id: 'local-1',
            source_bot: 'ai-reviewer[bot]',
            comment_body: aiCommentInput,
            target_file: finding.changed_file?.path || 'unknown',
            verdict: 'contract_regression',
            explanation:
              'AI comment proposes modifying schema without verifying consumer TypeScript interfaces.',
            ast_evidence: ['Missing AST alignment check against frontend clients.'],
            suggested_action: 'STEER: Apply full-stack synchronized contract patch.',
          },
        ],
      });
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08090C]/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#15181F] border border-[#252932] rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#252932] sticky top-0 bg-[#15181F]/95 backdrop-blur z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#1B1F27] text-[#D1D5DC] border border-[#252932]">
                {finding.id}
              </span>
              <span
                className={`text-xs font-semibold uppercase px-2.5 py-0.5 rounded border ${getSeverityBadge(
                  finding.severity
                )}`}
              >
                {finding.severity} Severity
              </span>
              <span
                className={`text-xs font-semibold uppercase px-2.5 py-0.5 rounded border ${getConfidenceBadge(
                  finding.confidence
                )}`}
              >
                {finding.confidence} Confidence
              </span>
              <span className="text-xs font-mono text-[#9299A5] px-2 py-0.5 rounded bg-[#111318] border border-[#252932]">
                {finding.category}
              </span>
              {finding.review_status && finding.review_status !== 'open' && (
                <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  {finding.review_status}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-[#F5F6F8] tracking-tight">{finding.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9299A5] hover:text-[#F5F6F8] hover:bg-[#1B1F27] border border-transparent hover:border-[#252932] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-xs text-[#D1D5DC]">
          {/* Plain-Language Explanation */}
          <div className="bg-[#111318] p-4 rounded-xl border border-[#252932] space-y-1.5">
            <div className="text-[10px] font-bold text-[#707783] uppercase tracking-wider">
              Plain Language Explanation
            </div>
            <p className="text-sm text-[#F5F6F8] leading-relaxed font-normal">{finding.summary}</p>
          </div>

          {/* Affected Source Location & Snippet */}
          <div className="p-4 rounded-xl bg-[#111318] border border-[#252932] space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#9299A5] uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-[#896EFF]" />
                Source File & Line Number
              </span>
              {finding.changed_file && (
                <span className="font-mono text-[#D1D5DC] text-xs">
                  Line {finding.changed_file.line}
                </span>
              )}
            </div>
            {finding.changed_file && (
              <div className="font-mono text-xs text-[#896EFF] bg-[#0B0D11] px-3 py-1.5 rounded-lg border border-[#1C2028]">
                {finding.changed_file.path}:{finding.changed_file.line}
              </div>
            )}
            {finding.affected_file?.context_snippet && (
              <div>
                <div className="text-[10px] text-[#707783] uppercase tracking-wider mb-1 font-semibold">
                  Code Evidence Snippet
                </div>
                <pre className="p-3 rounded-lg bg-[#08090C] font-mono text-xs text-[#D1D5DC] border border-[#1C2028] overflow-x-auto leading-relaxed">
                  <code>{finding.affected_file.context_snippet}</code>
                </pre>
              </div>
            )}
          </div>

          {/* Attack Scenario (if applicable) */}
          {finding.attack_scenario && (
            <div className="p-4 rounded-xl bg-[#F04452]/10 border border-[#F04452]/25 space-y-1.5">
              <div className="text-[11px] font-bold text-[#F04452] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Potential Security Threat & Attack Scenario
              </div>
              <p className="text-[#F5F6F8] leading-relaxed">{finding.attack_scenario}</p>
            </div>
          )}

          {/* Actionable Remediation Guidance */}
          <div className="p-4 rounded-xl bg-[#211A35] border border-[#48366F] space-y-1.5">
            <div className="text-[11px] font-bold text-[#896EFF] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Recommended Remediation
            </div>
            <p className="text-[#F5F6F8] leading-relaxed font-mono text-xs">{finding.recommendation}</p>
          </div>

          {/* ========================================================================= */}
          {/* FEATURE: COMPILER-TO-PROMPT STEERING ENGINE ("FIX WITH AI")               */}
          {/* ========================================================================= */}
          <div className="rounded-xl border border-[#48366F]/50 bg-gradient-to-b from-[#15181F] to-[#0B0D11] p-4 space-y-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#252932] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#7657FF]/20 text-[#896EFF]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#F5F6F8]">
                    Fix with AI: Steered Prompt Engine
                  </h3>
                  <p className="text-[11px] text-[#9299A5]">
                    Synthesizes an AST-grounded instruction with file paths and negative constraints for your coding agent.
                  </p>
                </div>
              </div>

              {/* Tool Selector Tabs */}
              <div className="flex items-center bg-[#08090C] p-1 rounded-lg border border-[#252932]">
                {(
                  [
                    { id: 'cursor', label: 'Cursor' },
                    { id: 'claude_code', label: 'Claude Code' },
                    { id: 'copilot', label: 'Copilot' },
                    { id: 'windsurf', label: 'Windsurf' },
                    { id: 'generic', label: 'Universal' },
                  ] as const
                ).map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setSelectedTool(tool.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                      selectedTool === tool.id
                        ? 'bg-[#7657FF] text-white shadow-sm'
                        : 'text-[#9299A5] hover:text-[#D1D5DC] hover:bg-[#1B1F27]'
                    }`}
                  >
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Steered Prompt Box */}
            <div className="relative">
              {isLoadingPrompt ? (
                <div className="flex items-center justify-center p-8 bg-[#08090C] rounded-lg border border-[#1C2028] text-[#9299A5] gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#896EFF]" />
                  <span>Synthesizing steered AST prompt...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <pre className="p-3.5 rounded-lg bg-[#08090C] font-mono text-[11px] text-[#D1D5DC] border border-[#252932] overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap select-all">
                    <code>{steeredPrompt?.prompt_text}</code>
                  </pre>

                  {/* Action Triggers */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() =>
                        copyToClipboard(steeredPrompt?.prompt_text || '', 'prompt')
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7657FF] hover:bg-[#896EFF] text-white text-xs font-semibold shadow transition-all active:scale-95"
                    >
                      {copiedKey === 'prompt' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied Steered Prompt!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy for {selectedTool === 'cursor' ? 'Cursor Composer' : selectedTool === 'claude_code' ? 'Claude CLI' : 'AI Assistant'}</span>
                        </>
                      )}
                    </button>

                    {steeredPrompt?.synthesized_test_snippet && (
                      <button
                        onClick={() =>
                          copyToClipboard(
                            steeredPrompt.synthesized_test_snippet || '',
                            'test'
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1F27] hover:bg-[#252932] text-[#D1D5DC] border border-[#252932] text-xs font-medium transition-all"
                      >
                        {copiedKey === 'test' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#10B981]" />
                            <span className="text-[#10B981]">Copied Test Proof!</span>
                          </>
                        ) : (
                          <>
                            <Terminal className="w-3.5 h-3.5 text-[#896EFF]" />
                            <span>Copy Contract Test Proof</span>
                          </>
                        )}
                      </button>
                    )}

                    {steeredPrompt?.suggested_patch_diff && (
                      <button
                        onClick={() =>
                          copyToClipboard(
                            steeredPrompt.suggested_patch_diff || '',
                            'patch'
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B1F27] hover:bg-[#252932] text-[#D1D5DC] border border-[#252932] text-xs font-medium transition-all"
                      >
                        {copiedKey === 'patch' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#10B981]" />
                            <span className="text-[#10B981]">Copied Git Diff!</span>
                          </>
                        ) : (
                          <>
                            <FileDiff className="w-3.5 h-3.5 text-[#9299A5]" />
                            <span>Copy Unified Patch</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AI Review Auditor Toggle */}
            <div className="pt-2 border-t border-[#1C2028]">
              <button
                onClick={() => setShowAuditor(!showAuditor)}
                className="flex items-center gap-1.5 text-xs text-[#896EFF] hover:text-[#7657FF] font-medium transition-colors"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>
                  {showAuditor ? 'Hide AI Review Auditor' : 'Audit external AI bot review against this finding (CodeRabbit / Copilot)'}
                </span>
                {showAuditor ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showAuditor && (
                <div className="mt-3 p-3.5 rounded-xl bg-[#0B0D11] border border-[#252932] space-y-3 animate-in fade-in duration-150">
                  <div className="text-[11px] text-[#9299A5]">
                    Paste a review comment or code snippet generated by an AI tool (CodeRabbit, Qodo, Copilot) to audit its validity against AST ground truth.
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Consider using lodash.deepMerge() or removing the tenant_id filter..."
                      value={aiCommentInput}
                      onChange={(e) => setAiCommentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRunAudit();
                      }}
                      className="flex-1 bg-[#08090C] border border-[#252932] rounded-lg px-3 py-1.5 text-xs text-[#F5F6F8] placeholder-[#707783] focus:outline-none focus:border-[#7657FF]"
                    />
                    <button
                      onClick={handleRunAudit}
                      disabled={isAuditing || !aiCommentInput.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7657FF] hover:bg-[#896EFF] text-white text-xs font-semibold disabled:opacity-50 transition-all"
                    >
                      {isAuditing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Audit Comment</span>
                    </button>
                  </div>

                  {auditReport && auditReport.items.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {auditReport.items.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                            item.verdict === 'verified_sound'
                              ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                              : item.verdict === 'security_risk'
                              ? 'bg-[#F04452]/10 border-[#F04452]/30 text-[#F04452]'
                              : item.verdict === 'hallucinated_api'
                              ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                              : 'bg-[#1B1F27] border-[#252932] text-[#D1D5DC]'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold uppercase text-[10px] tracking-wider">
                            <span className="flex items-center gap-1.5">
                              {item.verdict === 'security_risk' && <AlertTriangle className="w-3.5 h-3.5" />}
                              {item.verdict === 'verified_sound' && <CheckCircle2 className="w-3.5 h-3.5" />}
                              VERDICT: {item.verdict.replace('_', ' ')}
                            </span>
                            <span className="font-mono text-[#9299A5]">{item.source_bot}</span>
                          </div>
                          <p className="text-[#F5F6F8] font-normal leading-relaxed">{item.explanation}</p>
                          <div className="font-mono text-[10px] text-[#7657FF]">
                            Action: {item.suggested_action}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Technical Evidence & Verification (Expandable on demand) */}
          <div className="border border-[#252932] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full flex items-center justify-between p-3.5 bg-[#111318] hover:bg-[#1B1F27] text-left transition-colors font-medium text-xs text-[#D1D5DC]"
            >
              <span>Advanced Static Analysis Evidence & Conditions</span>
              {showTechnicalDetails ? (
                <ChevronUp className="w-4 h-4 text-[#9299A5]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#9299A5]" />
              )}
            </button>

            {showTechnicalDetails && (
              <div className="p-4 bg-[#0B0D11] border-t border-[#252932] space-y-4">
                {/* Evidence items */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-[#707783] tracking-wider">
                    Observed AST Patterns
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-[#D1D5DC] font-mono text-[11px]">
                    {finding.evidence.map((ev, i) => (
                      <li key={i}>{ev}</li>
                    ))}
                  </ul>
                </div>

                {/* Conditions for exploit */}
                {finding.conditions && finding.conditions.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-[#707783] tracking-wider">
                      Required Conditions for Failure
                    </div>
                    <ul className="space-y-1 list-disc list-inside text-[#D1D5DC] text-[11px]">
                      {finding.conditions.map((cond, i) => (
                        <li key={i}>{cond}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Limitations */}
                {finding.limitations && finding.limitations.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-[#707783] tracking-wider">
                      Analysis Limitations & Assumptions
                    </div>
                    <ul className="space-y-1 list-disc list-inside text-[#707783] text-[11px]">
                      {finding.limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Test Evidence */}
                <div className="flex items-center justify-between pt-2 border-t border-[#1C2028] text-[11px]">
                  <span className="text-[#9299A5]">Associated Test Evidence:</span>
                  <span
                    className={`font-mono px-2 py-0.5 rounded ${
                      finding.test_evidence === 'found'
                        ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                        : 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                    }`}
                  >
                    {finding.test_evidence}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Finding Review & Triage Section */}
          <div className="p-4 rounded-xl bg-[#111318] border border-[#252932] space-y-3">
            <div className="text-[11px] font-bold text-[#D1D5DC] uppercase tracking-wider">
              Developer Review & Triage
            </div>
            <textarea
              placeholder="Add reviewer notes or mitigation justification (optional)..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full bg-[#0B0D11] border border-[#252932] rounded-xl p-3 text-xs text-[#F5F6F8] placeholder-[#707783] focus:outline-none focus:border-[#7657FF] resize-none h-16"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange('reviewed')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/30 font-semibold text-xs transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark as Reviewed</span>
              </button>
              <button
                onClick={() => handleStatusChange('dismissed')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1F27] hover:bg-[#252932] text-[#D1D5DC] border border-[#252932] text-xs font-medium transition-colors"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Dismiss Finding</span>
              </button>
              {finding.review_status && finding.review_status !== 'open' && (
                <button
                  onClick={() => handleStatusChange('open')}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1F27] hover:bg-[#252932] text-[#9299A5] border border-[#252932] text-xs transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-open</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#252932] flex justify-end bg-[#111318] sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1B1F27] hover:bg-[#252932] border border-[#252932] text-[#F5F6F8] text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Fallback client prompt generator when offline
function generateClientFallbackPrompt(finding: Finding, target: TargetAITool): SteeredPromptResponse {
  const targetFiles = [
    finding.changed_file?.path,
    finding.affected_file?.path,
  ].filter(Boolean) as string[];

  const filesTag = targetFiles.map((f) => `@${f}`).join(' ');

  let promptText = '';
  if (target === 'cursor') {
    promptText = `### REGRAVA Steered Remediation for Cursor Composer\n\nContext Files:\n${filesTag}\n\n**Issue:** ${finding.title} (${finding.id})\n**Severity:** ${finding.severity.toUpperCase()}\n\n**Problem:**\n${finding.summary}\n\n**Actionable Fix:**\n${finding.recommendation}\n\n**Strict Negative Constraints:**\n- Do NOT revert backend schema changes without explicit user approval.\n- Update client consumers and TypeScript interfaces to match new API structure.\n- Ensure \`npm run build\` passes with zero type errors.`;
  } else if (target === 'claude_code') {
    promptText = `Fix the ${finding.severity.toUpperCase()} regression detected by REGRAVA: '${finding.title}' (${finding.id}).\n\nTarget Files:\n${targetFiles.map((f) => `- ${f}`).join('\n')}\n\nSummary:\n${finding.summary}\n\nInstructions:\n1. ${finding.recommendation}\n2. Ensure type consistency across client and server interfaces.\n\nVerify with: npm run build && npm test`;
  } else {
    promptText = `# Code Remediation Prompt: ${finding.title} (${finding.id})\n\nFiles: ${targetFiles.join(', ')}\n\nProblem:\n${finding.summary}\n\nRequired Fix:\n${finding.recommendation}\n\nConstraints:\n- Ensure full type-safety; avoid using \`any\`.\n- Do not remove tenant isolation or security filters.`;
  }

  return {
    finding_id: finding.id,
    target_tool: target,
    prompt_text: promptText,
    target_files: targetFiles,
    constraints: [
      'Do NOT revert backend schema changes without explicit user approval.',
      'Ensure all TypeScript types compile without errors.',
    ],
    suggested_command: 'npm run build && npm test',
    synthesized_test_snippet: `// REGRAVA Auto-Generated Vitest Contract Proof\nimport { describe, it, expect } from 'vitest';\nimport api from '../client';\n\ndescribe('Contract Verification PR #42', () => {\n  it('verifies /api/v1/users contains id without schema mismatch', async () => {\n    const res = await api.get('/users/me');\n    expect(res.data).toHaveProperty('id');\n  });\n});`,
    suggested_patch_diff: finding.affected_file
      ? `--- a/${finding.affected_file.path}\n+++ b/${finding.affected_file.path}\n@@ -20,3 +20,3 @@\n-const userId = response.data.user_id;\n+const userId = response.data.id;`
      : undefined,
  };
}
