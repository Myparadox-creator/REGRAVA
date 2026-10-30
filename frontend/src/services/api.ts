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

async function fetchJson<T>(
  url: string,
  options?: RequestInit,
  defaultErrMsg = 'Request failed'
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (networkErr: any) {
    throw new Error(
      `Cannot connect to REGRAVA backend at ${url}. Please ensure the backend is running on port 8000. (${networkErr.message})`
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('AUTH_REQUIRED');
    if (res.status === 404) {
      throw new Error(`Endpoint not found (${url}). Please check backend API routing.`);
    }
    if (
      rawText.trim().startsWith('<!doctype') ||
      rawText.trim().startsWith('<html') ||
      contentType.includes('text/html')
    ) {
      throw new Error(
        'Backend server is unreachable on port 8000 (received HTML instead of API JSON). Start the backend with: uvicorn app.main:app --port 8000'
      );
    }
    throw new Error(`${defaultErrMsg} (HTTP ${res.status}: ${rawText.slice(0, 120)})`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch (jsonErr: any) {
    throw new Error(`Invalid JSON response from server: ${jsonErr.message}`);
  }

  if (!res.ok) {
    const detailMsg = data?.detail || data?.message || `${defaultErrMsg} (${res.status})`;
    throw new Error(detailMsg);
  }

  return data as T;
}

export async function fetchHealth(): Promise<{ status: string; version: string }> {
  return fetchJson<{ status: string; version: string }>(
    `${API_BASE}/health`,
    undefined,
    'Health check failed'
  );
}

export async function fetchAuthStatus(): Promise<{
  authenticated: boolean;
  user: UserProfile | null;
  github_account: GitHubAccount | null;
  config_status: { google_configured: boolean; github_configured: boolean };
}> {
  return fetchJson<{
    authenticated: boolean;
    user: UserProfile | null;
    github_account: GitHubAccount | null;
    config_status: { google_configured: boolean; github_configured: boolean };
  }>(`${API_BASE}/auth/me`, undefined, 'Failed to check auth status');
}

export async function loginDemo(): Promise<{ status: string; user: UserProfile; token: string }> {
  return fetchJson<{ status: string; user: UserProfile; token: string }>(
    `${API_BASE}/auth/demo-login`,
    { method: 'POST' },
    'Demo login failed'
  );
}

export async function logout(): Promise<{ status: string }> {
  return fetchJson<{ status: string }>(
    `${API_BASE}/auth/logout`,
    { method: 'POST' },
    'Logout failed'
  );
}

export async function getGoogleAuthUrl(): Promise<{ url: string; is_configured: boolean }> {
  return fetchJson<{ url: string; is_configured: boolean }>(
    `${API_BASE}/auth/google/url`,
    undefined,
    'Failed to get Google auth URL'
  );
}

export async function getGitHubAuthUrl(): Promise<{ url: string; is_configured: boolean; app_name: string }> {
  return fetchJson<{ url: string; is_configured: boolean; app_name: string }>(
    `${API_BASE}/auth/github/url`,
    undefined,
    'Failed to get GitHub auth URL'
  );
}

export async function connectGitHubToken(token: string): Promise<{
  status: string;
  github_username: string;
  authorized_repos: string[];
  user?: UserProfile;
}> {
  return fetchJson<{
    status: string;
    github_username: string;
    authorized_repos: string[];
    user?: UserProfile;
  }>(
    `${API_BASE}/auth/github/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    },
    'Failed to connect GitHub token'
  );
}

export async function disconnectGitHub(): Promise<{ status: string }> {
  return fetchJson<{ status: string }>(
    `${API_BASE}/auth/github/disconnect`,
    { method: 'POST' },
    'Failed to disconnect GitHub'
  );
}

export async function fetchAuthorizedRepositories(): Promise<RepositoryItem[]> {
  return fetchJson<RepositoryItem[]>(
    `${API_BASE}/repos`,
    undefined,
    'Failed to load repositories'
  );
}

export async function fetchRepoPullRequests(owner: string, repo: string): Promise<PullRequestItem[]> {
  return fetchJson<PullRequestItem[]>(
    `${API_BASE}/repos/${owner}/${repo}/pulls`,
    undefined,
    `Failed to fetch pull requests for ${owner}/${repo}`
  );
}

export async function runPullRequestAnalysis(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRAnalysisResult> {
  return fetchJson<PRAnalysisResult>(
    `${API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/analyze`,
    { method: 'POST' },
    `PR analysis failed for PR #${prNumber}`
  );
}

export async function fetchPRAnalysis(analysisId: string): Promise<PRAnalysisResult> {
  return fetchJson<PRAnalysisResult>(
    `${API_BASE}/analysis/pr/${analysisId}`,
    undefined,
    `Failed to retrieve PR analysis ${analysisId}`
  );
}

export async function updateFindingReview(
  analysisId: string,
  findingId: string,
  status: 'reviewed' | 'dismissed' | 'open',
  notes?: string
): Promise<{ status: string; finding_id: string; new_status: string }> {
  return fetchJson<{ status: string; finding_id: string; new_status: string }>(
    `${API_BASE}/analysis/pr/${analysisId}/findings/${findingId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    },
    'Failed to update finding status'
  );
}

export async function fetchAnalysisHistory(): Promise<AnalysisHistoryItem[]> {
  return fetchJson<AnalysisHistoryItem[]>(
    `${API_BASE}/analysis/history`,
    undefined,
    'Failed to load analysis history'
  );
}

// Backwards-compatible demo helpers
export async function fetchDemoScenarios(): Promise<DemoScenario[]> {
  return fetchJson<DemoScenario[]>(
    `${API_BASE}/demo/scenarios`,
    undefined,
    'Failed to fetch scenarios'
  );
}

export async function runDemoAnalysis(scenarioId: string): Promise<AnalysisResult> {
  return fetchJson<AnalysisResult>(
    `${API_BASE}/demo/analyze/${scenarioId}`,
    { method: 'POST' },
    'Demo analysis failed'
  );
}
