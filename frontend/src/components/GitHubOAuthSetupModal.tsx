import React, { useState, useEffect } from 'react';
import {
  X,
  Github,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { fetchGitHubConfigInfo, configureGitHubOAuth } from '../services/api';

interface GitHubOAuthSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured?: (authUrl: string) => void;
}

export const GitHubOAuthSetupModal: React.FC<GitHubOAuthSetupModalProps> = ({
  isOpen,
  onClose,
  onConfigured,
}) => {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('http://127.0.0.1:8000/api/auth/github/callback');
  const [homepageUrl, setHomepageUrl] = useState('http://localhost:5173');
  const [setupUrl, setSetupUrl] = useState('https://github.com/settings/applications/new');
  const [isConfigured, setIsConfigured] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    fetchGitHubConfigInfo()
      .then((info) => {
        setIsConfigured(info.is_configured);
        if (info.callback_url) setCallbackUrl(info.callback_url);
        if (info.homepage_url) setHomepageUrl(info.homepage_url);
        if (info.setup_url) setSetupUrl(info.setup_url);
      })
      .catch(() => {
        // Use defaults if backend fetch fails
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) {
      setErrorMsg('Both Client ID and Client Secret are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await configureGitHubOAuth(clientId.trim(), clientSecret.trim());
      if (res.is_configured && res.auth_url) {
        if (onConfigured) {
          onConfigured(res.auth_url);
        } else {
          window.location.href = res.auth_url;
        }
      } else {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save GitHub OAuth configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#08090C]/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#111318] border border-[#252932] rounded-2xl max-w-lg w-full max-h-[92dvh] overflow-y-auto shadow-2xl flex flex-col text-xs text-[#D1D5DC]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#1C2028] sticky top-0 bg-[#111318]/95 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#1B1F27] border border-[#252932] text-white">
              <Github className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#F5F6F8]">Configure Real GitHub OAuth</h2>
                {isConfigured && (
                  <span className="text-[10px] text-[#10B981] font-semibold bg-[#10B981]/15 px-2 py-0.5 rounded border border-[#10B981]/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#9299A5]">
                Seamless 1-click sign-in without Personal Access Tokens
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#9299A5] hover:text-[#F5F6F8] hover:bg-[#1B1F27] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#F04452]/10 border border-[#F04452]/30 text-[#F04452] flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Steps Guide */}
          <div className="p-4 rounded-xl bg-[#0B0D11] border border-[#1C2028] space-y-3">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#F5F6F8]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                1-Minute Setup Guide
              </span>
              <a
                href={setupUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#896EFF] hover:underline flex items-center gap-1 text-[10px]"
              >
                <span>Open GitHub OAuth Form</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <p className="text-[11px] text-[#9299A5] leading-relaxed">
              Create a free OAuth App in your GitHub account. Paste the URLs below into GitHub:
            </p>

            <div className="space-y-2">
              <div>
                <div className="text-[10px] text-[#707783] uppercase tracking-wider mb-0.5">
                  Homepage URL
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#15181F] border border-[#252932] font-mono text-[11px]">
                  <span className="text-[#D1D5DC] truncate">{homepageUrl}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(homepageUrl, 'homepage')}
                    className="p-1 rounded text-[#9299A5] hover:text-white"
                  >
                    {copiedKey === 'homepage' ? (
                      <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#707783] uppercase tracking-wider mb-0.5">
                  Authorization Callback URL
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#15181F] border border-[#252932] font-mono text-[11px]">
                  <span className="text-[#896EFF] truncate">{callbackUrl}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(callbackUrl, 'callback')}
                    className="p-1 rounded text-[#9299A5] hover:text-white"
                  >
                    {copiedKey === 'callback' ? (
                      <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Credentials Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#D1D5DC] mb-1">
                GitHub Client ID
              </label>
              <input
                type="text"
                placeholder="e.g. Ov23li..."
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0D11] border border-[#252932] text-xs text-[#F5F6F8] placeholder-[#707783] focus:outline-none focus:border-[#7657FF] font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#D1D5DC] mb-1">
                GitHub Client Secret
              </label>
              <input
                type="password"
                placeholder="e.g. 7f93b..."
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0D11] border border-[#252932] text-xs text-[#F5F6F8] placeholder-[#707783] focus:outline-none focus:border-[#7657FF] font-mono"
              />
            </div>

            <p className="text-[10px] text-[#707783] leading-relaxed">
              Credentials are saved in your local database and encrypted session configuration. Never shared with any third party.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#1C2028]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#1B1F27] hover:bg-[#252932] text-[#D1D5DC] text-xs font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !clientId.trim() || !clientSecret.trim()}
              className="px-4 py-2 rounded-xl bg-[#7657FF] hover:bg-[#896EFF] text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Save & Connect with GitHub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
