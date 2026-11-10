import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { fetchGoogleConfigInfo, configureGoogleOAuth } from '../services/api';

interface GoogleOAuthSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured?: (authUrl: string) => void;
}

export const GoogleOAuthSetupModal: React.FC<GoogleOAuthSetupModalProps> = ({
  isOpen,
  onClose,
  onConfigured,
}) => {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('http://127.0.0.1:8000/api/auth/google/callback');
  const [originUrls, setOriginUrls] = useState<string[]>(['http://localhost:5173', 'http://127.0.0.1:5173']);
  const [setupUrl, setSetupUrl] = useState('https://console.cloud.google.com/apis/credentials/oauthclient');
  const [isConfigured, setIsConfigured] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    fetchGoogleConfigInfo()
      .then((info) => {
        setIsConfigured(info.is_configured);
        if (info.callback_url) setCallbackUrl(info.callback_url);
        if (info.origin_urls?.length) setOriginUrls(info.origin_urls);
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
      setErrorMsg('Both Google Client ID and Client Secret are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await configureGoogleOAuth(clientId.trim(), clientSecret.trim());
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
      setErrorMsg(err.message || 'Failed to save Google OAuth configuration.');
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
            <div className="p-2 rounded-xl bg-[#1B1F27] border border-[#252932] text-white flex items-center justify-center">
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
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#F5F6F8]">Configure Real Google OAuth</h2>
                {isConfigured && (
                  <span className="text-[10px] text-[#10B981] font-semibold bg-[#10B981]/15 px-2 py-0.5 rounded border border-[#10B981]/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#9299A5]">
                Seamless 1-click Google sign-in with your Google Workspace or Gmail account
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
                <span>Open Google Cloud Credentials</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <p className="text-[11px] text-[#9299A5] leading-relaxed">
              Create an <strong>OAuth 2.0 Client ID</strong> (Web application) in your Google Cloud Console. Paste the URLs below:
            </p>

            <div className="space-y-2">
              <div>
                <div className="text-[10px] text-[#707783] uppercase tracking-wider mb-0.5">
                  Authorized JavaScript Origins
                </div>
                <div className="space-y-1">
                  {originUrls.map((origin, idx) => (
                    <div
                      key={origin}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#15181F] border border-[#252932] font-mono text-[11px]"
                    >
                      <span className="text-[#D1D5DC] truncate">{origin}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(origin, `origin-${idx}`)}
                        className="p-1 rounded text-[#9299A5] hover:text-white"
                      >
                        {copiedKey === `origin-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-[#10B981]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#707783] uppercase tracking-wider mb-0.5">
                  Authorized Redirect URI
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
                Google Client ID
              </label>
              <input
                type="text"
                placeholder="e.g. 1234567890-abcdefg.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0D11] border border-[#252932] text-xs text-[#F5F6F8] placeholder-[#707783] focus:outline-none focus:border-[#7657FF] font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#D1D5DC] mb-1">
                Google Client Secret
              </label>
              <input
                type="password"
                placeholder="e.g. GOCSPX-..."
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0B0D11] border border-[#252932] text-xs text-[#F5F6F8] placeholder-[#707783] focus:outline-none focus:border-[#7657FF] font-mono"
              />
            </div>

            <p className="text-[10px] text-[#707783] leading-relaxed">
              Credentials are securely stored in your local SQLite configuration and encrypted session settings. Never shared externally.
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
                  <span>Save & Connect with Google</span>
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
