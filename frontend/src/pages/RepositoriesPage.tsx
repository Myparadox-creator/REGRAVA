import React from 'react';
import {
  FolderGit2,
  GitPullRequest,
  Lock,
  Globe,
  Plus,
  RefreshCw,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';
import { RepositoryItem } from '../types';

interface RepositoriesPageProps {
  repositories: RepositoryItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectRepo: (repo: RepositoryItem) => void;
  onConnectGitHub: () => void;
}

export const RepositoriesPage: React.FC<RepositoriesPageProps> = ({
  repositories,
  isLoading,
  onRefresh,
  onSelectRepo,
  onConnectGitHub,
}) => {
  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-navy-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-sentinel-cyan" />
            Connected Repositories
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Repositories authorized via GitHub App for pull-request security and contract analysis.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-300 transition-colors disabled:opacity-50"
            title="Refresh repositories"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onConnectGitHub}
            className="px-3.5 py-2 rounded-xl bg-sentinel-cyan/15 hover:bg-sentinel-cyan/25 border border-sentinel-cyan/30 text-sentinel-cyan text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Authorize More Repositories</span>
          </button>
        </div>
      </div>

      {/* Repositories List or Empty State */}
      {repositories.length === 0 ? (
        <div className="p-12 rounded-2xl bg-navy-900 border border-navy-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-navy-850 border border-navy-750 flex items-center justify-center mx-auto text-slate-400">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">No Repositories Authorized</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Install the REGRAVA GitHub App on your personal account or organization to grant
              read-only access to select repositories.
            </p>
          </div>
          <button
            onClick={onConnectGitHub}
            className="px-4 py-2 rounded-xl bg-sentinel-cyan text-navy-950 font-bold text-xs shadow-lg shadow-cyan-950/50"
          >
            Connect GitHub App
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {repositories.map((repo) => (
            <div
              key={repo.id}
              className="p-5 rounded-2xl bg-navy-900 border border-navy-800 hover:border-navy-750 transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                {/* Title & Privacy Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">
                      {repo.full_name}
                    </span>
                    {repo.is_private ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-navy-800 text-slate-400 border border-navy-750">
                        <Lock className="w-2.5 h-2.5" />
                        Private
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-navy-800 text-slate-400 border border-navy-750">
                        <Globe className="w-2.5 h-2.5" />
                        Public
                      </span>
                    )}
                  </div>

                  <span className="flex items-center gap-1 text-[10px] font-semibold text-sentinel-emerald">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Authorized
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 line-clamp-2">
                  {repo.description || 'FastAPI backend with React client. High-assurance microservice.'}
                </p>
              </div>

              {/* Metadata & Actions */}
              <div className="pt-3 border-t border-navy-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <GitBranch className="w-3 h-3 text-slate-500" />
                    {repo.default_branch}
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <GitPullRequest className="w-3 h-3 text-sentinel-cyan" />
                    {repo.open_pull_requests_count} open PR
                  </span>
                </div>

                <button
                  onClick={() => onSelectRepo(repo)}
                  className="px-3 py-1.5 rounded-lg bg-navy-850 hover:bg-navy-800 border border-navy-700 text-sentinel-cyan font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <span>Inspect PRs</span>
                  <GitPullRequest className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
