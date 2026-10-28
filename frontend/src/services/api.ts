import {
  UserProfile,
  GitHubAccount,
  RepositoryItem,
  PullRequestItem,
  PRAnalysisResult,
  AnalysisHistoryItem,
  AnalysisResult,
  DemoScenario,
} from '../types';

const API_BASE = '/api';

export async function fetchHealth(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

export async function fetchAuthStatus(): Promise<{
  authenticated: boolean;
  user: UserProfile | null;
  github_account: GitHubAccount | null;
  config_status: { google_configured: boolean; github_configured: boolean };
}> {
  const res = await fetch(`${API_BASE}/auth/me`);
  if (!res.ok) throw new Error(`Failed to check auth status (${res.status})`);
  return res.json();
}

export async function loginDemo(): Promise<{ status: string; user: UserProfile; token: string }> {
  const res = await fetch(`${API_BASE}/auth/demo-login`, { method: 'POST' });
  if (!res.ok) throw new Error(`Demo login failed (${res.status})`);
  return res.json();
}

export async function logout(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  if (!res.ok) throw new Error(`Logout failed (${res.status})`);
  return res.json();
}

export async function getGoogleAuthUrl(): Promise<{ url: string; is_configured: boolean }> {
  const res = await fetch(`${API_BASE}/auth/google/url`);
  if (!res.ok) throw new Error(`Failed to get Google auth URL`);
  return res.json();
}

export async function getGitHubAuthUrl(): Promise<{ url: string; is_configured: boolean; app_name: string }> {
  const res = await fetch(`${API_BASE}/auth/github/url`);
  if (!res.ok) throw new Error(`Failed to get GitHub auth URL`);
  return res.json();
}

export async function fetchAuthorizedRepositories(): Promise<RepositoryItem[]> {
  const res = await fetch(`${API_BASE}/repos`);
  if (!res.ok) {
    if (res.status === 401) throw new Error('AUTH_REQUIRED');
    throw new Error(`Failed to load repositories (${res.status})`);
  }
  return res.json();
}

export async function fetchRepoPullRequests(owner: string, repo: string): Promise<PullRequestItem[]> {
  const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/pulls`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch pull requests (${res.status})`);
  }
  return res.json();
}

export async function runPullRequestAnalysis(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRAnalysisResult> {
  const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/analyze`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `PR analysis failed (${res.status})`);
  }
  return res.json();
}

export async function fetchPRAnalysis(analysisId: string): Promise<PRAnalysisResult> {
  const res = await fetch(`${API_BASE}/analysis/pr/${analysisId}`);
  if (!res.ok) throw new Error(`Failed to retrieve PR analysis ${analysisId}`);
  return res.json();
}

export async function updateFindingReview(
  analysisId: string,
  findingId: string,
  status: 'reviewed' | 'dismissed' | 'open',
  notes?: string
): Promise<{ status: string; finding_id: string; new_status: string }> {
  const res = await fetch(`${API_BASE}/analysis/pr/${analysisId}/findings/${findingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  });
  if (!res.ok) throw new Error(`Failed to update finding status`);
  return res.json();
}

export async function fetchAnalysisHistory(): Promise<AnalysisHistoryItem[]> {
  const res = await fetch(`${API_BASE}/analysis/history`);
  if (!res.ok) throw new Error(`Failed to load analysis history`);
  return res.json();
}

// Backwards-compatible demo helpers
export async function fetchDemoScenarios(): Promise<DemoScenario[]> {
  const res = await fetch(`${API_BASE}/demo/scenarios`);
  if (!res.ok) throw new Error(`Failed to fetch scenarios`);
  return res.json();
}

export async function runDemoAnalysis(scenarioId: string): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/demo/analyze/${scenarioId}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Demo analysis failed`);
  return res.json();
}
