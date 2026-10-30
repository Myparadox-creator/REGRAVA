import React, { useState } from 'react';
import {
  ShieldAlert,
  Sparkles,
  Github,
  Lock,
  ArrowRight,
  Cpu,
  Layers,
  FileCode,
  AlertCircle,
  KeyRound,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { getGoogleAuthUrl, getGitHubAuthUrl } from '../services/api';

interface AuthPageProps {
  onLoginDemo: () => Promise<void>;
  isLoggingIn: boolean;
  onConnectToken?: (token: string) => Promise<void>;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onLoginDemo,
  isLoggingIn,
  onConnectToken,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isConnectingToken, setIsConnectingToken] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    try {
      const res = await getGoogleAuthUrl();
      if (res.is_configured && res.url) {
        window.location.href = res.url;
      } else {
        setErrorMsg(
          'Google OAuth client credentials are not configured in environment (.env). Please use the 1-Click Demo Sandbox or GitHub Token below to test all features instantly!'
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize Google authentication');
    }
  };

  const handleGitHubLogin = async () => {
    setErrorMsg(null);
    try {
      const res = await getGitHubAuthUrl();
      if (res.is_configured && res.url) {
        window.location.href = res.url;
      } else {
        setErrorMsg(
          'GitHub App credentials are not configured in environment (.env). You can sign in directly using a GitHub Token below, or explore the 1-Click Demo Sandbox!'
        );
        setShowTokenForm(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize GitHub authentication');
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || !onConnectToken) return;

    setIsConnectingToken(true);
    setErrorMsg(null);

    try {
      await onConnectToken(tokenInput.trim());
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate with GitHub token');
    } finally {
      setIsConnectingToken(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-navy-950 flex flex-col justify-between text-slate-100 select-none">
      {/* Top Banner */}
      <header className="px-8 py-5 border-b border-navy-850 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sentinel-cyan/15 border border-sentinel-cyan/30 flex items-center justify-center text-sentinel-cyan shadow-sm">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight font-sans text-white">REGRAVA</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-navy-800 text-slate-400 border border-navy-700">
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Catch what your diff could break.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-sentinel-emerald" />
          <span>Zero-Retention Static Engine</span>
        </div>
      </header>

      {/* Main Authentication Hero */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Developer Security & Regression Platform
            </h1>
            <p className="text-sm text-slate-400">
              Deterministic AST analysis of Pull Requests for security flaws and breaking API contracts.
            </p>
          </div>

          {/* Error Alert if any */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-sentinel-amber/15 border border-sentinel-amber/30 text-xs text-sentinel-amber flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Main Card */}
          <div className="p-6 rounded-2xl bg-navy-900 border border-navy-800 shadow-2xl space-y-4">
            {/* Primary Demo Button */}
            <button
              onClick={async () => {
                setErrorMsg(null);
                try {
                  await onLoginDemo();
                } catch (err: any) {
                  setErrorMsg(err.message || 'Demo login failed');
                }
              }}
              disabled={isLoggingIn}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sentinel-cyan to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-navy-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-navy-950" />
              <span>{isLoggingIn ? 'Launching Sandbox...' : 'Explore Demo Sandbox (1-Click)'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="h-px bg-navy-800 flex-1" />
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Or Sign In
              </span>
              <div className="h-px bg-navy-800 flex-1" />
            </div>

            {/* Google Login */}
            <button
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-4 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* GitHub Login */}
            <button
              onClick={handleGitHubLogin}
              className="w-full py-2.5 px-4 rounded-xl bg-navy-850 hover:bg-navy-800 border border-navy-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors"
            >
              <Github className="w-4 h-4 text-white" />
              <span>Continue with GitHub</span>
            </button>

            {/* Direct GitHub Token (PAT) Option */}
            <div className="pt-2 border-t border-navy-800">
              <button
                type="button"
                onClick={() => setShowTokenForm(!showTokenForm)}
                className="w-full text-center text-xs text-sentinel-cyan hover:text-cyan-300 font-medium flex items-center justify-center gap-1.5 py-1 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{showTokenForm ? 'Hide Token Sign-In' : 'Or Sign In with GitHub Token (PAT)'}</span>
              </button>

              {showTokenForm && (
                <form
                  onSubmit={handleTokenSubmit}
                  className="mt-3 space-y-3 p-3.5 rounded-xl bg-navy-950/70 border border-navy-750"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-300">Personal Access Token</span>
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=REGRAVA%20Security%20Scanner"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sentinel-cyan hover:underline flex items-center gap-1 text-[10px]"
                    >
                      Generate Token <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 rounded-lg bg-navy-900 border border-navy-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sentinel-cyan font-mono"
                  />

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Instantly load and scan your real public or private repositories without configuring GitHub OAuth.
                  </p>

                  <button
                    type="submit"
                    disabled={isConnectingToken || !tokenInput.trim()}
                    className="w-full py-2 px-3 rounded-lg bg-sentinel-cyan hover:bg-cyan-400 text-navy-950 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isConnectingToken ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying Token with GitHub...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Sign In with GitHub Token</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Guarantee Pills */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-850 space-y-1">
              <Cpu className="w-4 h-4 mx-auto text-sentinel-cyan" />
              <div className="text-[11px] font-semibold text-slate-200">Deterministic</div>
              <div className="text-[10px] text-slate-400">AST & Diff Parsers</div>
            </div>
            <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-850 space-y-1">
              <Layers className="w-4 h-4 mx-auto text-sentinel-emerald" />
              <div className="text-[11px] font-semibold text-slate-200">Zero Retention</div>
              <div className="text-[10px] text-slate-400">In-memory analysis</div>
            </div>
            <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-850 space-y-1">
              <FileCode className="w-4 h-4 mx-auto text-sentinel-amber" />
              <div className="text-[11px] font-semibold text-slate-200">Fine-Grained</div>
              <div className="text-[10px] text-slate-400">Read-only GitHub App</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-navy-850 text-center text-xs text-slate-500">
        REGRAVA Platform &bull; Deterministic Security & Regression Intelligence for Code Reviews
      </footer>
    </div>
  );
};
