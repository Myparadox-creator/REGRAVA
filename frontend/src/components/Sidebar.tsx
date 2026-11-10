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
  X,
  Menu,
} from 'lucide-react';
import { GitHubAccount, UserProfile } from '../types';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  openFindingsCount: number;
  githubAccount: GitHubAccount | null;
  user: UserProfile | null;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  openFindingsCount,
  githubAccount,
  user: _user,
  isMobileOpen = false,
  onCloseMobile,
  onOpenMobile,
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

  const bottomNavItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'repos', label: 'Repos', icon: FolderGit2 },
    { id: 'pulls', label: 'PRs', icon: GitPullRequest },
    {
      id: 'findings',
      label: 'Findings',
      icon: ShieldAlert,
      badge: openFindingsCount > 0 ? openFindingsCount : undefined,
    },
  ];

  const isGitHubConnected = !!(githubAccount && githubAccount.github_username);

  const handleSelectTab = (tabId: string) => {
    onTabChange(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const renderNavContent = () => (
    <>
      <div className="p-3.5 space-y-5">
        {/* Brand Banner Lockup */}
        <div className="px-2 pt-1 pb-3 flex items-center justify-between border-b border-[#1C2028]">
          <div className="flex items-center gap-2.5">
            <img
              src="/regrava-icon.png"
              alt="REGRAVA"
              className="w-7 h-7 rounded-lg object-contain shadow-sm border border-[#252932] bg-[#08090C]"
            />
            <div className="flex flex-col">
              <span className="font-bold text-[#F5F6F8] text-xs tracking-tight font-sans">REGRAVA</span>
              <span className="text-[9px] text-[#707783] font-medium tracking-wide">Static Security Engine</span>
            </div>
          </div>
          {/* Close button inside mobile drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-[#9299A5] hover:text-[#F5F6F8] hover:bg-[#15181F] md:hidden transition-colors"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-[#707783] px-3 py-1 tracking-wider">
            Platform
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#211A35] text-[#F5F6F8] border border-[#48366F] font-semibold shadow-sm'
                    : 'text-[#9299A5] hover:text-[#F5F6F8] hover:bg-[#15181F] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-[#896EFF]' : 'text-[#707783]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-[#F04452]/15 text-[#F04452] border border-[#F04452]/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Integration Status Footer */}
      <div className="p-3.5 border-t border-[#1C2028] space-y-2">
        <div className="p-2.5 rounded-xl bg-[#111318] border border-[#1C2028] text-[11px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[#9299A5] flex items-center gap-1.5 font-medium">
              <Github className="w-3 h-3 text-[#D1D5DC]" />
              GitHub App
            </span>
            <span
              className={`font-mono text-[10px] font-semibold uppercase ${
                isGitHubConnected ? 'text-[#10B981]' : 'text-[#707783]'
              }`}
            >
              {isGitHubConnected ? 'Active' : 'Unlinked'}
            </span>
          </div>
          <div className="text-[10px] text-[#707783] truncate">
            {isGitHubConnected
              ? `${githubAccount?.authorized_repos?.length || 0} repos authorized`
              : 'Read-only analyzer ready'}
          </div>
        </div>

        <div className="flex items-center justify-between px-2 py-1 text-[10px] text-[#707783] font-mono">
          <span>Engine: AST & Static</span>
          <span className="flex items-center gap-1 text-[#10B981]">
            <Circle className="w-1.5 h-1.5 fill-current" />
            Online
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* 1. Desktop Fixed Sidebar */}
      <aside className="w-60 bg-[#0B0D11] border-r border-[#1C2028] hidden md:flex flex-col justify-between shrink-0 select-none">
        {renderNavContent()}
      </aside>

      {/* 2. Mobile Drawer Backdrop & Slide-out Panel */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Menu */}
          <aside className="relative z-50 w-72 max-w-[85vw] h-full bg-[#0B0D11] border-r border-[#1C2028] flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200 select-none">
            {renderNavContent()}
          </aside>
        </div>
      )}

      {/* 3. Mobile Bottom Navigation Bar (Thumb-friendly touch bar) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0D11]/95 backdrop-blur-xl border-t border-[#1C2028] px-2 py-1.5 flex items-center justify-around select-none safe-bottom"
      >
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors relative min-w-[52px] ${
                isActive ? 'text-[#896EFF]' : 'text-[#707783] hover:text-[#D1D5DC]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-[#896EFF]' : 'text-[#707783]'}`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 text-[8px] font-bold rounded-full bg-[#F04452] text-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`tracking-tight ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
            </button>
          );
        })}

        {/* More / Menu Drawer Toggle button on bottom bar */}
        <button
          onClick={onOpenMobile}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors min-w-[52px] ${
            isMobileOpen || currentTab === 'history' || currentTab === 'settings'
              ? 'text-[#896EFF]'
              : 'text-[#707783] hover:text-[#D1D5DC]'
          }`}
          aria-label="Open more menu"
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span className="tracking-tight">More</span>
        </button>
      </nav>
    </>
  );
};
