import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FindingDetailModal } from './components/FindingDetailModal';
import { AuthPage } from './pages/AuthPage';
import { OverviewPage } from './pages/OverviewPage';
import { SecurityDashboardPage } from './pages/SecurityDashboardPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { PullRequestsPage } from './pages/PullRequestsPage';
import { FindingsPage } from './pages/FindingsPage';
import { AnalysisHistoryPage } from './pages/AnalysisHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  UserProfile,
  GitHubAccount,
  RepositoryItem,
  PullRequestItem,
  PRAnalysisResult,
  Finding,
  AnalysisHistoryItem,
  FleetSecurityPosture,
} from './types';
import {
  fetchAuthStatus,
  loginDemo,
  logout,
  fetchAuthorizedRepositories,
  fetchRepoPullRequests,
  runPullRequestAnalysis,
  fetchAnalysisHistory,
  updateFindingReview,
  connectGitHubToken,
  disconnectGitHub,
  fetchSecurityPosture,
  triggerRepositoryAudit,
} from './services/api';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [githubAccount, setGithubAccount] = useState<GitHubAccount | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<RepositoryItem | null>(null);
  const [pullRequests, setPullRequests] = useState<PullRequestItem[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<PRAnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [securityPosture, setSecurityPosture] = useState<FleetSecurityPosture | null>(null);
  const [selectedSecurityRepo, setSelectedSecurityRepo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Check auth status on launch and handle GitHub / Google redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ghAuth = params.get('github_auth');
    const googleAuth = params.get('google_auth');
    const token = params.get('token');

    if (token) {
      localStorage.setItem('regrava_token', token);
    }

    if (ghAuth === 'success' || googleAuth === 'success' || token) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setCurrentTab('overview');
      checkAuth();
    } else if (ghAuth === 'error' || googleAuth === 'error') {
      const msg = params.get('msg') || (googleAuth === 'error' ? 'Google OAuth failed' : 'GitHub OAuth failed');
      setAppError(msg);
      window.history.replaceState({}, document.title, window.location.pathname);
      checkAuth();
    } else {
      checkAuth();
    }
  }, []);

  const checkAuth = async () => {
    try {
      const data = await fetchAuthStatus();
      if (data.authenticated && data.user) {
        setIsAuthenticated(true);
        setUser(data.user);
        setGithubAccount(data.github_account);
        setCurrentTab('overview');
        loadInitialData();
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      // If error or unauthenticated, prompt auth
      setIsAuthenticated(false);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const loadPostureData = async () => {
    try {
      const post = await fetchSecurityPosture();
      setSecurityPosture(post);
    } catch {
      // Ignore background posture fetch failures
    }
  };

  const loadInitialData = async () => {
    try {
      const repos = await fetchAuthorizedRepositories();
      setRepositories(repos);
      if (repos.length > 0) {
        const primaryRepo = repos[0];
        setSelectedRepo(primaryRepo);
        const pulls = await fetchRepoPullRequests(primaryRepo.owner, primaryRepo.name);
        setPullRequests(pulls);

        // Pre-run or load initial demo analysis for showcase if on PR #42
        if (pulls.some((p) => p.number === 42)) {
          runScan(primaryRepo.owner, primaryRepo.name, 42);
        }
      }
      const hist = await fetchAnalysisHistory();
      setHistory(hist);
      await loadPostureData();
    } catch (err: any) {
      if (err.message && err.message.includes('Authentication required')) {
        checkAuth();
      } else {
        setAppError(err.message || 'Failed to load initial data');
      }
    }
  };

  const handleDemoLogin = async () => {
    setIsLoggingIn(true);
    setAppError(null);
    try {
      const res = await loginDemo();
      if (res.token) {
        localStorage.setItem('regrava_token', res.token);
      }
      setUser(res.user);
      setIsAuthenticated(true);
      await checkAuth();
    } catch (err: any) {
      setAppError(err.message || 'Demo login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Ignore network errors on logout
    }
    localStorage.removeItem('regrava_token');
    setIsAuthenticated(false);
    setUser(null);
    setGithubAccount(null);
    setRepositories([]);
    setCurrentAnalysis(null);
  };

  const handleConnectGitHubToken = async (token: string) => {
    setIsLoggingIn(true);
    setAppError(null);
    try {
      const res = await connectGitHubToken(token);
      if ((res as any).token) {
        localStorage.setItem('regrava_token', (res as any).token);
      }
      if (res.user) {
        setUser(res.user);
      }
      setIsAuthenticated(true);
      await checkAuth();
    } catch (err: any) {
      setAppError(err.message || 'Failed to authenticate with GitHub token');
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      await disconnectGitHub();
      await checkAuth();
    } catch (err: any) {
      setAppError(err.message || 'Failed to disconnect GitHub');
    }
  };

  const runScan = async (owner: string, repo: string, prNumber: number) => {
    setIsLoading(true);
    setAppError(null);
    try {
      const analysis = await runPullRequestAnalysis(owner, repo, prNumber);
      setCurrentAnalysis(analysis);
      const updatedHistory = await fetchAnalysisHistory();
      setHistory(updatedHistory);
      loadPostureData();
    } catch (err: any) {
      setAppError(err.message || 'Scan failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuditRepo = async (owner: string, repo: string) => {
    setIsLoading(true);
    setAppError(null);
    try {
      await triggerRepositoryAudit(owner, repo);
      await loadPostureData();
      const hist = await fetchAnalysisHistory();
      setHistory(hist);
    } catch (err: any) {
      setAppError(err.message || `Failed to audit ${owner}/${repo}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRepoByName = async (repoFullName: string) => {
    const target = repositories.find(
      (r) => r.full_name.toLowerCase() === repoFullName.toLowerCase()
    );
    if (target) {
      await handleSelectRepo(target);
    } else {
      setCurrentTab('pulls');
    }
  };

  const handleSelectRepo = async (repo: RepositoryItem) => {
    setSelectedRepo(repo);
    try {
      const pulls = await fetchRepoPullRequests(repo.owner, repo.name);
      setPullRequests(pulls);
      setCurrentTab('pulls');
    } catch (err: any) {
      setAppError(err.message || 'Failed to fetch PRs for repository');
    }
  };

  const handleAnalyzeSecurityForRepo = (repoFullName: string) => {
    setSelectedSecurityRepo(repoFullName);
    setCurrentTab('security');
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'security' && currentTab !== 'security') {
      setSelectedSecurityRepo(null);
    }
    setCurrentTab(tab);
  };

  const handleUpdateFindingStatus = async (
    findingId: string,
    status: 'reviewed' | 'dismissed' | 'open',
    notes?: string
  ) => {
    if (!currentAnalysis) return;
    try {
      await updateFindingReview(currentAnalysis.id, findingId, status, notes);

      // Update in currentAnalysis
      setCurrentAnalysis((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          findings: prev.findings.map((f) =>
            f.id === findingId ? { ...f, review_status: status, review_notes: notes } : f
          ),
        };
      });

      // Update in selectedFinding
      if (selectedFinding && selectedFinding.id === findingId) {
        setSelectedFinding((prev) =>
          prev ? { ...prev, review_status: status, review_notes: notes } : null
        );
      }

      // Refresh posture scores
      loadPostureData();
    } catch (err: any) {
      setAppError(err.message || 'Failed to update finding status');
    }
  };

  // Loading screen while verifying session/token
  if (isAuthChecking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#08090C] text-[#D1D5DC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#7657FF] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#666D7C] font-mono tracking-wider">INITIALIZING REGRAVA...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated, show standalone AuthPage
  if (!isAuthenticated) {
    return (
      <AuthPage
        onLoginDemo={handleDemoLogin}
        isLoggingIn={isLoggingIn}
        onConnectToken={handleConnectGitHubToken}
      />
    );
  }

  const openFindingsCount =
    currentAnalysis?.findings?.filter((f) => !f.review_status || f.review_status === 'open').length || 0;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#08090C] font-sans text-[#D1D5DC]">
      {/* Sidebar (Desktop permanent + Mobile slide-out drawer + Mobile bottom bar) */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          handleTabChange(tab);
          setIsMobileMenuOpen(false);
        }}
        openFindingsCount={openFindingsCount}
        githubAccount={githubAccount}
        user={user}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenMobile={() => setIsMobileMenuOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          user={user}
          githubAccount={githubAccount}
          onLogout={handleLogout}
          onOpenGitHubSetup={() => setCurrentTab('settings')}
          onSwitchToDemo={handleDemoLogin}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        {/* Global Error Banner */}
        {appError && (
          <div className="bg-[#F04452]/10 border-b border-[#F04452]/25 px-6 py-2.5 text-xs text-[#F04452] flex items-center justify-between">
            <span>{appError}</span>
            <button
              onClick={() => setAppError(null)}
              className="font-bold hover:underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active Page View */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {currentTab === 'overview' && (
            <OverviewPage
              repositories={repositories}
              latestAnalysis={currentAnalysis}
              isLoading={isLoading}
              onScanPR={runScan}
              onSelectFinding={setSelectedFinding}
              onNavigateToTab={setCurrentTab}
              onConnectGitHub={() => setCurrentTab('settings')}
              onAnalyzeSecurity={handleAnalyzeSecurityForRepo}
            />
          )}

          {currentTab === 'security' && (
            <SecurityDashboardPage
              posture={securityPosture}
              isLoading={isLoading}
              selectedRepoName={selectedSecurityRepo}
              onSelectRepoName={setSelectedSecurityRepo}
              onRefresh={loadPostureData}
              onAuditRepo={handleAuditRepo}
              onSelectRepoForPRs={handleSelectRepoByName}
              onNavigateToFindings={() => setCurrentTab('findings')}
              onSelectFinding={setSelectedFinding}
            />
          )}

          {currentTab === 'repos' && (
            <RepositoriesPage
              repositories={repositories}
              isLoading={isLoading}
              onRefresh={loadInitialData}
              onSelectRepo={handleSelectRepo}
              onConnectGitHub={() => setCurrentTab('settings')}
              onAnalyzeSecurity={handleAnalyzeSecurityForRepo}
            />
          )}

          {currentTab === 'pulls' && (
            <PullRequestsPage
              repositories={repositories}
              selectedRepo={selectedRepo}
              onSelectRepo={handleSelectRepo}
              pullRequests={pullRequests}
              currentAnalysis={currentAnalysis}
              isLoading={isLoading}
              onAnalyzePR={runScan}
              onSelectFinding={setSelectedFinding}
            />
          )}

          {currentTab === 'findings' && (
            <FindingsPage
              findings={currentAnalysis?.findings || []}
              onSelectFinding={setSelectedFinding}
            />
          )}

          {currentTab === 'history' && (
            <AnalysisHistoryPage
              history={history}
              isLoading={isLoading}
              onRefresh={async () => {
                const hist = await fetchAnalysisHistory();
                setHistory(hist);
              }}
              onSelectHistoryItem={(_item) => {
                setCurrentTab('pulls');
              }}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              user={user}
              githubAccount={githubAccount}
              onLogout={handleLogout}
              onConnectGitHub={() => setCurrentTab('settings')}
              onConnectToken={handleConnectGitHubToken}
              onDisconnectGitHub={handleDisconnectGitHub}
            />
          )}
        </main>
      </div>

      {/* Finding Detail Modal with Triage & AI Prompt Steering */}
      <FindingDetailModal
        finding={selectedFinding}
        analysisId={currentAnalysis?.id}
        onClose={() => setSelectedFinding(null)}
        onUpdateStatus={handleUpdateFindingStatus}
      />
    </div>
  );
}

export default App;
