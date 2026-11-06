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
  onAnalyzeSecurity?: (repoFullName: string) => void;
}

export const RepositoriesPage: React.FC<RepositoriesPageProps> = ({
  repositories,
  isLoading,
  onRefresh,
  onSelectRepo,
  onConnectGitHub,
  onAnalyzeSecurity,
}) => {
  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1C2028]">
        <div>
          <h1 className="text-xl font-bold text-[#F5F6F8] tracking-tight flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-[#896EFF]" />
            Connected Repositories
          </h1>
          <p className="text-xs text-[#9299A5] mt-1">
            Repositories authorized via GitHub App for pull-request security and contract analysis.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[#D1D5DC] transition-colors disabled:opacity-50"
            title="Refresh repositories"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onConnectGitHub}
            className="px-3.5 py-2 rounded-xl bg-[#7657FF] hover:bg-[#896EFF] text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Authorize More Repositories</span>
          </button>
        </div>
      </div>

      {/* Repositories List or Empty State */}
      {repositories.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#111318] border border-[#252932] text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#15181F] border border-[#252932] flex items-center justify-center mx-auto text-[#707783]">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#F5F6F8]">No Repositories Authorized</h3>
            <p className="text-xs text-[#9299A5] max-w-md mx-auto">
              Install the REGRAVA GitHub App on your personal account or organization to grant
              read-only access to select repositories.
            </p>
          </div>
          <button
            onClick={onConnectGitHub}
            className="px-4 py-2 rounded-xl bg-[#7657FF] text-white font-bold text-xs shadow-md shadow-purple-950/50 hover:bg-[#896EFF] transition-colors"
          >
            Connect GitHub App
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {repositories.map((repo) => (
            <div
              key={repo.id}
              className="p-5 rounded-2xl bg-[#111318] border border-[#252932] hover:border-[#454B58] transition-all space-y-4 flex flex-col justify-between shadow-md"
            >
              <div className="space-y-2">
                {/* Title & Privacy Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-[#F5F6F8]">
                      {repo.full_name}
                    </span>
                    {repo.is_private ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[#1B1F27] text-[#9299A5] border border-[#252932]">
                        <Lock className="w-2.5 h-2.5" />
                        Private
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-[#1B1F27] text-[#9299A5] border border-[#252932]">
                        <Globe className="w-2.5 h-2.5" />
                        Public
                      </span>
                    )}
                  </div>

                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#10B981]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Authorized
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-[#9299A5] line-clamp-2">
                  {repo.description || 'FastAPI backend with React client. High-assurance microservice.'}
                </p>
              </div>

              {/* Metadata & Actions */}
              <div className="pt-3 border-t border-[#1C2028] flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-[#9299A5]">
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <GitBranch className="w-3 h-3 text-[#707783]" />
                    {repo.default_branch}
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <GitPullRequest className="w-3 h-3 text-[#896EFF]" />
                    {repo.open_pull_requests_count} open PR
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {onAnalyzeSecurity && (
                    <button
                      onClick={() => onAnalyzeSecurity(repo.full_name)}
                      className="px-3 py-1.5 rounded-lg bg-[#211A35] hover:bg-[#2c2247] border border-[#48366F] text-[#896EFF] font-semibold text-xs flex items-center gap-1.5 transition-colors"
                      title="Analyze repository security posture and 7-layer health checks"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Security Health</span>
                    </button>
                  )}

                  <button
                    onClick={() => onSelectRepo(repo)}
                    className="px-3 py-1.5 rounded-lg bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[#D1D5DC] hover:text-[#F5F6F8] font-semibold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <span>Inspect PRs</span>
                    <GitPullRequest className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
