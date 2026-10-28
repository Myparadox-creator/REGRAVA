import React from 'react';
import {
  ShieldAlert,
  LogOut,
  Sparkles,
  Github,
} from 'lucide-react';
import { UserProfile, GitHubAccount } from '../types';

interface HeaderProps {
  user: UserProfile | null;
  githubAccount: GitHubAccount | null;
  onLogout: () => void;
  onOpenGitHubSetup: () => void;
  onSwitchToDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  githubAccount,
  onLogout,
  onOpenGitHubSetup,
  onSwitchToDemo,
}) => {
  const isConnected = !!(githubAccount && githubAccount.github_username);

  return (
    <header className="h-16 bg-navy-900 border-b border-navy-800 px-6 flex items-center justify-between shrink-0 select-none">
      {/* Brand & Tagline */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-sentinel-cyan/15 border border-sentinel-cyan/30 flex items-center justify-center text-sentinel-cyan">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base tracking-tight font-sans">
              REGRAVA
            </span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-navy-800 text-slate-300 border border-navy-700">
              v2.0
            </span>
            {user?.is_demo && (
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-sentinel-amber/15 text-sentinel-amber border border-sentinel-amber/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Demo Mode
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Catch what your diff could break.
          </div>
        </div>
      </div>

      {/* User & GitHub Connection Status */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            {/* GitHub Account Badge */}
            {isConnected ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-navy-850 border border-navy-800 text-xs">
                <Github className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-slate-300 font-mono text-[11px]">
                  @{githubAccount?.github_username}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-sentinel-emerald" />
              </div>
            ) : (
              <button
                onClick={onOpenGitHubSetup}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 text-slate-200 border border-navy-700 text-xs font-medium transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                <span>Connect GitHub</span>
              </button>
            )}

            {/* User Profile Pill */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-navy-800">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-navy-700"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center font-bold text-xs text-sentinel-cyan">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left text-xs">
                <div className="font-semibold text-white leading-none">{user.name}</div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{user.email}</div>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={onSwitchToDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sentinel-cyan hover:bg-sentinel-cyan/90 text-navy-950 font-bold text-xs transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Launch Demo Mode</span>
          </button>
        )}
      </div>
    </header>
  );
};
