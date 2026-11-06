import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Github,
  Lock,
  ArrowRight,
  Cpu,
  Layers,
  AlertCircle,
  KeyRound,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Terminal,
  Zap,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  Code2,
  Users,
  BarChart3,
  GitPullRequest,
  CheckCheck,
  Play,
  Activity,
  HelpCircle,
  Sliders,
} from 'lucide-react';
import { getGoogleAuthUrl, getGitHubAuthUrl } from '../services/api';

interface AuthPageProps {
  onLoginDemo: () => Promise<void>;
  isLoggingIn: boolean;
  onConnectToken?: (token: string) => Promise<void>;
}

type SimulatorTab = 'contract' | 'sql' | 'secrets' | 'tenancy';

interface LayerState {
  id: number;
  name: string;
  desc: string;
  status: 'passed' | 'warning' | 'fixed';
  points: number;
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

  // Scroll Progress & Floating Trigger State
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showFloatingPill, setShowFloatingPill] = useState(false);

  // Interactive Simulator State
  const [activeTab, setActiveTab] = useState<SimulatorTab>('contract');
  const [simulatorMode, setSimulatorMode] = useState<'diff' | 'remediation'>('diff');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<number>(3); // 3 means scan complete
  const [copiedTest, setCopiedTest] = useState(false);

  // Interactive 7-Layer Health Scorecard State
  const [layers, setLayers] = useState<LayerState[]>([
    { id: 1, name: 'Contract Integrity', desc: 'FastAPI schema to React TSX component mapping', status: 'warning', points: 15 },
    { id: 2, name: 'AST Taint & SQLi', desc: 'Deterministic AST parameter interpolation check', status: 'passed', points: 15 },
    { id: 3, name: 'High-Entropy Secrets', desc: 'Scanning for leaked payment and cloud API credentials', status: 'passed', points: 15 },
    { id: 4, name: 'Auth & Tenancy Boundary', desc: 'Enforcing multi-tenant org_id database filters', status: 'warning', points: 15 },
    { id: 5, name: 'Test Evidence Gaps', desc: 'Auto-generating verified Vitest/pytest assertions', status: 'passed', points: 15 },
    { id: 6, name: 'Dependency Manifest Health', desc: 'Live CVE cross-referencing on lockfiles', status: 'passed', points: 15 },
    { id: 7, name: 'Ephemeral Memory Sandbox', desc: '100% in-memory processing with zero retention', status: 'passed', points: 10 },
  ]);

  // Interactive ROI Calculator State
  const [teamSize, setTeamSize] = useState<number>(20);

  // Interactive FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Scroll Progress & IntersectionObserver for Scroll Reveal
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const pct = (window.scrollY / totalHeight) * 100;
        setScrollProgress(pct);
      }
      setShowFloatingPill(window.scrollY > 420);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    const elements = document.querySelectorAll('.reveal-on-scroll');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [layers, activeTab]);

  // Trigger live interactive scan simulation
  const handleRunLiveScan = () => {
    setIsScanning(true);
    setScanStep(0);

    setTimeout(() => setScanStep(1), 350);
    setTimeout(() => setScanStep(2), 700);
    setTimeout(() => {
      setScanStep(3);
      setIsScanning(false);
    }, 1100);
  };

  // Toggle fixing a layer to watch the score climb dynamically
  const handleToggleLayerFix = (id: number) => {
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id === id) {
          return {
            ...layer,
            status: layer.status === 'warning' ? 'fixed' : 'warning',
          };
        }
        return layer;
      })
    );
  };

  const calculatedHealthScore = layers.reduce((acc, l) => {
    return l.status === 'passed' || l.status === 'fixed' ? acc + l.points : acc;
  }, 0);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    try {
      const res = await getGoogleAuthUrl();
      if (res.is_configured && res.url) {
        window.location.href = res.url;
      } else {
        setErrorMsg(
          'Google OAuth client credentials are not configured in environment (.env). You can explore the 1-Click Demo Sandbox or use a GitHub Token below!'
        );
        scrollToAuth();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize Google authentication');
      scrollToAuth();
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
        scrollToAuth();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize GitHub authentication');
      scrollToAuth();
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

  const scrollToAuth = () => {
    const el = document.getElementById('auth-gateway');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToSimulator = () => {
    const el = document.getElementById('live-simulator');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTest(true);
    setTimeout(() => setCopiedTest(false), 2000);
  };

  // Dynamic ROI calculation
  const hoursSavedPerMonth = teamSize * 14;
  const dollarsSavedPerMonth = Math.round(hoursSavedPerMonth * 75);
  const outagesPreventedPerYear = Math.max(1, Math.round(teamSize * 0.25));

  // Frameworks Marquee List
  const frameworks = [
    'FastAPI',
    'Next.js 15',
    'React 19',
    'TypeScript 5.7',
    'Python 3.12',
    'Pydantic v2',
    'Go 1.23',
    'Vitest',
    'Pytest',
    'GitHub Actions',
    'Node.js',
    'PostgreSQL',
    'GraphQL',
    'Docker',
    'Turborepo',
  ];

  return (
    <div className="min-h-screen w-full bg-[#08090C] text-[#D1D5DC] font-sans antialiased selection:bg-[#7657FF]/30 selection:text-white relative overflow-x-hidden">
      {/* Top Scroll Depth Progress Bar */}
      <div
        className="fixed top-0 left-0 h-[2.5px] bg-gradient-to-r from-[#7657FF] via-[#A78BFA] to-[#10B981] z-50 transition-all duration-75"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Floating Bottom Quick-Action Pill (appears on scroll) */}
      <aside
        aria-label="Quick Actions"
        className={`fixed bottom-6 right-6 z-40 transition-all duration-500 ease-out ${
          showFloatingPill ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#111318]/90 backdrop-blur-xl border border-[#48366F] shadow-2xl shadow-purple-950/60 glow-purple">
          <button
            onClick={onLoginDemo}
            disabled={isLoggingIn}
            className="px-4 py-2 rounded-xl bg-[#7657FF] hover:bg-[#896EFF] text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>{isLoggingIn ? 'Spinning...' : 'Launch 1-Click Sandbox'}</span>
          </button>
          <button
            onClick={scrollToAuth}
            className="p-2 rounded-xl text-[#9299A5] hover:text-[#F5F6F8] hover:bg-[#15181F] transition-colors"
            title="Sign In with GitHub"
          >
            <Github className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none bg-radial-glow z-0" />
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern opacity-60 z-0" />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0B0D11]/85 border-b border-[#1C2028] px-6 lg:px-12 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <img
              src="/regrava-icon.png"
              alt="REGRAVA"
              className="w-8 h-8 rounded-lg object-contain border border-[#252932] bg-[#08090C] shadow-md shadow-purple-950/20 group-hover:border-[#7657FF] transition-all"
            />
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-[#F5F6F8]">REGRAVA</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#211A35] text-[#896EFF] border border-[#48366F]">
                v2.0
              </span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 ml-2 pl-3 border-l border-[#252932] text-xs text-[#9299A5]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span>Deterministic AST Online</span>
            </div>
          </div>

          {/* Center Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-medium text-[#9299A5]">
            <a href="#live-simulator" className="hover:text-[#F5F6F8] transition-colors">
              Interactive Simulator
            </a>
            <a href="#wedge" className="hover:text-[#F5F6F8] transition-colors">
              The Moat
            </a>
            <a href="#seven-pillars" className="hover:text-[#F5F6F8] transition-colors">
              7-Layer Posture
            </a>
            <a href="#comparison" className="hover:text-[#F5F6F8] transition-colors">
              Comparison
            </a>
            <a href="#roi" className="hover:text-[#F5F6F8] transition-colors">
              ROI Calculator
            </a>
            <a href="#faq" className="hover:text-[#F5F6F8] transition-colors">
              FAQ
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={scrollToAuth}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#D1D5DC] hover:text-[#F5F6F8] hover:bg-[#15181F] border border-transparent hover:border-[#252932] transition-all"
            >
              Sign In
            </button>
            <button
              onClick={onLoginDemo}
              disabled={isLoggingIn}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#7657FF] hover:bg-[#896EFF] text-white shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>{isLoggingIn ? 'Launching...' : '1-Click Sandbox'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Landing Page Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-12 pb-24 space-y-32">
        {/* ========================================================================= */}
        {/* 1. HERO SECTION */}
        {/* ========================================================================= */}
        <section className="text-center pt-6 pb-4 max-w-4xl mx-auto space-y-8 reveal-on-scroll is-visible">
          {/* Announcement Beacon */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111318] border border-[#252932] shadow-inner text-xs font-medium text-[#D1D5DC] hover:border-[#48366F] transition-all">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7657FF] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7657FF]"></span>
            </span>
            <span className="text-[#F5F6F8] font-semibold">Zero-Retention Deterministic AST Engine</span>
            <span className="text-[#707783]">•</span>
            <span className="text-[#896EFF]">No LLM Hallucinations</span>
            <ChevronRight className="w-3 h-3 text-[#707783]" />
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#F5F6F8] leading-[1.12]">
            Stop Breaking Production <br />
            <span className="bg-gradient-to-r from-[#7657FF] via-[#A78BFA] to-[#10B981] bg-clip-text text-transparent">
              Before You Hit Merge.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-[#9299A5] max-w-2xl mx-auto leading-relaxed">
            Generic AI reviewers flood PRs with noisy style comments. REGRAVA maps your backend schemas to frontend UI components, flags contract breaks in <span className="text-[#F5F6F8] font-semibold">&lt; 45ms</span>, and auto-generates verified test proofs with <span className="text-[#10B981] font-semibold">zero cloud retention</span>.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={onLoginDemo}
              disabled={isLoggingIn}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#7657FF] hover:bg-[#896EFF] text-white font-bold text-sm shadow-xl shadow-purple-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>{isLoggingIn ? 'Spinning Sandbox...' : 'Explore Demo Sandbox (1-Click)'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={scrollToAuth}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#111318] hover:bg-[#15181F] border border-[#252932] hover:border-[#454B58] text-[#F5F6F8] font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              <Github className="w-4 h-4 text-white" />
              <span>Scan Your Repository</span>
            </button>

            <button
              onClick={scrollToSimulator}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl text-xs font-semibold text-[#9299A5] hover:text-[#F5F6F8] hover:bg-[#111318] border border-transparent hover:border-[#252932] transition-all flex items-center justify-center gap-1.5"
            >
              <Terminal className="w-4 h-4 text-[#896EFF]" />
              <span>Live Diff Simulator ↓</span>
            </button>
          </div>

          {/* Fast Spec Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 max-w-3xl mx-auto text-left">
            <div className="p-4 rounded-xl bg-[#111318]/80 border border-[#1C2028] hover:border-[#252932] transition-all">
              <div className="text-2xl font-extrabold text-[#F5F6F8]">&lt; 45ms</div>
              <div className="text-xs text-[#707783] mt-0.5">AST Analysis Speed</div>
            </div>
            <div className="p-4 rounded-xl bg-[#111318]/80 border border-[#1C2028] hover:border-[#10B981]/40 transition-all">
              <div className="text-2xl font-extrabold text-[#10B981]">0%</div>
              <div className="text-xs text-[#707783] mt-0.5">Hallucination Rate</div>
            </div>
            <div className="p-4 rounded-xl bg-[#111318]/80 border border-[#1C2028] hover:border-[#896EFF]/40 transition-all">
              <div className="text-2xl font-extrabold text-[#896EFF]">100%</div>
              <div className="text-xs text-[#707783] mt-0.5">In-Memory Zero Retention</div>
            </div>
            <div className="p-4 rounded-xl bg-[#111318]/80 border border-[#1C2028] hover:border-[#252932] transition-all">
              <div className="text-2xl font-extrabold text-[#F5F6F8]">7-Layer</div>
              <div className="text-xs text-[#707783] mt-0.5">Fleet Security Radar</div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* INFINITE FRAMEWORKS MARQUEE */}
        {/* ========================================================================= */}
        <section aria-label="Supported Technologies" className="overflow-hidden py-4 border-y border-[#1C2028] bg-[#0B0D11]/50 reveal-on-scroll">
          <div className="flex items-center gap-4 text-xs font-medium text-[#707783]">
            <span className="shrink-0 font-bold uppercase tracking-widest text-[#896EFF] text-[10px] pl-4">
              Supported Ecosystem:
            </span>
            <div className="overflow-hidden w-full">
              <div className="animate-marquee flex items-center gap-8 text-[#9299A5]">
                {frameworks.concat(frameworks).map((tech, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-2 hover:text-[#F5F6F8] transition-colors cursor-default whitespace-nowrap"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#48366F]" />
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. INTERACTIVE PR SIMULATOR (Live Clickable Scenarios + Live Scan) */}
        {/* ========================================================================= */}
        <section id="live-simulator" className="space-y-6 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider">
              <Terminal className="w-3.5 h-3.5" />
              <span>Interactive Verification Simulator</span>
            </div>
            <h2 className="text-3xl font-bold text-[#F5F6F8] tracking-tight">
              Test Real PR Regressions in the Browser
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Click the scenarios, toggle between breaking diffs and auto-remediations, or click <strong>Run Live Scan</strong> to experience sub-45ms deterministic AST traversal.
            </p>
          </div>

          {/* Simulator Box */}
          <div className="rounded-2xl bg-[#111318] border border-[#252932] shadow-2xl overflow-hidden glow-purple">
            {/* Top Bar with Tabs and Live Run Scan Button */}
            <div className="bg-[#0B0D11] border-b border-[#252932] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#F04452]/80" />
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B]/80" />
                  <div className="w-3 h-3 rounded-full bg-[#10B981]/80" />
                </div>
                <span className="text-xs font-mono text-[#9299A5]">
                  PR #42 &bull; Myparadox-creator/REGRAVA
                </span>
              </div>

              {/* Action Controls & Simulator Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Mode Toggle: Diff vs Remediation */}
                <div className="flex items-center bg-[#15181F] p-0.5 rounded-lg border border-[#252932] text-xs">
                  <button
                    onClick={() => setSimulatorMode('diff')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      simulatorMode === 'diff'
                        ? 'bg-[#252932] text-[#F5F6F8]'
                        : 'text-[#9299A5] hover:text-[#F5F6F8]'
                    }`}
                  >
                    Breaking Diff
                  </button>
                  <button
                    onClick={() => setSimulatorMode('remediation')}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      simulatorMode === 'remediation'
                        ? 'bg-[#10B981]/20 text-[#10B981] font-semibold'
                        : 'text-[#9299A5] hover:text-[#F5F6F8]'
                    }`}
                  >
                    Auto-Fix Patch
                  </button>
                </div>

                {/* Scenario Tabs */}
                <div className="flex items-center gap-1 bg-[#15181F] p-0.5 rounded-lg border border-[#252932] text-xs">
                  <button
                    onClick={() => {
                      setActiveTab('contract');
                      handleRunLiveScan();
                    }}
                    className={`px-2.5 py-1 font-semibold rounded-md transition-all ${
                      activeTab === 'contract'
                        ? 'bg-[#7657FF] text-white shadow-sm'
                        : 'text-[#9299A5] hover:text-[#F5F6F8]'
                    }`}
                  >
                    Contract Diff
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('sql');
                      handleRunLiveScan();
                    }}
                    className={`px-2.5 py-1 font-semibold rounded-md transition-all ${
                      activeTab === 'sql'
                        ? 'bg-[#7657FF] text-white shadow-sm'
                        : 'text-[#9299A5] hover:text-[#F5F6F8]'
                    }`}
                  >
                    SQLi Taint
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('secrets');
                      handleRunLiveScan();
                    }}
                    className={`px-2.5 py-1 font-semibold rounded-md transition-all ${
                      activeTab === 'secrets'
                        ? 'bg-[#7657FF] text-white shadow-sm'
                        : 'text-[#9299A5] hover:text-[#F5F6F8]'
                    }`}
                  >
                    Leaked Secret
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('tenancy');
                      handleRunLiveScan();
                    }}
                    className={`px-2.5 py-1 font-semibold rounded-md transition-all ${
                      activeTab === 'tenancy'
                        ? 'bg-[#7657FF] text-white shadow-sm'
                        : 'text-[#9299A5] hover:text-[#F5F6F8]'
                    }`}
                  >
                    Auth Tenancy
                  </button>
                </div>

                {/* Live Scan Trigger Button */}
                <button
                  onClick={handleRunLiveScan}
                  disabled={isScanning}
                  className="px-3 py-1 rounded-lg bg-[#211A35] hover:bg-[#2e244d] border border-[#48366F] text-[#896EFF] text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isScanning ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-[#896EFF]" />
                  ) : (
                    <Play className="w-3 h-3 text-[#896EFF] fill-current" />
                  )}
                  <span>{isScanning ? 'Analyzing AST...' : 'Run Live Scan'}</span>
                </button>
              </div>
            </div>

            {/* Scanning Progress Bar if scanning */}
            {isScanning && (
              <div className="bg-[#08090C] px-5 py-2 border-b border-[#252932] text-xs font-mono text-[#896EFF] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 animate-pulse text-[#10B981]" />
                  {scanStep === 0 && 'Phase 1: Generating Abstract Syntax Tree for app/schemas/user.py...'}
                  {scanStep === 1 && 'Phase 2: Traversing 14 frontend TSX consumer components...'}
                  {scanStep === 2 && 'Phase 3: Cross-boundary taint and interface verification...'}
                  {scanStep === 3 && 'Scan Complete: 1 Critical Contract Break Found!'}
                </span>
                <span className="text-[10px] text-[#707783]">{scanStep * 33}%</span>
              </div>
            )}

            {/* Scenario Content Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#252932] min-h-[420px]">
              {/* Left Column: The PR Diff or Auto-Fix Patch */}
              <div className="lg:col-span-5 p-5 space-y-3 font-mono text-xs bg-[#08090C]">
                <div className="flex items-center justify-between text-[#707783] border-b border-[#1C2028] pb-2">
                  <span className="flex items-center gap-1.5 text-xs text-[#D1D5DC]">
                    <GitPullRequest className="w-3.5 h-3.5 text-[#896EFF]" />
                    {simulatorMode === 'diff' ? (
                      activeTab === 'contract'
                        ? 'app/schemas/user.py'
                        : activeTab === 'sql'
                        ? 'app/db/repositories.py'
                        : activeTab === 'secrets'
                        ? 'config/payment_gateway.py'
                        : 'app/routers/invoices.py'
                    ) : (
                      'frontend/src/components/UserProfile.tsx'
                    )}
                  </span>
                  <span className="text-[11px] text-[#707783]">
                    {simulatorMode === 'diff' ? '+12 -3 lines' : 'Auto-Remediated Fix'}
                  </span>
                </div>

                {simulatorMode === 'diff' ? (
                  <>
                    {activeTab === 'contract' && (
                      <div className="space-y-1 leading-relaxed text-[#9299A5]">
                        <div className="text-[#707783]">@@ -18,6 +18,6 @@ class UserResponse(BaseModel):</div>
                        <div className="text-[#D1D5DC]">     username: str</div>
                        <div className="text-[#D1D5DC]">     email: EmailStr</div>
                        <div className="bg-[#F04452]/20 text-[#F04452] px-1.5 py-0.5 rounded">
                          -    user_id: int # Old primary key
                        </div>
                        <div className="bg-[#10B981]/20 text-[#10B981] px-1.5 py-0.5 rounded">
                          +    id: int      # Renamed for OpenAPI consistency
                        </div>
                        <div className="text-[#D1D5DC]">     is_active: bool = True</div>
                      </div>
                    )}

                    {activeTab === 'sql' && (
                      <div className="space-y-1 leading-relaxed text-[#9299A5]">
                        <div className="text-[#707783]">@@ -45,4 +45,4 @@ async def get_orders(client_query: str):</div>
                        <div className="bg-[#F04452]/20 text-[#F04452] px-1.5 py-0.5 rounded">
                          -    return await db.execute(select(Order).where(Order.id == order_id))
                        </div>
                        <div className="bg-[#F04452]/20 text-[#F04452] px-1.5 py-0.5 rounded">
                          +    # Direct query string interpolation
                        </div>
                        <div className="bg-[#F04452]/20 text-[#F04452] px-1.5 py-0.5 rounded">
                          {'+    raw_sql = f"SELECT * FROM orders WHERE status = \'{client_query}\'""'}
                        </div>
                        <div className="bg-[#10B981]/20 text-[#10B981] px-1.5 py-0.5 rounded">
                          +    return await db.fetch_all(raw_sql)
                        </div>
                      </div>
                    )}

                    {activeTab === 'secrets' && (
                      <div className="space-y-1 leading-relaxed text-[#9299A5]">
                        <div className="text-[#707783]">@@ -8,3 +8,4 @@ class StripeConfig:</div>
                        <div className="text-[#D1D5DC]">     API_VERSION = "2024-06-20"</div>
                        <div className="bg-[#F04452]/20 text-[#F04452] px-1.5 py-0.5 rounded">
                          +    TEST_WEBHOOK_SECRET = "demo_key_synthetic_high_entropy_token_xyz"
                        </div>
                      </div>
                    )}

                    {activeTab === 'tenancy' && (
                      <div className="space-y-1 leading-relaxed text-[#9299A5]">
                        <div className="text-[#707783]">@@ -30,4 +30,4 @@ async def get_invoice(invoice_id: str):</div>
                        <div className="bg-[#F04452]/20 text-[#F04452] px-1.5 py-0.5 rounded">
                          -    # Checked current_user.tenant_id
                        </div>
                        <div className="bg-[#F04452]/20 text-[#F04452] px-1.5 py-0.5 rounded">
                          {'+    return await db.invoices.find_one({"_id": invoice_id})'}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-1 leading-relaxed text-[#9299A5]">
                    <div className="text-[#707783]">@@ -32,4 +32,4 @@ export function UserProfile({`{ data }`}: Props):</div>
                    <div className="bg-[#F04452]/20 text-[#F04452] px-1.5 py-0.5 rounded">
                      -  &lt;div className="id-badge"&gt;ID: {`{data.user_id}`}&lt;/div&gt;
                    </div>
                    <div className="bg-[#10B981]/20 text-[#10B981] px-1.5 py-0.5 rounded">
                      +  &lt;div className="id-badge"&gt;ID: {`{data.id}`}&lt;/div&gt; // Auto-synced with schema
                    </div>
                    <div className="text-[#10B981] pt-3 text-[11px]">
                      ✨ 1-Click Patch Generated: Safely resolves contract without broken UI!
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-[#1C2028] text-[11px] text-[#707783]">
                  💡 Notice: The backend code compiles and passes local unit tests completely fine!
                </div>
              </div>

              {/* Center Column: What Generic AI Reviewers Say */}
              <div className="lg:col-span-3 p-5 space-y-3 bg-[#0B0D11]/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#9299A5]">
                  <XCircle className="w-4 h-4 text-[#F59E0B]" />
                  <span>Generic AI Reviewer (CodeRabbit/Copilot)</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#15181F] border border-[#252932] space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 text-[#10B981] font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>LGTM! Clean refactor 🟢</span>
                  </div>
                  <p className="text-[11px] text-[#9299A5] leading-relaxed">
                    {activeTab === 'contract' &&
                      '"The rename of `user_id` to `id` improves adherence to REST conventions. Variable naming is concise. Approved."'}
                    {activeTab === 'sql' &&
                      '"Refactored query execution to use fetch_all. Remember to keep functions small. Approved."'}
                    {activeTab === 'secrets' &&
                      '"Consider placing constants in environment configuration files for better maintainability."'}
                    {activeTab === 'tenancy' &&
                      '"Simplified invoice query handler. Looks good!"'}
                  </p>
                  <div className="text-[10px] text-[#F04452] font-mono pt-1">
                    ⚠️ Missed: Zero cross-boundary correlation or syntax-tree taint tracking!
                  </div>
                </div>
              </div>

              {/* Right Column: What REGRAVA Catches */}
              <div className="lg:col-span-4 p-5 space-y-3 bg-[#111318]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F5F6F8]">
                    <ShieldCheck className="w-4 h-4 text-[#896EFF]" />
                    <span>REGRAVA Deterministic Sentinel</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#211A35] text-[#896EFF] border border-[#48366F]">
                    Caught in 38ms
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#08090C] border border-[#F04452]/40 space-y-2.5 text-xs">
                  <div className="flex items-center gap-1.5 text-[#F04452] font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {activeTab === 'contract' && 'CRITICAL: Broken Frontend Contract'}
                      {activeTab === 'sql' && 'HIGH SEVERITY: SQL Injection AST Taint'}
                      {activeTab === 'secrets' && 'BLOCKING: Live Production Secret'}
                      {activeTab === 'tenancy' && 'CRITICAL: IDOR Multi-Tenancy Bypass'}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#D1D5DC] space-y-1 font-mono">
                    {activeTab === 'contract' && (
                      <>
                        <div className="text-[#9299A5]">Consumer Affected:</div>
                        <div className="text-[#896EFF] bg-[#15181F] p-1.5 rounded">
                          frontend/src/components/UserProfile.tsx:34
                        </div>
                        <div className="text-[#F04452] text-[10px] pt-1">
                          💥 Component accesses `data.user_id` which no longer exists!
                        </div>
                      </>
                    )}
                    {activeTab === 'sql' && (
                      <>
                        <div className="text-[#9299A5]">AST Taint Chain:</div>
                        <div className="text-[#F04452] bg-[#15181F] p-1.5 rounded">
                          client_query &rarr; f-string format &rarr; db.fetch_all
                        </div>
                      </>
                    )}
                    {activeTab === 'secrets' && (
                      <>
                        <div className="text-[#9299A5]">Entropy Pattern Match:</div>
                        <div className="text-[#F04452] bg-[#15181F] p-1.5 rounded">
                          Stripe Live Key (Entropy: 4.82)
                        </div>
                      </>
                    )}
                    {activeTab === 'tenancy' && (
                      <>
                        <div className="text-[#9299A5]">Missing Tenant Boundary:</div>
                        <div className="text-[#F04452] bg-[#15181F] p-1.5 rounded">
                          Missing `tenant_id` filter in DB lookup
                        </div>
                      </>
                    )}
                  </div>

                  {/* Auto-Generated Proof */}
                  <div className="pt-2 border-t border-[#252932] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-[#10B981]">
                      <span className="font-semibold flex items-center gap-1">
                        <CheckCheck className="w-3 h-3" /> Auto-Generated Test Proof
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `// Vitest Contract Regression Test\nit('should verify /api/users returns id', async () => {\n  const res = await api.get('/users/me');\n  expect(res.data).toHaveProperty('id');\n});`
                          )
                        }
                        className="hover:underline flex items-center gap-1 text-[#896EFF]"
                      >
                        {copiedTest ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedTest ? 'Copied' : 'Copy Test'}</span>
                      </button>
                    </div>
                    <pre className="text-[10px] bg-[#15181F] p-2 rounded text-[#9299A5] overflow-x-auto">
                      {`it('should verify /api/users returns id', async () => {
  const res = await api.get('/users/me');
  expect(res.data).toHaveProperty('id');
});`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. THE WEDGE & ARCHITECTURAL MOAT */}
        {/* ========================================================================= */}
        <section id="wedge" className="space-y-10 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              <span>Architectural Moat</span>
            </div>
            <h2 className="text-3xl font-bold text-[#F5F6F8] tracking-tight">
              Why Stochastic AI Can Never Solve This
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              LLMs predict the most statistically probable next word. They cannot traverse polyglot AST dependency graphs across repository boundaries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 hover:border-[#48366F] transition-all hover:scale-[1.01]">
              <div className="w-10 h-10 rounded-xl bg-[#211A35] border border-[#48366F] flex items-center justify-center text-[#896EFF]">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#F5F6F8]">Deterministic AST vs. Prompt Wrappers</h3>
              <p className="text-xs text-[#9299A5] leading-relaxed">
                We construct real Abstract Syntax Trees (ASTs) of backend Pydantic/Go models and correlate them with frontend TypeScript/JSX component trees. No hallucinations. 100% mathematical precision.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 hover:border-[#48366F] transition-all hover:scale-[1.01]">
              <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center text-[#10B981]">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#F5F6F8]">100% Zero-Retention Security</h3>
              <p className="text-xs text-[#9299A5] leading-relaxed">
                Analysis executes ephemerally in RAM and is discarded instantly. Your proprietary source code is never used to train models or sent to third-party cloud LLMs. Passes SOC2 and HIPAA audits.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#111318] border border-[#252932] space-y-4 hover:border-[#48366F] transition-all hover:scale-[1.01]">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
                <Code2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#F5F6F8]">Automated Test Proofs, Not Opinions</h3>
              <p className="text-xs text-[#9299A5] leading-relaxed">
                When a contract breaks or a security trap is detected, REGRAVA doesn’t just complain—it generates ready-to-run pytest and Vitest assertions to verify and lock in the fix permanently.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. THE 7-LAYER FLEET SECURITY POSTURE (Interactive Scorecard) */}
        {/* ========================================================================= */}
        <section id="seven-pillars" className="space-y-10 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" />
              <span>Full-Stack Security Radar</span>
            </div>
            <h2 className="text-3xl font-bold text-[#F5F6F8] tracking-tight">
              7-Layer Deterministic Fleet Scorecard
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Click on the warning layers below to simulate automated auto-remediation and watch the live Fleet Health Score climb to 100%!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Left: Dynamic Live Health Gauge */}
            <div className="lg:col-span-4 p-7 rounded-2xl bg-[#111318] border border-[#252932] text-center space-y-4 shadow-xl">
              <div className="text-xs font-bold uppercase tracking-wider text-[#9299A5]">
                Simulated Fleet Posture
              </div>
              <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-[#252932]"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={calculatedHealthScore >= 85 ? '#10B981' : '#F59E0B'}
                    strokeWidth="8"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * calculatedHealthScore) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-[#F5F6F8]">
                    {calculatedHealthScore}%
                  </span>
                  <span className="text-[10px] text-[#707783] uppercase tracking-wide">
                    {calculatedHealthScore >= 85 ? 'Healthy' : 'Needs Fix'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#9299A5]">
                {calculatedHealthScore === 100
                  ? '✨ All 7 Deterministic Layers Verified! Ready for production deployment.'
                  : '⚠️ 2 potential contract and tenancy regressions detected in active PR branches.'}
              </p>
              <button
                onClick={() => {
                  setLayers((prev) =>
                    prev.map((l) => ({ ...l, status: 'passed' }))
                  );
                }}
                className="w-full py-2 px-3 rounded-lg bg-[#211A35] hover:bg-[#2e244d] border border-[#48366F] text-xs font-semibold text-[#896EFF] transition-colors"
              >
                Auto-Fix All 7 Layers
              </button>
            </div>

            {/* Right: The 7 Clickable Layer Cards */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => handleToggleLayerFix(layer.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    layer.status === 'passed' || layer.status === 'fixed'
                      ? 'bg-[#111318] border-[#252932] hover:border-[#10B981]/50'
                      : 'bg-[#15181F] border-[#F59E0B]/50 hover:border-[#F59E0B]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F5F6F8] flex items-center gap-1.5">
                      {layer.status === 'passed' || layer.status === 'fixed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
                      )}
                      <span>{layer.name}</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        layer.status === 'passed' || layer.status === 'fixed'
                          ? 'bg-[#10B981]/15 text-[#10B981]'
                          : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                      }`}
                    >
                      {layer.status === 'passed' ? 'Clean' : layer.status === 'fixed' ? 'Fixed ✓' : 'Action Req'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#707783] mt-1.5 leading-relaxed">
                    {layer.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. COMPETITIVE COMPARISON MATRIX */}
        {/* ========================================================================= */}
        <section id="comparison" className="space-y-8 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Competitive Landscape</span>
            </div>
            <h2 className="text-3xl font-bold text-[#F5F6F8] tracking-tight">
              Deterministic Certainty vs. Stochastic AI
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Why high-velocity engineering teams choose REGRAVA over generic AI PR summary bots.
            </p>
          </div>

          <div className="rounded-2xl bg-[#111318] border border-[#252932] overflow-x-auto shadow-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B0D11] border-b border-[#252932] text-[#F5F6F8]">
                <tr>
                  <th className="py-4 px-5 font-semibold">Capability</th>
                  <th className="py-4 px-5 font-bold text-[#896EFF] bg-[#211A35]/30">REGRAVA (Deterministic Sentinel)</th>
                  <th className="py-4 px-5 font-semibold text-[#9299A5]">CodeRabbit / Copilot</th>
                  <th className="py-4 px-5 font-semibold text-[#9299A5]">Traditional SAST (SonarQube)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C2028]">
                <tr>
                  <td className="py-3.5 px-5 font-medium text-[#F5F6F8]">Cross-Boundary Contract Tracing</td>
                  <td className="py-3.5 px-5 text-[#10B981] font-bold bg-[#211A35]/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Full-Stack AST Graph
                  </td>
                  <td className="py-3.5 px-5 text-[#F04452]">❌ Single-repo prompt blind</td>
                  <td className="py-3.5 px-5 text-[#F04452]">❌ Disconnected silos</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-[#F5F6F8]">Hallucination & Alert Fatigue</td>
                  <td className="py-3.5 px-5 text-[#10B981] font-bold bg-[#211A35]/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 0% (Mathematical syntax tree)
                  </td>
                  <td className="py-3.5 px-5 text-[#F59E0B]">⚠️ High (15-20 cosmetic comments)</td>
                  <td className="py-3.5 px-5 text-[#F59E0B]">⚠️ High (Hundreds of style warnings)</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-[#F5F6F8]">Scan Latency</td>
                  <td className="py-3.5 px-5 text-[#10B981] font-bold bg-[#211A35]/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> &lt; 45ms per PR
                  </td>
                  <td className="py-3.5 px-5 text-[#9299A5]">30s – 2 minutes</td>
                  <td className="py-3.5 px-5 text-[#9299A5]">2 – 10 minutes</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-[#F5F6F8]">Enterprise Code Privacy</td>
                  <td className="py-3.5 px-5 text-[#10B981] font-bold bg-[#211A35]/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% In-Memory Zero Retention
                  </td>
                  <td className="py-3.5 px-5 text-[#F59E0B]">⚠️ Third-party cloud LLM API</td>
                  <td className="py-3.5 px-5 text-[#10B981]">On-prem license</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-5 font-medium text-[#F5F6F8]">Actionable Remediation</td>
                  <td className="py-3.5 px-5 text-[#10B981] font-bold bg-[#211A35]/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> AST Code Patch + Auto-Generated Test
                  </td>
                  <td className="py-3.5 px-5 text-[#9299A5]">Conversational text advice</td>
                  <td className="py-3.5 px-5 text-[#9299A5]">Rule IDs & code smells</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. INTERACTIVE ROI CALCULATOR */}
        {/* ========================================================================= */}
        <section id="roi" className="space-y-8 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              <span>Interactive ROI Calculator</span>
            </div>
            <h2 className="text-3xl font-bold text-[#F5F6F8] tracking-tight">
              Quantify Your Team's Saved Engineering Hours
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Adjust your engineering team size to estimate monthly savings and outage prevention with REGRAVA.
            </p>
          </div>

          <div className="max-w-3xl mx-auto p-6 sm:p-8 rounded-2xl bg-[#111318] border border-[#252932] shadow-2xl space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[#F5F6F8] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#896EFF]" />
                  Engineers Shipping Code:
                </span>
                <span className="font-bold text-[#896EFF] text-base px-3 py-1 rounded-lg bg-[#211A35] border border-[#48366F]">
                  {teamSize} Developers
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="w-full accent-[#7657FF] cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-[#707783]">
                <span>5 Devs (Early Startup)</span>
                <span>50 Devs (Scaleup)</span>
                <span>100+ Devs (Enterprise)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#252932]">
              <div className="p-4 rounded-xl bg-[#08090C] border border-[#1C2028]">
                <div className="text-2xl font-extrabold text-[#F5F6F8]">{hoursSavedPerMonth} hrs</div>
                <div className="text-xs text-[#707783] mt-1">Review Time Saved / Mo</div>
              </div>
              <div className="p-4 rounded-xl bg-[#08090C] border border-[#1C2028]">
                <div className="text-2xl font-extrabold text-[#10B981]">${dollarsSavedPerMonth.toLocaleString()}</div>
                <div className="text-xs text-[#707783] mt-1">Engineering Salary Saved / Mo</div>
              </div>
              <div className="p-4 rounded-xl bg-[#08090C] border border-[#1C2028]">
                <div className="text-2xl font-extrabold text-[#896EFF]">~{outagesPreventedPerYear} Outages</div>
                <div className="text-xs text-[#707783] mt-1">Contract Breaks Prevented / Yr</div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 7. INTERACTIVE FAQ ACCORDION */}
        {/* ========================================================================= */}
        <section id="faq" className="space-y-8 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Frequently Asked Questions</span>
            </div>
            <h2 className="text-3xl font-bold text-[#F5F6F8] tracking-tight">
              Everything You Need to Know
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Answers to technical architecture, privacy, compliance, and deployment questions.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {[
              {
                q: 'How is REGRAVA different from CodeRabbit or GitHub Copilot?',
                a: 'CodeRabbit and Copilot rely entirely on LLM prompts to review code. They treat source code as natural text and suffer from hallucinations, cosmetic comment spam, and prompt-context size limits. REGRAVA constructs real Abstract Syntax Trees (ASTs) to mathematically track backend API models directly to their frontend TSX consumer components in < 45ms with 0% hallucinations.',
              },
              {
                q: 'Does any of our proprietary source code get stored or used for AI training?',
                a: 'Never. REGRAVA is architected on a strict Zero-Retention policy. Analysis is executed 100% in-memory (RAM) and wiped immediately after diff verification. Your code is never sent to third-party model providers, nor is it ever used for model training. This allows REGRAVA to pass SOC2, HIPAA, and GDPR enterprise audits in days.',
              },
              {
                q: 'Can REGRAVA catch broken contracts across separate backend and frontend repositories?',
                a: 'Yes! REGRAVA links your backend repository (e.g. FastAPI, Node, Go) with your frontend repository (e.g. React, Next.js, Vue) through its repository linking engine. Whenever a PR modifies an API endpoint schema on the backend, REGRAVA queries the registered frontend AST to ensure no consumers will break.',
              },
              {
                q: 'Can we test REGRAVA without granting full GitHub organization permissions?',
                a: 'Absolutely. You can explore the 1-Click Sandbox instantly with zero credentials. If you want to test your real repository, you can provide a fine-grained GitHub Personal Access Token (PAT) with read-only scopes, or install our verified GitHub App.',
              },
              {
                q: 'What happens when a breaking contract or security trap is caught?',
                a: 'REGRAVA flags the exact line and consumer file affected, explains why it breaks runtime execution, and automatically generates an AST-verified code patch alongside a ready-to-commit Vitest or pytest assertion.',
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-[#111318] border border-[#252932] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-5 py-4 text-left font-semibold text-xs text-[#F5F6F8] flex items-center justify-between hover:text-[#896EFF] transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#707783] transition-transform duration-300 ${
                      openFaq === idx ? 'rotate-180 text-[#896EFF]' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 text-xs text-[#9299A5] leading-relaxed border-t border-[#1C2028] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 8. AUTH GATEWAY / ONBOARDING HUB */}
        {/* ========================================================================= */}
        <section id="auth-gateway" className="max-w-xl mx-auto space-y-6 pt-6 scroll-mt-24 reveal-on-scroll">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get Started in 10 Seconds</span>
            </div>
            <h2 className="text-3xl font-bold text-[#F5F6F8] tracking-tight">
              Ready to Secure Your Pull Requests?
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Experience the full application instantly in the 1-Click Sandbox, or sign in to scan your own repositories.
            </p>
          </div>

          {/* Error Alert if any */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-[#F04452]/10 border border-[#F04452]/30 text-xs text-[#F04452] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Main Auth Box */}
          <div className="p-7 rounded-2xl bg-[#111318] border border-[#252932] shadow-2xl space-y-5 glow-purple">
            {/* Primary Demo Button */}
            <button
              onClick={onLoginDemo}
              disabled={isLoggingIn}
              className="w-full py-3.5 px-4 rounded-xl bg-[#7657FF] hover:bg-[#896EFF] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-purple-950/50 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>{isLoggingIn ? 'Spinning Sandbox...' : 'Launch Live Demo Sandbox (1-Click)'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="h-px bg-[#252932] flex-1" />
              <span className="text-[11px] font-semibold text-[#707783] uppercase tracking-wider">
                Or Connect Your Account
              </span>
              <div className="h-px bg-[#252932] flex-1" />
            </div>

            {/* Google Login */}
            <button
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-4 rounded-xl bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[#F5F6F8] text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors"
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
              className="w-full py-2.5 px-4 rounded-xl bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] text-[#F5F6F8] text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors"
            >
              <Github className="w-4 h-4 text-white" />
              <span>Continue with GitHub</span>
            </button>

            {/* Direct GitHub Token (PAT) Option */}
            <div className="pt-2 border-t border-[#1C2028]">
              <button
                type="button"
                onClick={() => setShowTokenForm(!showTokenForm)}
                className="w-full text-center text-xs text-[#896EFF] hover:text-[#7657FF] font-medium flex items-center justify-center gap-1.5 py-1 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{showTokenForm ? 'Hide Token Sign-In' : 'Or Sign In with GitHub Token (PAT)'}</span>
              </button>

              {showTokenForm && (
                <form
                  onSubmit={handleTokenSubmit}
                  className="mt-3 space-y-3 p-4 rounded-xl bg-[#0B0D11] border border-[#252932]"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#D1D5DC]">Personal Access Token</span>
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=REGRAVA%20Security%20Scanner"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#896EFF] hover:underline flex items-center gap-1 text-[10px]"
                    >
                      Generate Token <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 rounded-lg bg-[#15181F] border border-[#252932] text-xs text-[#F5F6F8] placeholder-[#707783] focus:outline-none focus:border-[#7657FF] font-mono"
                  />

                  <p className="text-[10px] text-[#707783] leading-relaxed">
                    Instantly load and scan your real public or private repositories without configuring GitHub OAuth.
                  </p>

                  <button
                    type="submit"
                    disabled={isConnectingToken || !tokenInput.trim()}
                    className="w-full py-2.5 px-3 rounded-lg bg-[#7657FF] hover:bg-[#896EFF] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 9. FOOTER */}
      {/* ========================================================================= */}
      <footer className="relative z-10 border-t border-[#1C2028] bg-[#0B0D11] py-12 px-6 lg:px-12 text-xs text-[#707783] reveal-on-scroll">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src="/regrava-icon.png"
              alt="REGRAVA"
              className="w-7 h-7 rounded-lg object-contain border border-[#252932]"
            />
            <div>
              <span className="font-bold text-[#F5F6F8] tracking-tight">REGRAVA Platform</span>
              <p className="text-[11px] text-[#707783]">
                Deterministic Security & Full-Stack Contract Sentinel for Pull Requests.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-[#9299A5]">
            <a
              href="https://github.com/Myparadox-creator/REGRAVA"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#F5F6F8] flex items-center gap-1.5 transition-colors"
            >
              <Github className="w-3.5 h-3.5" /> GitHub Repository
            </a>
            <span className="text-[#252932]">•</span>
            <span>Zero-Retention Certified</span>
            <span className="text-[#252932]">•</span>
            <span>&copy; {new Date().getFullYear()} REGRAVA</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
