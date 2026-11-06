import React from 'react';
import {
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
    <header className="h-16 bg-[#0B0D11] border-b border-[#1C2028] px-6 flex items-center justify-between shrink-0 select-none">
      {/* Brand & Tagline */}
      <div className="flex items-center gap-3">
        <img
          src="/regrava-icon.png"
          alt="REGRAVA"
          className="w-8 h-8 rounded-lg object-contain shadow-sm border border-[#252932] bg-[#08090C]"
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#F5F6F8] text-base tracking-tight font-sans">
              REGRAVA
            </span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#15181F] text-[#9299A5] border border-[#252932]">
              v2.0
            </span>
            {user?.is_demo && (
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Demo Mode
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#707783] font-medium">
            Review &bull; Track &bull; Verify &bull; Merge with Confidence
          </div>
        </div>
      </div>

      {/* User & GitHub Connection Status */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            {/* GitHub Account Badge */}
            {isConnected ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111318] border border-[#252932] text-xs">
                <Github className="w-3.5 h-3.5 text-[#D1D5DC]" />
                <span className="text-[#D1D5DC] font-mono text-[11px]">
                  @{githubAccount?.github_username}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              </div>
            ) : (
              <button
                onClick={onOpenGitHubSetup}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#15181F] hover:bg-[#1B1F27] text-[#F5F6F8] border border-[#252932] text-xs font-medium transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                <span>Connect GitHub</span>
              </button>
            )}

            {/* User Profile Pill */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-[#1C2028]">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-[#252932]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#1B1F27] border border-[#252932] flex items-center justify-center font-bold text-xs text-[#896EFF]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left text-xs">
                <div className="font-semibold text-[#F5F6F8] leading-none">{user.name}</div>
                <div className="text-[10px] text-[#707783] leading-tight mt-0.5">{user.email}</div>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-[#9299A5] hover:text-[#F5F6F8] hover:bg-[#15181F] border border-transparent hover:border-[#252932] transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={onSwitchToDemo}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#7657FF] hover:bg-[#896EFF] text-white font-semibold text-xs transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Launch Demo Mode</span>
          </button>
        )}
      </div>
    </header>
  );
};
