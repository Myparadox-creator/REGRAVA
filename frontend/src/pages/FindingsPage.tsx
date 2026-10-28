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
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="pb-4 border-b border-navy-800">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-sentinel-cyan" />
          Security & Regression Findings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Deterministic static analysis results across secrets, injections, auth checks, input validation, configurations, dependencies, and API contracts.
        </p>
      </div>

      {/* Controls Bar */}
      <div className="bg-navy-900 border border-navy-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search findings or files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-navy-850 border border-navy-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sentinel-cyan"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-navy-850 border border-navy-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-sentinel-cyan"
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
            className="bg-navy-850 border border-navy-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-sentinel-cyan"
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
            className="bg-navy-850 border border-navy-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-sentinel-cyan"
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
            className="flex items-center gap-1.5 px-3 py-2 bg-navy-850 border border-navy-800 rounded-xl text-xs text-slate-300 hover:text-white"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort: {sortBy === 'severity' ? 'Severity' : 'ID'}</span>
          </button>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {filteredFindings.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-navy-900 border border-navy-800 text-slate-400 text-xs space-y-1">
            <p className="font-semibold text-slate-300">No findings match your filter.</p>
            <p>Try clearing filters or run a scan on a pull request.</p>
          </div>
        ) : (
          filteredFindings.map((f) => (
            <div
              key={f.id}
              onClick={() => onSelectFinding(f)}
              className="bg-navy-900 border border-navy-800 hover:border-navy-750 p-5 rounded-2xl transition-all cursor-pointer space-y-3 shadow-sm group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-navy-850 text-slate-300 border border-navy-800">
                    {f.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      f.severity === 'high'
                        ? 'bg-sentinel-rose/20 text-sentinel-rose border border-sentinel-rose/40'
                        : f.severity === 'medium'
                        ? 'bg-sentinel-amber/20 text-sentinel-amber border border-sentinel-amber/40'
                        : 'bg-sentinel-cyan/20 text-sentinel-cyan border border-sentinel-cyan/40'
                    }`}
                  >
                    {f.severity}
                  </span>
                  <span className="text-[10px] font-mono font-semibold uppercase text-slate-400 px-2 py-0.5 rounded bg-navy-850 border border-navy-800">
                    {f.category}
                  </span>

                  {f.review_status && f.review_status !== 'open' && (
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded flex items-center gap-1 ${
                        f.review_status === 'reviewed'
                          ? 'bg-sentinel-emerald/20 text-sentinel-emerald border border-sentinel-emerald/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
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

                  <h3 className="text-sm font-semibold text-white tracking-tight group-hover:text-sentinel-cyan transition-colors">
                    {f.title}
                  </h3>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-mono text-[11px]">{f.confidence} confidence</span>
                  <span className="text-sentinel-cyan group-hover:underline flex items-center gap-1 font-medium text-[11px]">
                    Inspect & Triage <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{f.summary}</p>

              {/* Source Reference Chips */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                {f.changed_file && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy-850 text-slate-300 border border-navy-800 font-mono text-[11px]">
                    <Code2 className="w-3 h-3 text-sentinel-amber" />
                    <span className="text-slate-500">Changed:</span>
                    <span className="text-sentinel-cyan">
                      {f.changed_file.path}:{f.changed_file.line}
                    </span>
                  </div>
                )}
                {f.affected_file && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy-850 text-slate-300 border border-navy-800 font-mono text-[11px]">
                    <FileCode className="w-3 h-3 text-sentinel-rose" />
                    <span className="text-slate-500">Consumer:</span>
                    <span className="text-sentinel-rose">
                      {f.affected_file.path}:{f.affected_file.line}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy-850 text-slate-300 border border-navy-800 text-[11px]">
                  <span className="text-slate-500">Tests:</span>
                  <span
                    className={
                      f.test_evidence === 'found' ? 'text-sentinel-emerald font-semibold' : 'text-sentinel-amber'
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
