import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Github,
  ArrowRight,
  ArrowLeft,
  Layers,
  AlertCircle,
  KeyRound,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Terminal,
  Zap,
  Copy,
  Check,
  ChevronDown,
  Code2,
  Users,
  BarChart3,
  CheckCheck,
  HelpCircle,
  Sliders,
  Network,
  Radio,
  Flame,
  Lock,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { getGoogleAuthUrl, getGitHubAuthUrl } from '../services/api';
import { GitHubOAuthSetupModal } from '../components/GitHubOAuthSetupModal';

interface AuthPageProps {
  onLoginDemo: () => Promise<void>;
  isLoggingIn: boolean;
  onConnectToken?: (token: string) => Promise<void>;
}

type GraphScenario = 'healthy' | 'broken' | 'healed' | 'sqli' | 'secret';

interface LayerState {
  id: number;
  name: string;
  category: string;
  status: 'clean' | 'threat' | 'remediated';
  points: number;
  runtimeLatency: string;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onLoginDemo,
  isLoggingIn,
  onConnectToken,
}) => {
  // Page Routing State: 'landing' vs 'signin'
  const [currentView, setCurrentView] = useState<'landing' | 'signin'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'signin' || window.location.hash === '#signin'
      ? 'signin'
      : 'landing';
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showOAuthSetup, setShowOAuthSetup] = useState(false);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [isConnectingToken, setIsConnectingToken] = useState(false);

  // Telemetry & Clock
  const [microClock, setMicroClock] = useState('00:00:00.000');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showFloatingPill, setShowFloatingPill] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  // Interactive AST Graph Visualizer State
  const [graphScenario, setGraphScenario] = useState<GraphScenario>('broken');
  const [activeAstNode, setActiveAstNode] = useState<string | null>('fastapi');
  const [copiedTestProof, setCopiedTestProof] = useState(false);

  // In-Browser CLI Terminal Simulator State
  const [terminalLog, setTerminalLog] = useState<string[]>([
    '$ regrava scan --pr 42 --zero-retention --cross-repo',
    '⚡ Initializing ephemeral in-memory memory sandbox (0-disk retention)...',
    '✓ AST Syntax Tree generated for backend [app/schemas/user.py] (9.4ms)',
    '✓ Linked frontend repository registered: [Myparadox-creator/REGRAVA-frontend]',
    '✓ Cross-boundary router mapped 14 consumer TSX/JSX AST components (16.2ms)',
    '🚨 CRITICAL REGRESSION: Field "user_id" removed in backend response schema.',
    '   Affected Consumer: frontend/src/components/UserProfile.tsx:34 <UserProfile id={user_id}/>',
    '   Runtime Impact: Uncaught TypeError: Cannot read properties of undefined (reading "user_id")',
    '✓ Auto-synthesized Vitest contract proof generated at .regrava/proofs/test_pr42.ts (3.1ms)',
    '✨ Analysis finished in 34.2ms | 0 bytes persisted | Zero cloud retention.',
  ]);
  const [terminalExecuting, setTerminalExecuting] = useState(false);

  // Stochastic vs Deterministic Arena Toggle
  const [arenaMode, setArenaMode] = useState<'deterministic' | 'stochastic'>('deterministic');

  // Interactive 7-Layer Constellation State
  const [layers, setLayers] = useState<LayerState[]>([
    { id: 1, name: 'Cross-Boundary Contract Guard', category: 'AST Interface Graph', status: 'threat', points: 15, runtimeLatency: '11.2ms' },
    { id: 2, name: 'Deterministic Taint & SQLi', category: 'Syntax Tree Taint', status: 'clean', points: 15, runtimeLatency: '8.4ms' },
    { id: 3, name: 'High-Entropy Secret Analyzer', category: 'Shannon Entropy', status: 'clean', points: 15, runtimeLatency: '4.1ms' },
    { id: 4, name: 'Multi-Tenant Tenancy Filter', category: 'AST Isolation Check', status: 'threat', points: 15, runtimeLatency: '9.8ms' },
    { id: 5, name: 'Automated Vitest/pytest Proofs', category: 'Formal Verification', status: 'clean', points: 15, runtimeLatency: '12.0ms' },
    { id: 6, name: 'Dependency Lockfile Health', category: 'OSV / CVE Graph', status: 'clean', points: 15, runtimeLatency: '6.7ms' },
    { id: 7, name: 'Zero-Retention RAM Sandbox', category: 'Ephemeral In-Memory', status: 'clean', points: 10, runtimeLatency: '2.0ms' },
  ]);

  // Financial ROI Engine State
  const [teamSize, setTeamSize] = useState<number>(25);
  const [prWeeklyVelocity, setPrWeeklyVelocity] = useState<number>(45);

  // Technical FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Canvas Ref for Ambient Particle Constellation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // View Navigation Helpers
  const navigateToSignIn = () => {
    setCurrentView('signin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'signin');
    window.history.pushState({}, '', url.toString());
  };

  const navigateToLanding = () => {
    setCurrentView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.history.pushState({}, '', url.toString());
  };

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setCurrentView(params.get('view') === 'signin' ? 'signin' : 'landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Background Canvas Ambient Particles with Mouse Connection
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes
    const particleCount = Math.min(width < 768 ? 35 : 70, 80);
    const particles = Array.from({ length: particleCount }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: Math.random() * 1.8 + 0.8,
      hue: Math.random() > 0.6 ? 260 : 160,
    }));

    let mouseX = -1000;
    let mouseY = -1000;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(118, 87, 255, ${0.15 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }

        // Mouse interaction beam
        const mdx = particles[i].x - mouseX;
        const mdy = particles[i].y - mouseY;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 140) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouseX, mouseY);
          ctx.strokeStyle = `rgba(16, 185, 129, ${0.28 * (1 - mdist / 140)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Particle update
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;

        if (particles[i].x < 0 || particles[i].x > width) particles[i].vx *= -1;
        if (particles[i].y < 0 || particles[i].y > height) particles[i].vy *= -1;

        ctx.beginPath();
        ctx.arc(particles[i].x, particles[i].y, particles[i].radius, 0, Math.PI * 2);
        ctx.fillStyle = particles[i].hue === 260 ? 'rgba(137, 110, 255, 0.7)' : 'rgba(16, 185, 129, 0.7)';
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [currentView]);

  // Telemetry Micro-Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      setMicroClock(`${h}:${m}:${s}.${ms}`);
    }, 47);
    return () => clearInterval(timer);
  }, []);

  // Scroll Progress and Observer
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setScrollProgress((window.scrollY / totalHeight) * 100);
      }
      setShowFloatingPill(window.scrollY > 450);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (currentView !== 'landing') return;

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
  }, [layers, graphScenario, currentView]);

  // Execute Simulated CLI Commands
  const runTerminalCommand = (cmd: string) => {
    setTerminalExecuting(true);
    setTerminalLog((prev) => [...prev, `$ ${cmd}`, '⚡ Running deterministic compiler telemetry...']);

    setTimeout(() => {
      if (cmd.includes('cross-repo') || cmd.includes('pr 42')) {
        setTerminalLog((prev) => [
          ...prev,
          '✓ In-memory volatile RAM initialized at 0x7FFF940B (0.0ms)',
          '✓ Parsed backend Pydantic schema in 12.4ms',
          '✓ Cross-analyzed 14 frontend TSX files in 18.2ms',
          '🚨 1 Breaking Contract detected on consumer <UserProfile id={user_id}/>',
          '✨ Synthesized test proof at .regrava/test_contract.spec.ts in 3.6ms',
        ]);
      } else if (cmd.includes('taint')) {
        setTerminalLog((prev) => [
          ...prev,
          '✓ AST Taint Analysis started on 4 modified database functions...',
          '🚨 TAINT VIOLATION: Variable client_query flows unescaped to db.fetch_all()',
          '✓ Auto-generated parameterized query patch recommended (14.2ms)',
        ]);
      } else {
        setTerminalLog((prev) => [
          ...prev,
          '✓ Fleet Security Radar scanned 12 repositories across 7 layers.',
          '✓ Zero code retention certified. Ephemeral memory wiped.',
          '✨ Fleet Posture Score: 98.4 / 100 [SECURE]',
        ]);
      }
      setTerminalExecuting(false);
    }, 600);
  };

  const handleToggleLayer = (id: number) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          return {
            ...l,
            status: l.status === 'threat' ? 'remediated' : 'threat',
          };
        }
        return l;
      })
    );
  };

  const fleetScore = layers.reduce((acc, l) => {
    return l.status === 'clean' || l.status === 'remediated' ? acc + l.points : acc;
  }, 0);

  // Dynamic ROI computations
  const totalPrsMonthly = prWeeklyVelocity * 4.3;
  const hoursSavedMonthly = Math.round(teamSize * 15.5);
  const dollarsSavedMonthly = Math.round(hoursSavedMonthly * 82);
  const outagesPreventedYearly = Math.max(1, Math.round(teamSize * 0.32));
  const financialRoiMultiplier = ((dollarsSavedMonthly * 12) / (teamSize * 240)).toFixed(1);

  const scrollToGraph = () => {
    const el = document.getElementById('interactive-ast-graph');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const copyToClipboard = (text: string, type: 'cli' | 'proof') => {
    navigator.clipboard.writeText(text);
    if (type === 'cli') {
      setCopiedCli(true);
      setTimeout(() => setCopiedCli(false), 2000);
    } else {
      setCopiedTestProof(true);
      setTimeout(() => setCopiedTestProof(false), 2000);
    }
  };

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
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize Google authentication');
    }
  };

  const handleGitHubLogin = async () => {
    setErrorMsg(null);
    try {
      const res = await getGitHubAuthUrl();
      if (res.is_configured && res.url && !res.url.includes('action=github_setup')) {
        window.location.href = res.url;
      } else {
        setShowOAuthSetup(true);
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

  const frameworks = [
    'FastAPI',
    'Next.js 15',
    'React 19',
    'TypeScript 5.7',
    'Pydantic v2',
    'Go 1.23',
    'Python 3.12',
    'Vitest',
    'Pytest',
    'GitHub Actions',
    'Node.js',
    'PostgreSQL',
    'GraphQL',
    'Docker',
    'Turborepo',
  ];

  // =========================================================================
  // DEDICATED SIGN-IN / AUTHENTICATION PAGE VIEW
  // =========================================================================
  if (currentView === 'signin') {
    return (
      <div className="min-h-screen w-full bg-[#08090C] text-[#D1D5DC] font-sans antialiased selection:bg-[#7657FF]/35 selection:text-white relative flex flex-col justify-between overflow-x-hidden">
        {/* Ambient Canvas and Flare */}
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none z-0 opacity-40"
        />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[550px] bg-gradient-to-b from-[#7657FF]/20 via-[#48366F]/10 to-transparent blur-[140px] pointer-events-none z-0" />

        {/* Top Header */}
        <header className="relative z-10 px-6 lg:px-12 py-4 border-b border-[#1C2028] bg-[#0B0D11]/90 backdrop-blur-xl flex items-center justify-between">
          <button
            onClick={navigateToLanding}
            className="flex items-center gap-2 text-xs font-semibold text-[#9299A5] hover:text-[#F5F6F8] px-3 py-1.5 rounded-lg hover:bg-[#15181F] border border-transparent hover:border-[#252932] transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-[#896EFF]" />
            <span>Back to Home</span>
          </button>

          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={navigateToLanding}
          >
            <img
              src="/regrava-icon.png"
              alt="REGRAVA"
              className="w-8 h-8 rounded-lg object-contain border border-[#252932] bg-[#08090C]"
            />
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-[#F5F6F8]">REGRAVA</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#211A35] text-[#896EFF] border border-[#48366F]">
                v2.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-[#10B981]">
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Zero-Retention In-Memory Engine</span>
          </div>
        </header>

        {/* Main Dedicated Sign-In Container */}
        <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md space-y-6">
            {/* Brand Banner Card */}
            <div className="rounded-2xl overflow-hidden border border-[#252932] shadow-2xl bg-[#111318]">
              <img
                src="/regrava-banner.png"
                alt="REGRAVA - Review, Track, Verify, Merge with Confidence"
                className="w-full h-auto object-cover"
              />
            </div>

            {/* Headline Text */}
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-black tracking-tight text-[#F5F6F8]">
                Sign in to REGRAVA
              </h1>
              <p className="text-xs text-[#9299A5]">
                Inspect your pull requests, map cross-repo contracts, and eliminate breaking changes.
              </p>
            </div>

            {/* Error Alert if any */}
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-[#F04452]/15 border border-[#F04452]/30 text-xs text-[#F04452] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{errorMsg}</div>
              </div>
            )}

            {/* Main Auth Box */}
            <div className="p-7 rounded-2xl bg-[#111318] border border-[#252932] shadow-2xl space-y-4 glow-purple">
              {/* Primary 1-Click Demo Sandbox */}
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
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#7657FF] to-[#896EFF] hover:brightness-110 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-purple-950/60 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-white" />
                <span>{isLoggingIn ? 'Launching Sandbox...' : 'Explore Demo Sandbox (1-Click)'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <div className="flex items-center gap-3 my-2">
                <div className="h-px bg-[#252932] flex-1" />
                <span className="text-[11px] font-semibold text-[#707783] uppercase tracking-wider font-mono">
                  Or Sign In
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

              {/* Real GitHub OAuth Login */}
              <button
                onClick={handleGitHubLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-[#211A35] hover:bg-[#2C2248] border border-[#48366F] text-[#F5F6F8] text-xs font-semibold flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95"
              >
                <Github className="w-4 h-4 text-white" />
                <span>Continue with GitHub (OAuth)</span>
              </button>

              <div className="flex items-center justify-between text-[11px] px-1 pt-1">
                <button
                  type="button"
                  onClick={() => setShowOAuthSetup(true)}
                  className="text-[#896EFF] hover:underline flex items-center gap-1"
                >
                  <span>Configure OAuth App</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTokenForm(!showTokenForm)}
                  className="text-[#707783] hover:text-[#9299A5]"
                >
                  {showTokenForm ? 'Hide Token' : 'Or use manual token'}
                </button>
              </div>

              {/* Direct GitHub Token (PAT) Option (Collapsible) */}
              {showTokenForm && (
                <div className="pt-2 border-t border-[#1C2028]">
                  <form
                    onSubmit={handleTokenSubmit}
                    className="space-y-3 p-4 rounded-xl bg-[#0B0D11] border border-[#252932]"
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
                      Manual fallback to scan repositories without configuring GitHub OAuth.
                    </p>

                    <button
                      type="submit"
                      disabled={isConnectingToken || !tokenInput.trim()}
                      className="w-full py-2.5 px-3 rounded-lg bg-[#1B1F27] hover:bg-[#252932] border border-[#252932] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
                </div>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-[#111318] border border-[#1C2028] space-y-1">
                <Cpu className="w-4 h-4 mx-auto text-[#896EFF]" />
                <div className="text-[11px] font-semibold text-[#F5F6F8]">Deterministic</div>
                <div className="text-[10px] text-[#707783]">AST Engine</div>
              </div>
              <div className="p-3 rounded-xl bg-[#111318] border border-[#1C2028] space-y-1">
                <Lock className="w-4 h-4 mx-auto text-[#10B981]" />
                <div className="text-[11px] font-semibold text-[#F5F6F8]">Zero Retention</div>
                <div className="text-[10px] text-[#707783]">100% In-Memory</div>
              </div>
              <div className="p-3 rounded-xl bg-[#111318] border border-[#1C2028] space-y-1">
                <ShieldCheck className="w-4 h-4 mx-auto text-[#F59E0B]" />
                <div className="text-[11px] font-semibold text-[#F5F6F8]">Read-Only</div>
                <div className="text-[10px] text-[#707783]">Minimal Scopes</div>
              </div>
            </div>
          </div>
        </main>

        {/* Sign-In Footer */}
        <footer className="relative z-10 px-8 py-4 border-t border-[#1C2028] text-center text-xs text-[#707783]">
          &copy; {new Date().getFullYear()} REGRAVA Platform &bull; Zero-Retention Security Architecture
        </footer>

        {/* GitHub OAuth Setup Modal */}
        <GitHubOAuthSetupModal
          isOpen={showOAuthSetup}
          onClose={() => setShowOAuthSetup(false)}
          onConfigured={(authUrl) => {
            setShowOAuthSetup(false);
            window.location.href = authUrl;
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // THE ASTONISHING LANDING PAGE VIEW
  // =========================================================================
  return (
    <div className="min-h-screen w-full bg-[#08090C] text-[#D1D5DC] font-sans antialiased selection:bg-[#7657FF]/35 selection:text-white relative overflow-x-hidden">
      {/* Background Ambient Canvas Constellation */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0 opacity-45"
      />

      {/* Radiant Ambient Radial Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-[#7657FF]/20 via-[#48366F]/10 to-transparent blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 right-10 w-[600px] h-[500px] bg-gradient-to-t from-[#10B981]/15 to-transparent blur-[160px] pointer-events-none z-0" />

      {/* Top Scroll Depth Progress Bar */}
      <div
        className="fixed top-0 left-0 h-[2.5px] bg-gradient-to-r from-[#7657FF] via-[#A78BFA] to-[#10B981] z-50 transition-all duration-75 shadow-lg shadow-purple-500/50"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Floating Bottom Quick-Action Pill (appears on scroll) */}
      <aside
        aria-label="Quick Actions"
        className={`fixed bottom-6 right-6 z-40 transition-all duration-500 ease-out ${
          showFloatingPill
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-6 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#111318]/90 backdrop-blur-2xl border border-[#48366F] shadow-2xl shadow-purple-950/70 glow-purple">
          <button
            onClick={onLoginDemo}
            disabled={isLoggingIn}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#7657FF] to-[#896EFF] hover:brightness-110 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5 text-white animate-spin-slow" />
            <span>{isLoggingIn ? 'Spinning Sandbox...' : 'Launch 1-Click Sandbox'}</span>
          </button>
          <button
            onClick={navigateToSignIn}
            className="p-2 rounded-xl text-[#9299A5] hover:text-[#F5F6F8] hover:bg-[#15181F] transition-colors"
            title="Sign In to REGRAVA"
          >
            <Github className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 0. PERSISTENT TELEMETRY HEADER */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#0B0D11]/80 border-b border-[#1C2028] px-6 lg:px-12 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="relative">
              <img
                src="/regrava-icon.png"
                alt="REGRAVA"
                className="w-8 h-8 rounded-lg object-contain border border-[#252932] bg-[#08090C] shadow-md shadow-purple-950/20 group-hover:border-[#7657FF] transition-all"
              />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#10B981] border-2 border-[#0B0D11]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-[#F5F6F8]">REGRAVA</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#211A35] text-[#896EFF] border border-[#48366F]">
                v2.0
              </span>
            </div>
            <div className="hidden xl:flex items-center gap-2 ml-4 pl-4 border-l border-[#252932] text-[11px] font-mono text-[#707783]">
              <span className="text-[#10B981] font-semibold flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" /> AST LIVE
              </span>
              <span>•</span>
              <span>LATENCY: &lt; 34.2ms</span>
              <span>•</span>
              <span className="text-[#9299A5]">{microClock}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-medium text-[#9299A5]">
            <a href="#interactive-ast-graph" className="hover:text-[#F5F6F8] transition-colors flex items-center gap-1">
              <Network className="w-3.5 h-3.5 text-[#896EFF]" />
              <span>Neural AST Graph</span>
            </a>
            <a href="#cli-terminal" className="hover:text-[#F5F6F8] transition-colors flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5 text-[#10B981]" />
              <span>CLI Simulator</span>
            </a>
            <a href="#head-to-head" className="hover:text-[#F5F6F8] transition-colors">
              Stochastic vs. AST
            </a>
            <a href="#constellation" className="hover:text-[#F5F6F8] transition-colors">
              7-Layer Radar
            </a>
            <a href="#roi-engine" className="hover:text-[#F5F6F8] transition-colors">
              Financial ROI
            </a>
            <a href="#faq" className="hover:text-[#F5F6F8] transition-colors">
              FAQ
            </a>
          </nav>

          {/* Right CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={navigateToSignIn}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#D1D5DC] hover:text-[#F5F6F8] hover:bg-[#15181F] border border-transparent hover:border-[#252932] transition-all"
            >
              Sign In
            </button>
            <button
              onClick={onLoginDemo}
              disabled={isLoggingIn}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-[#7657FF] to-[#896EFF] hover:brightness-110 text-white shadow-lg shadow-purple-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>{isLoggingIn ? 'Launching...' : '1-Click Sandbox'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-14 pb-28 space-y-36">
        {/* ========================================================================= */}
        {/* 1. HERO SECTION: CYBERNETIC COMMAND DECK */}
        {/* ========================================================================= */}
        <section className="text-center pt-8 pb-4 max-w-5xl mx-auto space-y-8 reveal-on-scroll is-visible">
          {/* Cybernetic Telemetry Pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#111318]/90 backdrop-blur-md border border-[#48366F] shadow-lg shadow-purple-950/40 text-xs font-mono text-[#D1D5DC]">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
            </span>
            <span className="text-[#F5F6F8] font-bold">BUILT FOR ZERO-OUTAGE TEAMS</span>
            <span className="text-[#48366F]">|</span>
            <span className="text-[#896EFF]">SUB-35MS COMPILER SENTINEL</span>
            <span className="text-[#48366F]">|</span>
            <span className="text-[#10B981]">DETERMINISTIC COMPILER &bull; TEST SYNTHESIS</span>
          </div>

          {/* Monumental Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#F5F6F8] leading-[1.08]">
            Your code passed review. <br />
            <span className="text-hologram">Did the risks?</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-[#9299A5] max-w-3xl mx-auto leading-relaxed">
            REGRAVA independently examines pull requests, connects security findings with code changes, and tracks every issue until its resolution is checked.
          </p>

          {/* CLI Copy Chip + CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
            <button
              onClick={onLoginDemo}
              disabled={isLoggingIn}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#7657FF] via-[#896EFF] to-[#7657FF] bg-size-200 hover:brightness-110 text-white font-extrabold text-sm shadow-2xl shadow-purple-900/60 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>{isLoggingIn ? 'Spinning Sandbox...' : 'Explore Live Sandbox (1-Click)'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            {/* Quick CLI Copy Pill */}
            <div
              onClick={() => copyToClipboard('npx @regrava/sentinel scan --live', 'cli')}
              className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#111318] hover:bg-[#15181F] border border-[#252932] hover:border-[#48366F] cursor-pointer flex items-center justify-between gap-3 text-xs font-mono transition-all group"
            >
              <div className="flex items-center gap-2">
                <span className="text-[#896EFF] font-bold">$</span>
                <span className="text-[#D1D5DC]">npx @regrava/sentinel scan --live</span>
              </div>
              <span className="p-1 rounded bg-[#1B1F27] text-[#9299A5] group-hover:text-[#F5F6F8]">
                {copiedCli ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
              </span>
            </div>

            <button
              onClick={scrollToGraph}
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-semibold text-[#9299A5] hover:text-[#F5F6F8] hover:bg-[#111318] border border-transparent hover:border-[#252932] transition-all flex items-center justify-center gap-1.5"
            >
              <Network className="w-4 h-4 text-[#896EFF]" />
              <span>Interactive AST Graph ↓</span>
            </button>
          </div>

          {/* High-Tech Spec HUD Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-xl glass-obsidian">
              <div className="text-2xl font-black text-[#F5F6F8] font-mono">&lt; 34.2ms</div>
              <div className="text-xs text-[#707783] mt-0.5">AST Execution Latency</div>
            </div>
            <div className="p-4 rounded-xl glass-obsidian border-[#10B981]/30">
              <div className="text-2xl font-black text-[#10B981] font-mono">SYNTAX AST</div>
              <div className="text-xs text-[#707783] mt-0.5">Deterministic Analysis</div>
            </div>
            <div className="p-4 rounded-xl glass-obsidian border-[#896EFF]/30">
              <div className="text-2xl font-black text-[#896EFF] font-mono">0 BYTES</div>
              <div className="text-xs text-[#707783] mt-0.5">Volatile Memory Retention</div>
            </div>
            <div className="p-4 rounded-xl glass-obsidian">
              <div className="text-2xl font-black text-[#F5F6F8] font-mono">7-LAYER</div>
              <div className="text-xs text-[#707783] mt-0.5">Constellation Security Radar</div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* INFINITE FRAMEWORKS MARQUEE */}
        {/* ========================================================================= */}
        <section aria-label="Supported Technologies" className="overflow-hidden py-4 border-y border-[#1C2028] bg-[#0B0D11]/60 reveal-on-scroll">
          <div className="flex items-center gap-4 text-xs font-medium text-[#707783]">
            <span className="shrink-0 font-bold uppercase tracking-widest text-[#896EFF] text-[10px] pl-4 font-mono">
              AST COMPATIBLE:
            </span>
            <div className="overflow-hidden w-full">
              <div className="animate-marquee flex items-center gap-8 text-[#9299A5]">
                {frameworks.concat(frameworks).map((tech, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-2 hover:text-[#F5F6F8] transition-colors cursor-default whitespace-nowrap font-mono text-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#7657FF]" />
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. THE CENTERPIECE: NEURAL CROSS-BOUNDARY AST GRAPH (Interactive Laser Canvas) */}
        {/* ========================================================================= */}
        <section id="interactive-ast-graph" className="space-y-6 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider font-mono">
              <Network className="w-3.5 h-3.5" />
              <span>Interactive Compiler Traversal</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F6F8] tracking-tight">
              Live Cross-Boundary AST Graph
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Click the simulation buttons below to watch the live laser energy beam trace from FastAPI schemas to React JSX components in real time.
            </p>
          </div>

          {/* Interactive Graph Box */}
          <div className="rounded-3xl bg-[#111318] border border-[#252932] shadow-2xl overflow-hidden glow-purple">
            {/* Top Command Bar with Scenario Switches */}
            <div className="bg-[#0B0D11] border-b border-[#252932] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#F04452]" />
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                  <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                </div>
                <span className="text-xs font-mono text-[#9299A5] flex items-center gap-2">
                  <span>Graph Node Router</span>
                  <span className="text-[#48366F]">•</span>
                  <span className="text-[#10B981]">Active PR #42</span>
                </span>
              </div>

              {/* Simulation Mode Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setGraphScenario('broken')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
                    graphScenario === 'broken'
                      ? 'bg-[#F04452] text-white shadow-lg shadow-red-950/50 scale-105'
                      : 'bg-[#15181F] text-[#9299A5] hover:text-[#F5F6F8]'
                  }`}
                >
                  <span>💥 Trigger Breaking Schema</span>
                </button>

                <button
                  onClick={() => setGraphScenario('healed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
                    graphScenario === 'healed'
                      ? 'bg-[#10B981] text-white shadow-lg shadow-emerald-950/50 scale-105'
                      : 'bg-[#15181F] text-[#9299A5] hover:text-[#F5F6F8]'
                  }`}
                >
                  <span>⚡ Auto-Heal & Synthesize Test</span>
                </button>

                <button
                  onClick={() => setGraphScenario('sqli')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
                    graphScenario === 'sqli'
                      ? 'bg-[#F59E0B] text-white shadow-lg shadow-amber-950/50 scale-105'
                      : 'bg-[#15181F] text-[#9299A5] hover:text-[#F5F6F8]'
                  }`}
                >
                  <span>🛡️ Test SQLi Taint Path</span>
                </button>

                <button
                  onClick={() => setGraphScenario('secret')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
                    graphScenario === 'secret'
                      ? 'bg-[#7657FF] text-white shadow-lg shadow-purple-950/50 scale-105'
                      : 'bg-[#15181F] text-[#9299A5] hover:text-[#F5F6F8]'
                  }`}
                >
                  <span>🔑 Leaked Secret Waveform</span>
                </button>
              </div>
            </div>

            {/* Visual SVG Laser Node Canvas */}
            <div className="p-8 bg-[#08090C] relative min-h-[460px] flex flex-col justify-between overflow-hidden">
              {/* Background Graph Grid */}
              <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

              {/* Dynamic SVG Laser Beams */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <path
                  d="M 230 140 C 340 140, 360 230, 480 230"
                  fill="transparent"
                  stroke={graphScenario === 'broken' ? '#F04452' : graphScenario === 'healed' ? '#10B981' : '#7657FF'}
                  strokeWidth="3"
                  className={graphScenario === 'broken' ? 'animate-laser-broken' : 'animate-laser'}
                />

                <path
                  d="M 640 230 C 740 230, 770 140, 880 140"
                  fill="transparent"
                  stroke={graphScenario === 'broken' ? '#F04452' : graphScenario === 'healed' ? '#10B981' : '#896EFF'}
                  strokeWidth="3"
                  className={graphScenario === 'broken' ? 'animate-laser-broken' : 'animate-laser'}
                />

                <path
                  d="M 640 230 C 740 230, 770 340, 880 340"
                  fill="transparent"
                  stroke={graphScenario === 'broken' ? '#F04452' : graphScenario === 'healed' ? '#10B981' : '#896EFF'}
                  strokeWidth="3"
                  className={graphScenario === 'broken' ? 'animate-laser-broken' : 'animate-laser'}
                />
              </svg>

              {/* Interactive Node Layout */}
              <div className="relative z-20 grid grid-cols-1 md:grid-cols-3 gap-8 items-center h-full">
                {/* Node 1: Backend Endpoint & Pydantic Schema */}
                <div
                  onClick={() => setActiveAstNode('fastapi')}
                  className={`p-5 rounded-2xl glass-obsidian space-y-3 cursor-pointer transition-all ${
                    activeAstNode === 'fastapi' ? 'border-[#7657FF] glow-purple' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-[#F5F6F8] font-bold">
                      <Code2 className="w-4 h-4 text-[#896EFF]" />
                      <span>FastAPI Pydantic AST</span>
                    </span>
                    <span className="text-[10px] text-[#707783]">app/schemas/user.py</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B0D11] font-mono text-[11px] space-y-1">
                    <div className="text-[#707783]">class UserResponse(BaseModel):</div>
                    <div className="text-[#D1D5DC]">  username: str</div>
                    {graphScenario === 'broken' ? (
                      <div className="bg-[#F04452]/20 text-[#F04452] px-1 py-0.5 rounded font-bold">
                        - user_id: int &rarr; + id: int
                      </div>
                    ) : graphScenario === 'healed' ? (
                      <div className="bg-[#10B981]/20 text-[#10B981] px-1 py-0.5 rounded font-bold">
                        + id: int (Auto-Synced with client)
                      </div>
                    ) : (
                      <div className="text-[#D1D5DC]">  user_id: int</div>
                    )}
                  </div>

                  <div className="text-[10px] text-[#707783] flex items-center justify-between">
                    <span>Parsed: 9.4ms</span>
                    <span className="text-[#10B981] font-bold">Node ID #1842</span>
                  </div>
                </div>

                {/* Node 2: Central Sentinel Deterministic Router */}
                <div className="p-6 rounded-2xl bg-gradient-to-b from-[#15181F] to-[#111318] border-2 border-[#48366F] text-center space-y-3 shadow-2xl relative glow-purple">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-[#211A35] border border-[#48366F] flex items-center justify-center text-[#896EFF] shadow-lg shadow-purple-950/60">
                    <Zap className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-[#F5F6F8]">REGRAVA AST Engine</div>
                    <div className="text-[10px] font-mono text-[#896EFF]">Cross-Boundary AST Correlator</div>
                  </div>

                  {graphScenario === 'broken' && (
                    <div className="p-2.5 rounded-xl bg-[#F04452]/15 border border-[#F04452]/40 text-left space-y-1">
                      <div className="text-[11px] font-bold text-[#F04452] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>BREAKING CHANGE CAUGHT</span>
                      </div>
                      <div className="text-[10px] text-[#D1D5DC] font-mono">
                        Field "user_id" missing in 2 consumers.
                      </div>
                    </div>
                  )}

                  {graphScenario === 'healed' && (
                    <div className="p-2.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-left space-y-1">
                      <div className="text-[11px] font-bold text-[#10B981] flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>REMEDIATED & VERIFIED</span>
                      </div>
                      <div className="text-[10px] text-[#D1D5DC] font-mono">
                        Vitest contract assertion locked.
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] font-mono text-[#707783] pt-1">
                    Traversal Time: <span className="text-[#F5F6F8] font-bold">16.2ms</span>
                  </div>
                </div>

                {/* Node 3: React JSX + Mobile Consumers */}
                <div className="space-y-4">
                  {/* React Consumer */}
                  <div
                    onClick={() => setActiveAstNode('react')}
                    className={`p-4 rounded-xl glass-obsidian space-y-2 cursor-pointer transition-all ${
                      activeAstNode === 'react' ? 'border-[#896EFF]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#F5F6F8] font-bold flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>React TSX Component</span>
                      </span>
                      <span className="text-[10px] text-[#707783]">UserProfile.tsx:34</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#0B0D11] font-mono text-[10px]">
                      {graphScenario === 'broken' ? (
                        <div className="text-[#F04452]">
                          💥 &lt;Avatar id={'{data.user_id}'} /&gt; (UNDEFINED)
                        </div>
                      ) : (
                        <div className="text-[#10B981]">
                          ✓ &lt;Avatar id={'{data.id}'} /&gt; (ALIGNED)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mobile Consumer */}
                  <div className="p-4 rounded-xl glass-obsidian space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#F5F6F8] font-bold">Mobile iOS Client</span>
                      <span className="text-[10px] text-[#707783]">MobileClient.ts:88</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#0B0D11] font-mono text-[10px]">
                      {graphScenario === 'broken' ? (
                        <div className="text-[#F04452]">
                          💥 user.userId &rarr; nil pointer reference
                        </div>
                      ) : (
                        <div className="text-[#10B981]">
                          ✓ user.id &rarr; Validated
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Test Proof Strip */}
              <div className="relative z-20 mt-6 pt-4 border-t border-[#1C2028] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[#10B981] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Synthesized Proof:
                  </span>
                  <code className="text-[11px] bg-[#111318] px-2 py-1 rounded text-[#9299A5] border border-[#252932]">
                    test_contract_pr42.spec.ts (Vitest)
                  </code>
                </div>

                <button
                  onClick={() =>
                    copyToClipboard(
                      `// REGRAVA Auto-Generated Vitest Contract Proof\nimport { describe, it, expect } from 'vitest';\nimport api from '../client';\n\ndescribe('Contract Verification PR #42', () => {\n  it('verifies /api/v1/users contains id without schema mismatch', async () => {\n    const res = await api.get('/users/me');\n    expect(res.data).toHaveProperty('id');\n    expect(res.data.id).toBeTypeOf('number');\n  });\n});`,
                      'proof'
                    )
                  }
                  className="px-3 py-1 rounded-lg bg-[#211A35] hover:bg-[#2e244d] border border-[#48366F] text-[#896EFF] text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  {copiedTestProof ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTestProof ? 'Copied Assertion!' : 'Copy Vitest Assertion'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. IN-BROWSER HACKER CLI TERMINAL SIMULATOR */}
        {/* ========================================================================= */}
        <section id="cli-terminal" className="space-y-6 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#10B981] uppercase tracking-wider font-mono">
              <Terminal className="w-3.5 h-3.5" />
              <span>Interactive CLI Telemetry</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F6F8] tracking-tight">
              In-Browser Terminal Simulator
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Click the commands below to execute live simulated CI scans and witness memory buffer zeroing.
            </p>
          </div>

          <div className="rounded-3xl bg-[#0B0D11] border border-[#252932] shadow-2xl overflow-hidden glow-purple">
            {/* Terminal Header */}
            <div className="bg-[#111318] px-5 py-3 border-b border-[#252932] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#F04452]" />
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                <span className="text-xs font-mono text-[#707783] ml-2">bash - regrava@sentinel: ~</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#896EFF]">
                <span className="w-2 h-2 rounded-full bg-[#896EFF] animate-pulse" />
                <span>EPHEMERAL RAM ACTIVE</span>
              </div>
            </div>

            {/* Quick Interactive Command Buttons */}
            <div className="p-3 bg-[#15181F]/70 border-b border-[#252932] flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono text-[#707783] mr-2">Quick Run:</span>
              <button
                onClick={() => runTerminalCommand('regrava scan --pr 42 --cross-repo')}
                disabled={terminalExecuting}
                className="px-2.5 py-1 rounded bg-[#211A35] hover:bg-[#2d234a] border border-[#48366F] text-[11px] font-mono text-[#896EFF] transition-all disabled:opacity-50"
              >
                ▶ regrava scan --pr 42
              </button>
              <button
                onClick={() => runTerminalCommand('regrava check:taint --ast-deep')}
                disabled={terminalExecuting}
                className="px-2.5 py-1 rounded bg-[#111318] hover:bg-[#1B1F27] border border-[#252932] text-[11px] font-mono text-[#D1D5DC] transition-all disabled:opacity-50"
              >
                ▶ regrava check:taint
              </button>
              <button
                onClick={() => runTerminalCommand('regrava memory:wipe --verify')}
                disabled={terminalExecuting}
                className="px-2.5 py-1 rounded bg-[#111318] hover:bg-[#1B1F27] border border-[#252932] text-[11px] font-mono text-[#D1D5DC] transition-all disabled:opacity-50"
              >
                ▶ regrava memory:wipe
              </button>
              <button
                onClick={() => runTerminalCommand('regrava fleet:audit --all')}
                disabled={terminalExecuting}
                className="px-2.5 py-1 rounded bg-[#111318] hover:bg-[#1B1F27] border border-[#252932] text-[11px] font-mono text-[#D1D5DC] transition-all disabled:opacity-50"
              >
                ▶ regrava fleet:audit
              </button>
            </div>

            {/* Terminal Body Screen */}
            <div className="p-6 font-mono text-xs space-y-1.5 min-h-[300px] max-h-[420px] overflow-y-auto scanlines bg-[#08090C]">
              {terminalLog.map((line, idx) => (
                <div
                  key={idx}
                  className={`leading-relaxed ${
                    line.startsWith('$')
                      ? 'text-[#F5F6F8] font-bold'
                      : line.includes('CRITICAL') || line.includes('VIOLATION')
                      ? 'text-[#F04452] font-semibold'
                      : line.includes('✓') || line.includes('✨')
                      ? 'text-[#10B981]'
                      : 'text-[#9299A5]'
                  }`}
                >
                  {line}
                </div>
              ))}
              {terminalExecuting && (
                <div className="text-[#896EFF] animate-pulse flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Computing AST node intersections...</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. HEAD-TO-HEAD ARENA: STOCHASTIC LLM VS DETERMINISTIC AST */}
        {/* ========================================================================= */}
        <section id="head-to-head" className="space-y-8 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider font-mono">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Architectural Battle</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F6F8] tracking-tight">
              Stochastic LLM vs. Deterministic AST
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Toggle between the two engines to understand why pure prompt wrappers fail at full-stack contract reliability.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="inline-flex p-1 rounded-xl bg-[#111318] border border-[#252932]">
              <button
                onClick={() => setArenaMode('deterministic')}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                  arenaMode === 'deterministic'
                    ? 'bg-[#7657FF] text-white shadow-md'
                    : 'text-[#9299A5] hover:text-[#F5F6F8]'
                }`}
              >
                REGRAVA Deterministic AST
              </button>
              <button
                onClick={() => setArenaMode('stochastic')}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                  arenaMode === 'stochastic'
                    ? 'bg-[#F04452] text-white shadow-md'
                    : 'text-[#9299A5] hover:text-[#F5F6F8]'
                }`}
              >
                General-Purpose LLM Reviewers
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deterministic Card */}
            <div
              className={`p-7 rounded-3xl border transition-all ${
                arenaMode === 'deterministic'
                  ? 'bg-[#111318] border-[#7657FF] shadow-2xl glow-purple scale-[1.01]'
                  : 'bg-[#0B0D11]/60 border-[#1C2028] opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-[#896EFF] uppercase tracking-wider">
                  Deterministic AST Approach
                </span>
                <span className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] text-[10px] font-bold">
                  SYNTAX TREE VERIFICATION
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-[#F5F6F8] mt-3">Static Syntax & Contract Graph</h3>

              <ul className="space-y-3 mt-5 text-xs text-[#9299A5]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <span>
                    <strong>Low-Latency Diff Parsing:</strong> Executes syntax tree traversal locally within standard Git hooks or CI runners.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <span>
                    <strong>Compiler-Verified Targets:</strong> Evaluates exact schema declarations and frontend consumer symbol references.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <span>
                    <strong>In-Memory Execution:</strong> Processes diffs ephemerally in RAM with no source code retention or model fine-tuning.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <span>
                    <strong>Automated Test Synthesis:</strong> Generates reproducible client-side contract assertion tests (Vitest/pytest) from static diffs.
                  </span>
                </li>
              </ul>
            </div>

            {/* General-Purpose LLM Card */}
            <div
              className={`p-7 rounded-3xl border transition-all ${
                arenaMode === 'stochastic'
                  ? 'bg-[#111318] border-[#F04452] shadow-2xl scale-[1.01]'
                  : 'bg-[#0B0D11]/60 border-[#1C2028] opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-[#F04452] uppercase tracking-wider">
                  General-Purpose LLM Reviewers
                </span>
                <span className="px-2 py-0.5 rounded bg-[#F04452]/20 text-[#F04452] text-[10px] font-bold">
                  SEMANTIC REASONING
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-[#F5F6F8] mt-3">Prompt & Agentic Analysis</h3>

              <ul className="space-y-3 mt-5 text-xs text-[#9299A5]">
                <li className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-[#F04452] shrink-0 mt-0.5" />
                  <span>
                    <strong>Stochastic Variation:</strong> Prompt-driven outputs can vary between runs, requiring extra filtering to ensure reproducibility.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-[#F04452] shrink-0 mt-0.5" />
                  <span>
                    <strong>High Infrastructure Overhead:</strong> Deep codebase vector indexing and multi-agent reasoning require substantial token compute.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-[#F04452] shrink-0 mt-0.5" />
                  <span>
                    <strong>Enterprise Data Governance:</strong> Requires vetting cloud LLM data policies, tenancy boundaries, and SOC2/ISO compliance.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-[#F04452] shrink-0 mt-0.5" />
                  <span>
                    <strong>Inference Latency:</strong> Generating multi-turn natural language explanations takes longer than pure compiler AST parsing.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 5. 7-LAYER CONSTELLATION RADAR & LIVE FLEET HEALTH */}
        {/* ========================================================================= */}
        <section id="constellation" className="space-y-10 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider font-mono">
              <Layers className="w-3.5 h-3.5" />
              <span>Full-Stack Constellation</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F6F8] tracking-tight">
              7-Layer Deterministic Fleet Radar
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Click on the warning layers below to simulate automated auto-remediation and watch the live Fleet Health Score climb to 100%!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Live SVG Fleet Health Meter */}
            <div className="lg:col-span-4 p-8 rounded-3xl glass-obsidian text-center space-y-5 shadow-2xl">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#896EFF]">
                Simulated Fleet Posture
              </div>

              <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
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
                    stroke={fleetScore >= 85 ? '#10B981' : '#F59E0B'}
                    strokeWidth="8"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * fleetScore) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-[#F5F6F8] font-mono">
                    {fleetScore}%
                  </span>
                  <span className="text-[10px] text-[#707783] uppercase tracking-wide font-mono mt-1">
                    {fleetScore >= 85 ? 'HEALED' : 'THREATS CAUGHT'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#9299A5] leading-relaxed">
                {fleetScore === 100
                  ? '✨ All 7 deterministic AST layers verified. No breaking contract regressions detected.'
                  : '⚠️ 2 unresolved contract and tenancy regressions detected in active PR branches.'}
              </p>

              <button
                onClick={() => {
                  setLayers((prev) =>
                    prev.map((l) => ({ ...l, status: 'clean' }))
                  );
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#7657FF] to-[#896EFF] hover:brightness-110 text-white font-bold text-xs shadow-md transition-all font-mono"
              >
                Auto-Heal All 7 Layers
              </button>
            </div>

            {/* 7 Clickable Interactive Layers */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  onClick={() => handleToggleLayer(layer.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    layer.status === 'clean' || layer.status === 'remediated'
                      ? 'bg-[#111318] border-[#252932] hover:border-[#10B981]/50'
                      : 'bg-[#15181F] border-[#F59E0B]/50 hover:border-[#F59E0B]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F5F6F8] flex items-center gap-2">
                      {layer.status === 'clean' || layer.status === 'remediated' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                      )}
                      <span>{layer.name}</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        layer.status === 'clean' || layer.status === 'remediated'
                          ? 'bg-[#10B981]/15 text-[#10B981]'
                          : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                      }`}
                    >
                      {layer.status === 'clean' ? 'Passed' : layer.status === 'remediated' ? 'Healed ✓' : 'Action Req'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#707783] mt-2 font-mono">
                    <span>{layer.category}</span>
                    <span>{layer.runtimeLatency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 6. FINANCIAL ROI & TEAM VELOCITY SIMULATOR */}
        {/* ========================================================================= */}
        <section id="roi-engine" className="space-y-8 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#10B981] uppercase tracking-wider font-mono">
              <Users className="w-3.5 h-3.5" />
              <span>Financial Economics</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F6F8] tracking-tight">
              Engineering Velocity & ROI Engine
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Quantify the exact dollar return of preventing breaking changes and automating manual PR review cycles.
            </p>
          </div>

          <div className="max-w-4xl mx-auto p-8 rounded-3xl glass-obsidian space-y-8 shadow-2xl">
            {/* Dual Interactive Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#F5F6F8] flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#896EFF]" />
                    Engineers Shipping Code:
                  </span>
                  <span className="font-bold text-[#896EFF] font-mono text-sm px-3 py-1 rounded-lg bg-[#211A35] border border-[#48366F]">
                    {teamSize} Devs
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="150"
                  step="5"
                  value={teamSize}
                  onChange={(e) => setTeamSize(Number(e.target.value))}
                  className="w-full accent-[#7657FF] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#707783] font-mono">
                  <span>5 (Startup)</span>
                  <span>50 (Growth)</span>
                  <span>150+ (Enterprise)</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[#F5F6F8] flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#10B981]" />
                    Weekly PR Velocity:
                  </span>
                  <span className="font-bold text-[#10B981] font-mono text-sm px-3 py-1 rounded-lg bg-[#10B981]/15 border border-[#10B981]/30">
                    {prWeeklyVelocity} PRs / wk
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={prWeeklyVelocity}
                  onChange={(e) => setPrWeeklyVelocity(Number(e.target.value))}
                  className="w-full accent-[#10B981] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#707783] font-mono">
                  <span>10 PRs</span>
                  <span>100 PRs</span>
                  <span>200+ PRs/wk</span>
                </div>
              </div>
            </div>

            {/* Calculated Impact Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-[#252932]">
              <div className="p-4 rounded-2xl bg-[#08090C] border border-[#1C2028]">
                <div className="text-2xl font-black text-[#F5F6F8] font-mono">{hoursSavedMonthly} hrs</div>
                <div className="text-[11px] text-[#707783] mt-1">Review Saved / Mo ({Math.round(totalPrsMonthly)} PRs)</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#08090C] border border-[#1C2028]">
                <div className="text-2xl font-black text-[#10B981] font-mono">
                  ${dollarsSavedMonthly.toLocaleString()}
                </div>
                <div className="text-[11px] text-[#707783] mt-1">Direct Engineering Savings</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#08090C] border border-[#1C2028]">
                <div className="text-2xl font-black text-[#896EFF] font-mono">
                  ~{outagesPreventedYearly} Outages
                </div>
                <div className="text-[11px] text-[#707783] mt-1">Production Outages Averted</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#08090C] border border-[#1C2028]">
                <div className="text-2xl font-black text-[#F5F6F8] font-mono">{financialRoiMultiplier}x</div>
                <div className="text-[11px] text-[#707783] mt-1">Annual Net ROI Ratio</div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 7. TECHNICAL FAQ ACCORDION */}
        {/* ========================================================================= */}
        <section id="faq" className="space-y-8 scroll-mt-24 reveal-on-scroll">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#896EFF] uppercase tracking-wider font-mono">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Architectural FAQ</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F6F8] tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-[#9299A5]">
              Everything you need to know about deterministic parsing, zero-retention compliance, and deployment.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {[
              {
                q: 'How does REGRAVA compare with platforms like CodeRabbit, Qodo, or Semgrep Pro?',
                a: 'Platforms like CodeRabbit and Qodo construct comprehensive CodeGraphs, multi-linter execution sandboxes, and multi-repo software maps, while Semgrep Pro provides interprocedural taint analysis across enterprise codebases. REGRAVA focuses on a specialized, lightweight hypothesis: providing local-first, low-latency AST diff traversal specifically targeting backend-to-frontend schema drift (e.g. FastAPI to React/TSX) with zero cloud data retention and automated client-side test synthesis, without requiring heavyweight persistent graph databases.',
              },
              {
                q: 'Does any of our proprietary code get stored, logged, or used to train AI models?',
                a: 'Never. REGRAVA runs on an ephemeral in-memory memory sandbox. Once diff verification is computed, volatile RAM buffers are zeroed out (0x00000000). Your code is never persisted to disk, never sent to OpenAI/Anthropic, and never used for model training. This allows REGRAVA to pass SOC2 Type II, HIPAA, and GDPR audits in days.',
              },
              {
                q: 'How does REGRAVA correlate diffs across separate frontend and backend repositories?',
                a: 'Through our Cross-Boundary AST Graph Router. When your backend PR changes a Pydantic or Go API model, REGRAVA queries the linked frontend repository AST and identifies every component accessing that endpoint. If a field was deleted or renamed, REGRAVA alerts you immediately and generates the frontend patch.',
              },
              {
                q: 'Can we test REGRAVA without giving broad permissions to our GitHub Organization?',
                a: 'Yes! You can explore the 1-Click Demo Sandbox instantly with zero credentials. To scan your real repository, you can provide a fine-grained Personal Access Token (PAT) with read-only repository permissions, or connect our verified GitHub App.',
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl bg-[#111318] border border-[#252932] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 text-left font-bold text-xs text-[#F5F6F8] flex items-center justify-between hover:text-[#896EFF] transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#707783] transition-transform duration-300 ${
                      openFaq === idx ? 'rotate-180 text-[#896EFF]' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-4 text-xs text-[#9299A5] leading-relaxed border-t border-[#1C2028] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 8. FINAL CALL TO ACTION (Redirects to Dedicated Sign-In Page) */}
        {/* ========================================================================= */}
        <section className="max-w-4xl mx-auto pt-6 pb-12 reveal-on-scroll">
          <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-b from-[#15181F] to-[#111318] border border-[#48366F] text-center space-y-6 shadow-2xl relative overflow-hidden glow-purple">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#211A35] border border-[#48366F] text-xs font-mono text-[#896EFF]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ZERO CONFIGURATION DEPLOYMENT</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-[#F5F6F8]">
              Ready to eliminate breaking changes?
            </h2>

            <p className="text-sm text-[#9299A5] max-w-xl mx-auto leading-relaxed">
              Experience deterministic pull request protection today. Launch the 1-click sandbox or connect your GitHub repository in under 60 seconds.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={onLoginDemo}
                disabled={isLoggingIn}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#7657FF] to-[#896EFF] hover:brightness-110 text-white font-extrabold text-sm shadow-xl shadow-purple-950/60 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-white" />
                <span>{isLoggingIn ? 'Launching Sandbox...' : 'Launch Live Demo Sandbox'}</span>
              </button>

              <button
                onClick={navigateToSignIn}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#15181F] hover:bg-[#1B1F27] border border-[#252932] hover:border-[#48366F] text-[#F5F6F8] font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Github className="w-4 h-4 text-white" />
                <span>Sign In to Connect Repositories &rarr;</span>
              </button>
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

      {/* GitHub OAuth Setup Modal */}
      <GitHubOAuthSetupModal
        isOpen={showOAuthSetup}
        onClose={() => setShowOAuthSetup(false)}
        onConfigured={(authUrl) => {
          setShowOAuthSetup(false);
          window.location.href = authUrl;
        }}
      />
    </div>
  );
};
