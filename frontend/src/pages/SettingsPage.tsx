import React, { useState } from 'react';
import {
  Settings,
  Cpu,
  Terminal,
  CheckCircle2,
  Github,
  User,
  Lock,
  ExternalLink,
  Sparkles,
  KeyRound,
  AlertCircle,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { UserProfile, GitHubAccount } from '../types';

interface SettingsPageProps {
  user: UserProfile | null;
  githubAccount: GitHubAccount | null;
  onLogout: () => void;
  onConnectGitHub: () => void;
  onConnectToken?: (token: string) => Promise<void>;
  onDisconnectGitHub?: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  githubAccount,
  onLogout,
  onConnectGitHub,
  onConnectToken,
  onDisconnectGitHub,
}) => {
  const isGitHubConnected = !!(githubAccount && githubAccount.github_username);
  const [tokenInput, setTokenInput] = useState('');
  const [isConnectingToken, setIsConnectingToken] = useState(false);
  const [tokenSuccessMsg, setTokenSuccessMsg] = useState<string | null>(null);
  const [tokenErrorMsg, setTokenErrorMsg] = useState<string | null>(null);

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || !onConnectToken) return;

    setIsConnectingToken(true);
    setTokenErrorMsg(null);
    setTokenSuccessMsg(null);

    try {
      await onConnectToken(tokenInput.trim());
      setTokenSuccessMsg('GitHub token connected successfully! Your repositories are now loaded.');
      setTokenInput('');
    } catch (err: any) {
      setTokenErrorMsg(err.message || 'Failed to authenticate token with GitHub.');
    } finally {
      setIsConnectingToken(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnectGitHub) return;
    try {
      await onDisconnectGitHub();
      setTokenSuccessMsg('GitHub account disconnected.');
    } catch (err: any) {
      setTokenErrorMsg(err.message || 'Failed to disconnect.');
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto text-xs text-[#D1D5DC]">
      <div>
        <h1 className="text-xl font-bold text-[#F5F6F8] tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#896EFF]" />
          Platform Settings & GitHub Authentication
        </h1>
        <p className="text-xs text-[#9299A5] mt-1">
          Identity, live GitHub repository authorization, threat models, and static analysis constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Account & Session Card */}
        <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-[#F5F6F8] text-sm">
              <User className="w-4 h-4 text-[#896EFF]" />
              <span>User Identity & Session</span>
            </div>
            {user?.is_demo && (
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Demo Sandbox
              </span>
            )}
          </div>

          <div className="space-y-2.5 font-mono text-[11px]">
            <div className="flex justify-between py-1.5 border-b border-[#1C2028]">
              <span className="text-[#9299A5]">Name:</span>
              <span className="text-[#F5F6F8] font-sans">{user?.name || 'Developer'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1C2028]">
              <span className="text-[#9299A5]">Email:</span>
              <span className="text-[#D1D5DC]">{user?.email || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#1C2028]">
              <span className="text-[#9299A5]">Auth Method:</span>
              <span className="text-[#896EFF] uppercase font-semibold">{user?.auth_provider || 'DEMO'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#9299A5]">Session Security:</span>
              <span className="text-[#10B981]">HttpOnly / HMAC Signed</span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full py-2 px-3 rounded-xl bg-[#F04452]/10 hover:bg-[#F04452]/20 border border-[#F04452]/30 text-[#F04452] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Session & Sign Out</span>
          </button>
        </div>

        {/* GitHub App & Token Authorization Card */}
        <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-[#F5F6F8] text-sm">
              <Github className="w-4 h-4 text-[#F5F6F8]" />
              <span>GitHub Account & Repositories</span>
            </div>
            <span
              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                isGitHubConnected
                  ? 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                  : 'bg-[#1B1F27] text-[#9299A5] border border-[#252932]'
              }`}
            >
              {isGitHubConnected ? 'Live Connected' : 'Unlinked'}
            </span>
          </div>

          <div className="space-y-2 font-mono text-[11px]">
            <div className="flex justify-between py-1 border-b border-[#1C2028]">
              <span className="text-[#9299A5]">Connected User:</span>
              <span className="text-[#D1D5DC]">
                {githubAccount?.github_username ? `@${githubAccount.github_username}` : 'None'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#1C2028]">
              <span className="text-[#9299A5]">Authorized Repos:</span>
              <span className="text-[#896EFF] font-bold">
                {githubAccount?.authorized_repos?.length || 0} repositories
              </span>
            </div>
          </div>

          {/* Messages */}
          {tokenSuccessMsg && (
            <div className="p-2.5 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{tokenSuccessMsg}</span>
            </div>
          )}

          {tokenErrorMsg && (
            <div className="p-2.5 rounded-lg bg-[#F04452]/15 border border-[#F04452]/30 text-[#F04452] text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{tokenErrorMsg}</span>
            </div>
          )}

          {/* Token Connection Form */}
          <form onSubmit={handleTokenSubmit} className="space-y-2 pt-1 border-t border-[#1C2028]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#D1D5DC] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#896EFF]" />
                <span>Personal Access Token (PAT)</span>
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=REGRAVA%20Security%20Scanner"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-[#896EFF] hover:underline flex items-center gap-1"
              >
                <span>Generate token on GitHub</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="flex gap-2">
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl bg-[#15181F] border border-[#252932] text-[#F5F6F8] placeholder-[#707783] font-mono text-[11px] focus:outline-none focus:border-[#7657FF]"
              />
              <button
                type="submit"
                disabled={isConnectingToken || !tokenInput.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-[#7657FF] hover:bg-[#896EFF] text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${isConnectingToken ? 'animate-spin' : ''}`} />
                <span>{isConnectingToken ? 'Verifying...' : 'Connect Token'}</span>
              </button>
            </div>
            <p className="text-[10px] text-[#707783]">
              Requires <code>repo</code> and <code>read:user</code> scopes to inspect pull requests and diffs.
            </p>
          </form>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              onClick={onConnectGitHub}
              className="flex-1 py-2 px-3 rounded-xl bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[#F5F6F8] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>{isGitHubConnected ? 'Re-authorize OAuth' : 'Authorize via GitHub OAuth'}</span>
            </button>

            {isGitHubConnected && onDisconnectGitHub && (
              <button
                onClick={handleDisconnect}
                className="py-2 px-3 rounded-xl bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[#F04452] text-xs font-semibold transition-colors"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Engine & Security Policies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Constraints */}
        <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 shadow-xl">
          <div className="flex items-center gap-2 font-bold text-[#F5F6F8] text-sm">
            <Cpu className="w-4 h-4 text-[#896EFF]" />
            <span>Analysis Boundaries & Parsers</span>
          </div>
          <div className="space-y-2.5 font-mono text-[11px]">
            <div className="flex justify-between py-1 border-b border-[#1C2028]">
              <span className="text-[#9299A5]">Max File Size:</span>
              <span className="text-[#F5F6F8]">1,048,576 bytes (1 MB)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#1C2028]">
              <span className="text-[#9299A5]">AST Python Parser:</span>
              <span className="text-[#D1D5DC]">Python standard <code>ast</code></span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#1C2028]">
              <span className="text-[#9299A5]">TypeScript / React Parser:</span>
              <span className="text-[#D1D5DC]">TypeScript AST Compiler API</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#1C2028]">
              <span className="text-[#9299A5]">Secret Scanner:</span>
              <span className="text-[#D1D5DC]">Entropy & RegEx with automatic redaction</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#9299A5]">Dependency Auditor:</span>
              <span className="text-[#D1D5DC]">Direct requirement version comparison</span>
            </div>
          </div>
        </div>

        {/* Security Safeguards & Privacy */}
        <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 shadow-xl">
          <div className="flex items-center gap-2 font-bold text-[#F5F6F8] text-sm">
            <Lock className="w-4 h-4 text-[#10B981]" />
            <span>Zero-Retention Privacy Guarantee</span>
          </div>
          <ul className="space-y-2.5 text-[#D1D5DC]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
              <span>
                <strong>Zero-code execution:</strong> Target code is parsed as abstract syntax trees; it is never imported, compiled, or executed.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
              <span>
                <strong>In-memory analysis:</strong> Code diffs are held ephemeral in-memory; no client code is retained permanently.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
              <span>
                <strong>No external model training:</strong> Code is not sent to external LLMs for training.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
              <span>
                <strong>Automated secret redaction:</strong> API keys and credentials are automatically masked before presentation.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* CLI Documentation snippet */}
      <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-3 shadow-xl">
        <div className="flex items-center gap-2 font-bold text-[#F5F6F8] text-sm">
          <Terminal className="w-4 h-4 text-[#896EFF]" />
          <span>CLI & CI/CD GitHub Action Usage</span>
        </div>
        <pre className="p-4 rounded-xl bg-[#08090C] border border-[#1C2028] font-mono text-[#D1D5DC] overflow-x-auto text-[11px] leading-relaxed">
          <code>{`# Run REGRAVA deterministic security and regression scanner locally
regrava scan --repo . --base main --head HEAD

# Run in GitHub Actions and output markdown report for PR review
regrava scan --repo . --base origin/main --head HEAD --format markdown --output review.md

# Fail CI pipeline if high-severity vulnerability or breaking contract is detected
regrava scan --repo . --fail-on high`}</code>
        </pre>
      </div>
    </div>
  );
};
