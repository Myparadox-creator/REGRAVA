import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ExternalLink,
  ShieldAlert,
  Code2,
  FileCode,
  CheckCircle2,
  EyeOff,
} from 'lucide-react';
import { Finding, Severity } from '../types';

interface FindingsPageProps {
  findings: Finding[];
  onSelectFinding: (finding: Finding) => void;
}

export const FindingsPage: React.FC<FindingsPageProps> = ({
  findings,
  onSelectFinding,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'severity' | 'id'>('severity');

  const filteredFindings = useMemo(() => {
    return findings
      .filter((f) => {
        const matchesSearch =
          f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (f.changed_file?.path && f.changed_file.path.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (f.affected_file?.path && f.affected_file.path.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (f.field_name && f.field_name.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesSeverity = severityFilter === 'all' || f.severity === severityFilter;
        const matchesCategory = categoryFilter === 'all' || f.category.toLowerCase() === categoryFilter.toLowerCase();
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'open' && (!f.review_status || f.review_status === 'open')) ||
          f.review_status === statusFilter;

        return matchesSearch && matchesSeverity && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'severity') {
          const rank: Record<Severity, number> = { high: 3, medium: 2, low: 1, info: 0 };
          return rank[b.severity] - rank[a.severity];
        }
        return a.id.localeCompare(b.id);
      });
  }, [findings, searchTerm, severityFilter, categoryFilter, statusFilter, sortBy]);

  const categories = useMemo(() => {
    const list = Array.from(new Set(findings.map((f) => f.category)));
    return list.length > 0 ? list : ['SECRETS', 'INJECTION', 'AUTHENTICATION', 'INPUT_VALIDATION', 'CONFIGURATION', 'DEPENDENCY', 'API_CONTRACT'];
  }, [findings]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="pb-4 border-b border-[#1C2028]">
        <h1 className="text-xl font-bold text-[#F5F6F8] tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#896EFF]" />
          Security & Regression Findings
        </h1>
        <p className="text-xs text-[#9299A5] mt-1">
          Deterministic static analysis results across secrets, injections, auth checks, input validation, configurations, dependencies, and API contracts.
        </p>
      </div>

      {/* Controls Bar */}
      <div className="bg-[#111318] border border-[#252932] rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#707783] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search findings or files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#15181F] border border-[#252932] rounded-xl pl-9 pr-3 py-2 text-xs text-[#F5F6F8] placeholder-[#707783] focus:outline-none focus:border-[#7657FF]"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-initial min-w-[130px] bg-[#15181F] border border-[#252932] rounded-xl px-3 py-2 text-xs text-[#D1D5DC] focus:outline-none focus:border-[#7657FF]"
          >
            <option value="all">All Triage States</option>
            <option value="open">Open / Unreviewed</option>
            <option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option>
          </select>

          {/* Severity filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="flex-1 sm:flex-initial min-w-[130px] bg-[#15181F] border border-[#252932] rounded-xl px-3 py-2 text-xs text-[#D1D5DC] focus:outline-none focus:border-[#7657FF]"
          >
            <option value="all">All Severities</option>
            <option value="high">High Severity</option>
            <option value="medium">Medium Severity</option>
            <option value="low">Low Severity</option>
            <option value="info">Info</option>
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 sm:flex-initial min-w-[130px] bg-[#15181F] border border-[#252932] rounded-xl px-3 py-2 text-xs text-[#D1D5DC] focus:outline-none focus:border-[#7657FF]"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Sort option */}
          <button
            onClick={() => setSortBy(sortBy === 'severity' ? 'id' : 'severity')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#15181F] border border-[#252932] rounded-xl text-xs text-[#D1D5DC] hover:text-[#F5F6F8] hover:bg-[#1B1F27] transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#707783]" />
            <span>Sort: {sortBy === 'severity' ? 'Severity' : 'ID'}</span>
          </button>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {filteredFindings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#111318] border border-[#252932] text-[#9299A5] text-xs space-y-1">
            <p className="font-semibold text-[#F5F6F8]">No findings match your filter.</p>
            <p className="text-[#707783]">Try clearing filters or run a scan on a pull request.</p>
          </div>
        ) : (
          filteredFindings.map((f) => (
            <div
              key={f.id}
              onClick={() => onSelectFinding(f)}
              className="bg-[#111318] border border-[#252932] hover:border-[#454B58] p-5 rounded-2xl transition-all cursor-pointer space-y-3 shadow-md group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#1B1F27] text-[#D1D5DC] border border-[#252932]">
                    {f.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      f.severity === 'high'
                        ? 'bg-[#F04452]/15 text-[#F04452] border border-[#F04452]/30'
                        : f.severity === 'medium'
                        ? 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                        : 'bg-[#211A35] text-[#896EFF] border border-[#48366F]'
                    }`}
                  >
                    {f.severity}
                  </span>
                  <span className="text-[10px] font-mono font-semibold uppercase text-[#9299A5] px-2 py-0.5 rounded bg-[#15181F] border border-[#1C2028]">
                    {f.category}
                  </span>

                  {f.review_status && f.review_status !== 'open' && (
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded flex items-center gap-1 ${
                        f.review_status === 'reviewed'
                          ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                          : 'bg-[#15181F] text-[#9299A5] border border-[#252932]'
                      }`}
                    >
                      {f.review_status === 'reviewed' ? (
                        <CheckCircle2 className="w-2.5 h-2.5" />
                      ) : (
                        <EyeOff className="w-2.5 h-2.5" />
                      )}
                      <span>{f.review_status}</span>
                    </span>
                  )}

                  <h3 className="text-sm font-semibold text-[#F5F6F8] tracking-tight group-hover:text-[#896EFF] transition-colors">
                    {f.title}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#9299A5]">
                  <span className="font-mono text-[11px] text-[#707783]">{f.confidence} confidence</span>
                  <span className="text-[#896EFF] group-hover:underline flex items-center gap-1 font-medium text-[11px]">
                    Inspect & Triage <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#D1D5DC] leading-relaxed">{f.summary}</p>

              {/* Source Reference Chips */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                {f.changed_file && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#15181F] text-[#D1D5DC] border border-[#1C2028] font-mono text-[11px]">
                    <Code2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span className="text-[#707783]">Changed:</span>
                    <span className="text-[#896EFF]">
                      {f.changed_file.path}:{f.changed_file.line}
                    </span>
                  </div>
                )}
                {f.affected_file && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#15181F] text-[#D1D5DC] border border-[#1C2028] font-mono text-[11px]">
                    <FileCode className="w-3.5 h-3.5 text-[#F04452]" />
                    <span className="text-[#707783]">Consumer:</span>
                    <span className="text-[#F04452]">
                      {f.affected_file.path}:{f.affected_file.line}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#15181F] text-[#D1D5DC] border border-[#1C2028] text-[11px]">
                  <span className="text-[#707783]">Tests:</span>
                  <span
                    className={
                      f.test_evidence === 'found' ? 'text-[#10B981] font-semibold' : 'text-[#F59E0B]'
                    }
                  >
                    {f.test_evidence}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
