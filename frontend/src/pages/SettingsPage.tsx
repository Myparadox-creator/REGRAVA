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
    <div className="p-8 space-y-8 max-w-5xl mx-auto text-xs text-slate-300">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-sentinel-cyan" />
          Platform Settings & GitHub Authentication
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Identity, live GitHub repository authorization, threat models, and static analysis constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Account & Session Card */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <User className="w-4 h-4 text-sentinel-cyan" />
              <span>User Identity & Session</span>
            </div>
            {user?.is_demo && (
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-sentinel-amber/15 text-sentinel-amber border border-sentinel-amber/30 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Demo Sandbox
              </span>
            )}
          </div>

          <div className="space-y-2.5 font-mono text-[11px]">
            <div className="flex justify-between py-1.5 border-b border-navy-800">
              <span className="text-slate-400">Name:</span>
              <span className="text-slate-200 font-sans">{user?.name || 'Developer'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-navy-800">
              <span className="text-slate-400">Email:</span>
              <span className="text-slate-200">{user?.email || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-navy-800">
              <span className="text-slate-400">Auth Method:</span>
              <span className="text-sentinel-cyan uppercase">{user?.auth_provider || 'DEMO'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Session Security:</span>
              <span className="text-sentinel-emerald">HttpOnly / HMAC Signed</span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full py-2 px-3 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-750 text-sentinel-rose text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Session & Sign Out</span>
          </button>
        </div>

        {/* GitHub App & Token Authorization Card */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <Github className="w-4 h-4 text-white" />
              <span>GitHub Account & Repositories</span>
            </div>
            <span
              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                isGitHubConnected
                  ? 'bg-sentinel-emerald/20 text-sentinel-emerald border border-sentinel-emerald/30'
                  : 'bg-navy-800 text-slate-400'
              }`}
            >
              {isGitHubConnected ? 'Live Connected' : 'Unlinked'}
            </span>
          </div>

          <div className="space-y-2 font-mono text-[11px]">
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">Connected User:</span>
              <span className="text-slate-200">
                {githubAccount?.github_username ? `@${githubAccount.github_username}` : 'None'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">Authorized Repos:</span>
              <span className="text-sentinel-cyan font-bold">
                {githubAccount?.authorized_repos?.length || 0} repositories
              </span>
            </div>
          </div>

          {/* Messages */}
          {tokenSuccessMsg && (
            <div className="p-2.5 rounded-lg bg-sentinel-emerald/15 border border-sentinel-emerald/30 text-sentinel-emerald text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{tokenSuccessMsg}</span>
            </div>
          )}

          {tokenErrorMsg && (
            <div className="p-2.5 rounded-lg bg-sentinel-rose/15 border border-sentinel-rose/30 text-sentinel-rose text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{tokenErrorMsg}</span>
            </div>
          )}

          {/* Token Connection Form */}
          <form onSubmit={handleTokenSubmit} className="space-y-2 pt-1 border-t border-navy-800">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-sentinel-cyan" />
                <span>Personal Access Token (PAT)</span>
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=REGRAVA%20Security%20Scanner"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-sentinel-cyan hover:underline flex items-center gap-1"
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
                className="flex-1 px-3 py-1.5 rounded-xl bg-navy-850 border border-navy-750 text-slate-200 placeholder-slate-500 font-mono text-[11px] focus:outline-none focus:border-sentinel-cyan"
              />
              <button
                type="submit"
                disabled={isConnectingToken || !tokenInput.trim()}
                className="px-3 py-1.5 rounded-xl bg-sentinel-cyan hover:bg-cyan-400 text-navy-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${isConnectingToken ? 'animate-spin' : ''}`} />
                <span>{isConnectingToken ? 'Verifying...' : 'Connect Token'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Requires <code>repo</code> and <code>read:user</code> scopes to inspect pull requests and diffs.
            </p>
          </form>

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              onClick={onConnectGitHub}
              className="flex-1 py-2 px-3 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>{isGitHubConnected ? 'Re-authorize OAuth' : 'Authorize via GitHub OAuth'}</span>
            </button>

            {isGitHubConnected && onDisconnectGitHub && (
              <button
                onClick={handleDisconnect}
                className="py-2 px-3 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-700 text-sentinel-rose text-xs font-semibold transition-colors"
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
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Cpu className="w-4 h-4 text-sentinel-cyan" />
            <span>Analysis Boundaries & Parsers</span>
          </div>
          <div className="space-y-2.5 font-mono text-[11px]">
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">Max File Size:</span>
              <span className="text-slate-200">1,048,576 bytes (1 MB)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">AST Python Parser:</span>
              <span className="text-slate-200">Python standard <code>ast</code></span>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">TypeScript / React Parser:</span>
              <span className="text-slate-200">TypeScript AST Compiler API</span>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">Secret Scanner:</span>
              <span className="text-slate-200">Entropy & RegEx with automatic redaction</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Dependency Auditor:</span>
              <span className="text-slate-200">Direct requirement version comparison</span>
            </div>
          </div>
        </div>

        {/* Security Safeguards & Privacy */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Lock className="w-4 h-4 text-sentinel-emerald" />
            <span>Zero-Retention Privacy Guarantee</span>
          </div>
          <ul className="space-y-2.5 text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-sentinel-emerald shrink-0 mt-0.5" />
              <span>
                <strong>Zero-code execution:</strong> Target code is parsed as abstract syntax trees; it is never imported, compiled, or executed.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-sentinel-emerald shrink-0 mt-0.5" />
              <span>
                <strong>In-memory analysis:</strong> Code diffs are held ephemeral in-memory; no client code is retained permanently.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-sentinel-emerald shrink-0 mt-0.5" />
              <span>
                <strong>No external model training:</strong> Code is not sent to external LLMs for training.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-sentinel-emerald shrink-0 mt-0.5" />
              <span>
                <strong>Automated secret redaction:</strong> API keys and credentials are automatically masked before presentation.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* CLI Documentation snippet */}
      <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-3">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <Terminal className="w-4 h-4 text-sentinel-cyan" />
          <span>CLI & CI/CD GitHub Action Usage</span>
        </div>
        <pre className="p-4 rounded-xl bg-navy-950 border border-navy-800 font-mono text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
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
