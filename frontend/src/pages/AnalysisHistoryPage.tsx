import React from 'react';
import {
  History,
  Clock,
  ArrowRight,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import { AnalysisHistoryItem } from '../types';

interface AnalysisHistoryPageProps {
  history: AnalysisHistoryItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectHistoryItem: (item: AnalysisHistoryItem) => void;
}

export const AnalysisHistoryPage: React.FC<AnalysisHistoryPageProps> = ({
  history,
  isLoading,
  onRefresh,
  onSelectHistoryItem,
}) => {
  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1C2028]">
        <div>
          <h1 className="text-xl font-bold text-[#F5F6F8] tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-[#896EFF]" />
            Analysis Audit History
          </h1>
          <p className="text-xs text-[#9299A5] mt-1">
            Historical log of deterministic pull-request security and contract scans.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 rounded-xl bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[#D1D5DC] transition-colors disabled:opacity-50"
          title="Refresh history"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* History Items List */}
      {history.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#111318] border border-[#252932] text-center space-y-2">
          <div className="text-xs font-semibold text-[#F5F6F8]">No Scan History Recorded Yet</div>
          <p className="text-xs text-[#707783]">
            Run a security scan on a pull request to record your first audit log entry.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectHistoryItem(item)}
              className="p-5 rounded-2xl bg-[#111318] border border-[#252932] hover:border-[#454B58] transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group shadow-md"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-[#896EFF]">
                    #{item.pr_number}
                  </span>
                  <span className="font-bold text-sm text-[#F5F6F8] group-hover:text-[#896EFF] transition-colors">
                    {item.pr_title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1B1F27] text-[#9299A5] border border-[#252932]">
                    {item.repo_name}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#9299A5]">
                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    <GitBranch className="w-3 h-3 text-[#707783]" />
                    <span>{item.head_ref}</span>
                    <span className="text-[#454B58]">&rarr;</span>
                    <span>{item.base_ref}</span>
                  </div>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 text-[11px] font-mono">
                    <Clock className="w-3 h-3 text-[#707783]" />
                    {item.execution_time_ms}ms
                  </span>
                  <span>&bull;</span>
                  <span className="text-[11px] text-[#707783]">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Metrics Pills */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#F04452]/15 text-[#F04452] border border-[#F04452]/30">
                    {item.metrics.high_severity_count} HIGH
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
                    {item.metrics.medium_severity_count} MED
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#211A35] text-[#896EFF] border border-[#48366F]">
                    {item.metrics.breaking_contract_changes || 0} CONTRACT
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-[#707783] group-hover:text-[#896EFF] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
