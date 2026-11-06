import React, { useState } from 'react';
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
} from 'lucide-react';
import { Finding } from '../types';

interface FindingDetailModalProps {
  finding: Finding | null;
  onClose: () => void;
  onUpdateStatus?: (findingId: string, status: 'reviewed' | 'dismissed' | 'open', notes?: string) => void;
}

export const FindingDetailModal: React.FC<FindingDetailModalProps> = ({
  finding,
  onClose,
  onUpdateStatus,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [reviewNotes, setReviewNotes] = useState<string>(finding?.review_notes || '');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

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

  const handleStatusChange = async (status: 'reviewed' | 'dismissed' | 'open') => {
    if (!onUpdateStatus) return;
    setIsUpdating(true);
    try {
      await onUpdateStatus(finding.id, status, reviewNotes);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08090C]/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#15181F] border border-[#252932] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
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
