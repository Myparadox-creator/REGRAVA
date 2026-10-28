import React from 'react';
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
} from 'lucide-react';
import { UserProfile, GitHubAccount } from '../types';

interface SettingsPageProps {
  user: UserProfile | null;
  githubAccount: GitHubAccount | null;
  onLogout: () => void;
  onConnectGitHub: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  githubAccount,
  onLogout,
  onConnectGitHub,
}) => {
  const isGitHubConnected = !!(githubAccount && githubAccount.github_username);

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto text-xs text-slate-300">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-sentinel-cyan" />
          Platform Settings & Engine Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Identity, repository authorization, threat models, and static analysis constraints.
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
            className="w-full py-2 px-3 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-750 text-sentinel-rose text-xs font-semibold transition-colors"
          >
            End Session & Sign Out
          </button>
        </div>

        {/* GitHub App Integration Card */}
        <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <Github className="w-4 h-4 text-white" />
              <span>GitHub App Authorization</span>
            </div>
            <span
              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                isGitHubConnected
                  ? 'bg-sentinel-emerald/20 text-sentinel-emerald border border-sentinel-emerald/30'
                  : 'bg-navy-800 text-slate-400'
              }`}
            >
              {isGitHubConnected ? 'Connected' : 'Unlinked'}
            </span>
          </div>

          <div className="space-y-2.5 font-mono text-[11px]">
            <div className="flex justify-between py-1.5 border-b border-navy-800">
              <span className="text-slate-400">GitHub User:</span>
              <span className="text-slate-200">
                {githubAccount?.github_username ? `@${githubAccount.github_username}` : 'None'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-navy-800">
              <span className="text-slate-400">Installation ID:</span>
              <span className="text-slate-200">{githubAccount?.installation_id || 'demo-inst-01'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-navy-800">
              <span className="text-slate-400">Authorized Repos:</span>
              <span className="text-sentinel-cyan">
                {githubAccount?.authorized_repos?.length || 0} repositories
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Permission Scope:</span>
              <span className="text-slate-300">Read-only (Pull Requests, Diffs)</span>
            </div>
          </div>

          <button
            onClick={onConnectGitHub}
            className="w-full py-2 px-3 rounded-xl bg-sentinel-cyan/15 hover:bg-sentinel-cyan/25 border border-sentinel-cyan/30 text-sentinel-cyan text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <span>{isGitHubConnected ? 'Update GitHub App Permissions' : 'Connect GitHub App'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
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
              <span className="text-slate-200">Python 3 standard <code>ast</code></span>
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
