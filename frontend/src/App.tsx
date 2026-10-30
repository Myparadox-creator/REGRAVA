import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FindingDetailModal } from './components/FindingDetailModal';
import { AuthPage } from './pages/AuthPage';
import { OverviewPage } from './pages/OverviewPage';
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
} from './services/api';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [githubAccount, setGithubAccount] = useState<GitHubAccount | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [repositories, setRepositories] = useState<RepositoryItem[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<RepositoryItem | null>(null);
  const [pullRequests, setPullRequests] = useState<PullRequestItem[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<PRAnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [appError, setAppError] = useState<string | null>(null);

  // Check auth status on launch and handle GitHub redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ghAuth = params.get('github_auth');
    if (ghAuth === 'success') {
      window.history.replaceState({}, document.title, window.location.pathname);
      checkAuth();
    } else if (ghAuth === 'error') {
      const msg = params.get('msg') || 'GitHub OAuth failed';
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
        loadInitialData();
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      // If error or unauthenticated, prompt auth
      setIsAuthenticated(false);
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
    } catch (err: any) {
      setAppError(err.message || 'Failed to load initial data');
    }
  };

  const handleDemoLogin = async () => {
    setIsLoggingIn(true);
    setAppError(null);
    try {
      const res = await loginDemo();
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
    } catch (err: any) {
      setAppError(err.message || 'Scan failed');
    } finally {
      setIsLoading(false);
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
    } catch (err: any) {
      setAppError(err.message || 'Failed to update finding status');
    }
  };

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
    <div className="flex h-screen w-screen overflow-hidden bg-navy-950 font-sans text-slate-100">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        openFindingsCount={openFindingsCount}
        githubAccount={githubAccount}
        user={user}
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
        />

        {/* Global Error Banner */}
        {appError && (
          <div className="bg-sentinel-rose/15 border-b border-sentinel-rose/30 px-6 py-2.5 text-xs text-sentinel-rose flex items-center justify-between">
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
        <main className="flex-1 overflow-y-auto">
          {currentTab === 'overview' && (
            <OverviewPage
              repositories={repositories}
              latestAnalysis={currentAnalysis}
              isLoading={isLoading}
              onScanPR={runScan}
              onSelectFinding={setSelectedFinding}
              onNavigateToTab={setCurrentTab}
              onConnectGitHub={() => setCurrentTab('settings')}
            />
          )}

          {currentTab === 'repos' && (
            <RepositoriesPage
              repositories={repositories}
              isLoading={isLoading}
              onRefresh={loadInitialData}
              onSelectRepo={handleSelectRepo}
              onConnectGitHub={() => setCurrentTab('settings')}
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

      {/* Finding Detail Modal with Triage */}
      <FindingDetailModal
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
        onUpdateStatus={handleUpdateFindingStatus}
      />
    </div>
  );
}

export default App;
