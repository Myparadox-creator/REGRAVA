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
        return 'bg-sentinel-rose/20 text-sentinel-rose border-sentinel-rose/40';
      case 'medium':
        return 'bg-sentinel-amber/20 text-sentinel-amber border-sentinel-amber/40';
      case 'low':
        return 'bg-sentinel-cyan/20 text-sentinel-cyan border-sentinel-cyan/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'bg-sentinel-cyan/20 text-sentinel-cyan border-sentinel-cyan/40';
      case 'medium':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      default:
        return 'bg-slate-850 text-slate-400 border-slate-800';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-navy-900 border border-navy-700 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-navy-800 sticky top-0 bg-navy-900/95 backdrop-blur z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-navy-800 text-slate-300 border border-navy-700">
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
              <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-navy-850 border border-navy-800">
                {finding.category}
              </span>
              {finding.review_status && finding.review_status !== 'open' && (
                <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-sentinel-emerald/20 text-sentinel-emerald border border-sentinel-emerald/30">
                  {finding.review_status}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">{finding.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-xs text-slate-300">
          {/* Plain-Language Explanation */}
          <div className="bg-navy-850 p-4 rounded-lg border border-navy-800 space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Plain Language Explanation
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-normal">{finding.summary}</p>
          </div>

          {/* Affected Source Location & Snippet */}
          <div className="p-4 rounded-lg bg-navy-850 border border-navy-800 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-sentinel-cyan" />
                Source File & Line Number
              </span>
              {finding.changed_file && (
                <span className="font-mono text-slate-300 text-xs">
                  Line {finding.changed_file.line}
                </span>
              )}
            </div>
            {finding.changed_file && (
              <div className="font-mono text-xs text-sentinel-cyan bg-navy-900 px-3 py-1.5 rounded border border-navy-800">
                {finding.changed_file.path}:{finding.changed_file.line}
              </div>
            )}
            {finding.affected_file?.context_snippet && (
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-semibold">
                  Code Evidence Snippet
                </div>
                <pre className="p-3 rounded-lg bg-navy-950 font-mono text-xs text-slate-200 border border-navy-800 overflow-x-auto leading-relaxed">
                  <code>{finding.affected_file.context_snippet}</code>
                </pre>
              </div>
            )}
          </div>

          {/* Attack Scenario (if applicable) */}
          {finding.attack_scenario && (
            <div className="p-4 rounded-lg bg-sentinel-rose/10 border border-sentinel-rose/25 space-y-1.5">
              <div className="text-[11px] font-bold text-sentinel-rose uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Potential Security Threat & Attack Scenario
              </div>
              <p className="text-slate-200 leading-relaxed">{finding.attack_scenario}</p>
            </div>
          )}

          {/* Actionable Remediation Guidance */}
          <div className="p-4 rounded-lg bg-sentinel-cyan/10 border border-sentinel-cyan/30 space-y-1.5">
            <div className="text-[11px] font-bold text-sentinel-cyan uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Recommended Remediation
            </div>
            <p className="text-slate-200 leading-relaxed font-mono text-xs">{finding.recommendation}</p>
          </div>

          {/* Technical Evidence & Verification (Expandable on demand) */}
          <div className="border border-navy-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full flex items-center justify-between p-3 bg-navy-850 hover:bg-navy-800/70 text-left transition-colors font-medium text-xs text-slate-300"
            >
              <span>Advanced Static Analysis Evidence & Conditions</span>
              {showTechnicalDetails ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showTechnicalDetails && (
              <div className="p-4 bg-navy-900 border-t border-navy-800 space-y-4">
                {/* Evidence items */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Observed AST Patterns
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-slate-300 font-mono text-[11px]">
                    {finding.evidence.map((ev, i) => (
                      <li key={i}>{ev}</li>
                    ))}
                  </ul>
                </div>

                {/* Conditions for exploit */}
                {finding.conditions && finding.conditions.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Required Conditions for Failure
                    </div>
                    <ul className="space-y-1 list-disc list-inside text-slate-300 text-[11px]">
                      {finding.conditions.map((cond, i) => (
                        <li key={i}>{cond}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Limitations */}
                {finding.limitations && finding.limitations.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Analysis Limitations & Assumptions
                    </div>
                    <ul className="space-y-1 list-disc list-inside text-slate-400 text-[11px]">
                      {finding.limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Test Evidence */}
                <div className="flex items-center justify-between pt-2 border-t border-navy-800 text-[11px]">
                  <span className="text-slate-400">Associated Test Evidence:</span>
                  <span
                    className={`font-mono px-2 py-0.5 rounded ${
                      finding.test_evidence === 'found'
                        ? 'bg-sentinel-emerald/20 text-sentinel-emerald'
                        : 'bg-sentinel-amber/20 text-sentinel-amber'
                    }`}
                  >
                    {finding.test_evidence}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Finding Review & Triage Section */}
          <div className="p-4 rounded-lg bg-navy-850 border border-navy-800 space-y-3">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Developer Review & Triage
            </div>
            <textarea
              placeholder="Add reviewer notes or mitigation justification (optional)..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full bg-navy-900 border border-navy-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sentinel-cyan resize-none h-16"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStatusChange('reviewed')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sentinel-emerald/20 hover:bg-sentinel-emerald/30 text-sentinel-emerald border border-sentinel-emerald/30 font-semibold text-xs transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark as Reviewed</span>
              </button>
              <button
                onClick={() => handleStatusChange('dismissed')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 text-slate-300 border border-navy-700 text-xs font-medium transition-colors"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Dismiss Finding</span>
              </button>
              {finding.review_status && finding.review_status !== 'open' && (
                <button
                  onClick={() => handleStatusChange('open')}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 text-slate-400 text-xs transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-open</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-navy-800 flex justify-end bg-navy-900 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
