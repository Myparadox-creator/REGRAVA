import React from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  FolderGit2,
  GitPullRequest,
  ShieldAlert,
  History,
  Settings,
  Circle,
  Github,
} from 'lucide-react';
import { GitHubAccount, UserProfile } from '../types';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  openFindingsCount: number;
  githubAccount: GitHubAccount | null;
  user: UserProfile | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  openFindingsCount,
  githubAccount,
  user: _user,
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'security', label: 'Security Health', icon: ShieldCheck },
    { id: 'repos', label: 'Repositories', icon: FolderGit2 },
    { id: 'pulls', label: 'Pull Requests', icon: GitPullRequest },
    {
      id: 'findings',
      label: 'Security Findings',
      icon: ShieldAlert,
      badge: openFindingsCount > 0 ? openFindingsCount : undefined,
    },
    { id: 'history', label: 'Analysis History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isGitHubConnected = !!(githubAccount && githubAccount.github_username);

  return (
    <aside className="w-60 bg-navy-900 border-r border-navy-800 flex flex-col justify-between shrink-0 select-none">
      <div className="p-3 space-y-5">
        {/* Brand Banner Lockup */}
        <div className="px-2 pt-1 pb-3 flex items-center gap-2.5 border-b border-navy-800">
          <img
            src="/regrava-icon.png"
            alt="REGRAVA"
            className="w-7 h-7 rounded-lg object-contain shadow-sm border border-navy-750 bg-navy-950"
          />
          <div className="flex flex-col">
            <span className="font-bold text-white text-xs tracking-tight font-sans">REGRAVA</span>
            <span className="text-[9px] text-slate-400 font-medium">Static Security Engine</span>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-500 px-3 py-1 tracking-wider">
            Platform
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-sentinel-cyan/15 text-sentinel-cyan border border-sentinel-cyan/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-navy-850'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sentinel-cyan' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-sentinel-rose/20 text-sentinel-rose border border-sentinel-rose/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Integration Status Footer */}
      <div className="p-3 border-t border-navy-800 space-y-2">
        <div className="p-2.5 rounded-lg bg-navy-850 border border-navy-800 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Github className="w-3 h-3 text-slate-300" />
              GitHub App
            </span>
            <span
              className={`font-mono text-[10px] font-semibold uppercase ${
                isGitHubConnected ? 'text-sentinel-emerald' : 'text-slate-500'
              }`}
            >
              {isGitHubConnected ? 'Active' : 'Unlinked'}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {isGitHubConnected
              ? `${githubAccount?.authorized_repos?.length || 0} repos authorized`
              : 'Read-only analyzer ready'}
          </div>
        </div>

        <div className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-500 font-mono">
          <span>Engine: AST & Static</span>
          <span className="flex items-center gap-1 text-sentinel-emerald">
            <Circle className="w-1.5 h-1.5 fill-current" />
            Online
          </span>
        </div>
      </div>
    </aside>
  );
};
