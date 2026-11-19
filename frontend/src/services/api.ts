import {
  UserProfile,
  GitHubAccount,
  RepositoryItem,
  PullRequestItem,
  PRAnalysisResult,
  AnalysisHistoryItem,
  AnalysisResult,
  DemoScenario,
  FleetSecurityPosture,
  RepositorySecurityHealth,
  TargetAITool,
  SteeredPromptResponse,
  AIAuditReport,
  GitHubAppStatus,
  ReviewJobRecord,
  PRReviewsBundle,
  GitHubReviewRecord,
  RepoReviewSettings,
  FindingLifecycleRecord,
  LifecycleStatus,
  AssistantConversation,
  AssistantProviderStatus,
  IssueItem,
  IssueSentinelStats,
  IssueSentinelSettings,
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(
  url: string,
  options?: RequestInit,
  defaultErrMsg = 'Request failed'
): Promise<T> {
  const token = localStorage.getItem('regrava_token');
  const headers = new Headers(options?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  let res: Response;
  try {
    res = await fetch(url, mergedOptions);
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
  const data = await fetchJson<{ status: string; user: UserProfile; token: string }>(
    `${API_BASE}/auth/demo-login`,
    { method: 'POST' },
    'Demo login failed'
  );
  if (data?.token) {
    localStorage.setItem('regrava_token', data.token);
  }
  return data;
}

export async function logout(): Promise<{ status: string }> {
  localStorage.removeItem('regrava_token');
  return fetchJson<{ status: string }>(
    `${API_BASE}/auth/logout`,
    { method: 'POST' },
    'Logout failed'
  );
}

export async function getGoogleAuthUrl(): Promise<{
  url: string;
  is_configured: boolean;
  callback_url?: string;
}> {
  return fetchJson<{ url: string; is_configured: boolean; callback_url?: string }>(
    `${API_BASE}/auth/google/url`,
    undefined,
    'Failed to get Google auth URL'
  );
}

export async function fetchGoogleConfigInfo(): Promise<{
  is_configured: boolean;
  client_id: string | null;
  callback_url: string;
  origin_urls: string[];
  setup_url: string;
}> {
  return fetchJson<{
    is_configured: boolean;
    client_id: string | null;
    callback_url: string;
    origin_urls: string[];
    setup_url: string;
  }>(`${API_BASE}/auth/google/config-info`, undefined, 'Failed to get Google config info');
}

export async function configureGoogleOAuth(
  clientId: string,
  clientSecret: string
): Promise<{ status: string; is_configured: boolean; auth_url: string }> {
  return fetchJson<{ status: string; is_configured: boolean; auth_url: string }>(
    `${API_BASE}/auth/google/configure`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    },
    'Failed to configure Google OAuth'
  );
}

export async function getGitHubAuthUrl(): Promise<{
  url: string;
  is_configured: boolean;
  app_name: string;
  callback_url?: string;
}> {
  return fetchJson<{
    url: string;
    is_configured: boolean;
    app_name: string;
    callback_url?: string;
  }>(`${API_BASE}/auth/github/url`, undefined, 'Failed to get GitHub auth URL');
}

export async function fetchGitHubConfigInfo(): Promise<{
  is_configured: boolean;
  client_id: string | null;
  callback_url: string;
  homepage_url: string;
  setup_url: string;
}> {
  return fetchJson<{
    is_configured: boolean;
    client_id: string | null;
    callback_url: string;
    homepage_url: string;
    setup_url: string;
  }>(`${API_BASE}/auth/github/config-info`, undefined, 'Failed to get GitHub config info');
}

export async function configureGitHubOAuth(
  clientId: string,
  clientSecret: string
): Promise<{ status: string; is_configured: boolean; auth_url: string }> {
  return fetchJson<{ status: string; is_configured: boolean; auth_url: string }>(
    `${API_BASE}/auth/github/configure`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    },
    'Failed to configure GitHub OAuth'
  );
}

export async function connectGitHubToken(token: string): Promise<{
  status: string;
  token?: string;
  github_username: string;
  authorized_repos: string[];
  user?: UserProfile;
}> {
  const data = await fetchJson<{
    status: string;
    token?: string;
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
  if (data?.token) {
    localStorage.setItem('regrava_token', data.token);
  }
  return data;
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
    `${API_BASE}/demo/analyze`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId }),
    },
    'Demo analysis failed'
  );
}

export async function fetchSecurityPosture(): Promise<FleetSecurityPosture> {
  return fetchJson<FleetSecurityPosture>(
    `${API_BASE}/security/posture`,
    undefined,
    'Failed to load security posture'
  );
}

export async function fetchRepositorySecurityHealth(
  owner: string,
  repo: string
): Promise<RepositorySecurityHealth> {
  return fetchJson<RepositorySecurityHealth>(
    `${API_BASE}/security/repository/${owner}/${repo}`,
    undefined,
    `Failed to load security health for ${owner}/${repo}`
  );
}

export async function triggerRepositoryAudit(owner: string, repo: string): Promise<{
  status: string;
  repo_full_name: string;
  pr_number: number;
  health_score: number;
  health_grade: string;
  repo_health: RepositorySecurityHealth;
}> {
  return fetchJson<{
    status: string;
    repo_full_name: string;
    pr_number: number;
    health_score: number;
    health_grade: string;
    repo_health: RepositorySecurityHealth;
  }>(
    `${API_BASE}/security/audit/${owner}/${repo}`,
    { method: 'POST' },
    `Failed to audit repository ${owner}/${repo}`
  );
}

export async function fetchSteeredPrompt(
  analysisId: string,
  findingId: string,
  targetTool: TargetAITool = 'cursor',
  includeTest = true,
  includeConstraints = true
): Promise<SteeredPromptResponse> {
  return fetchJson<SteeredPromptResponse>(
    `${API_BASE}/analysis/${encodeURIComponent(analysisId)}/findings/${encodeURIComponent(
      findingId
    )}/steer-prompt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_tool: targetTool,
        include_test_assertion: includeTest,
        include_negative_constraints: includeConstraints,
      }),
    },
    'Failed to generate AI steered prompt'
  );
}

export async function auditAIReviews(payload: {
  pr_number?: number;
  raw_comment_text?: string;
  comments?: Array<Record<string, any>>;
  diff_context?: string;
}): Promise<AIAuditReport> {
  return fetchJson<AIAuditReport>(
    `${API_BASE}/ai/audit-review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Failed to audit AI bot reviews'
  );
}

// =============================================================================
// NATIVE GITHUB PR REVIEWER API
// =============================================================================

export async function fetchGitHubAppStatus(): Promise<GitHubAppStatus> {
  return fetchJson<GitHubAppStatus>(
    `${API_BASE}/github/app/status`,
    undefined,
    'Failed to fetch GitHub App status'
  );
}

export async function startPullRequestReview(
  owner: string,
  repo: string,
  prNumber: number,
  options?: { force_re_review?: boolean; dry_run?: boolean; wait_for_completion?: boolean }
): Promise<ReviewJobRecord> {
  return fetchJson<ReviewJobRecord>(
    `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        force_re_review: options?.force_re_review ?? false,
        dry_run: options?.dry_run ?? false,
        wait_for_completion: options?.wait_for_completion ?? false,
      }),
    },
    `Failed to start REGRAVA review for ${owner}/${repo}#${prNumber}`
  );
}

export async function fetchReviewJobProgress(jobId: string): Promise<ReviewJobRecord> {
  return fetchJson<ReviewJobRecord>(
    `${API_BASE}/reviews/jobs/${encodeURIComponent(jobId)}`,
    undefined,
    'Failed to poll review job status'
  );
}

export async function fetchPRReviews(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRReviewsBundle> {
  return fetchJson<PRReviewsBundle>(
    `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/reviews`,
    undefined,
    `Failed to load PR review history for #${prNumber}`
  );
}

export async function fetchUserReviews(repoFullName?: string): Promise<GitHubReviewRecord[]> {
  const query = repoFullName ? `?repo=${encodeURIComponent(repoFullName)}` : '';
  return fetchJson<GitHubReviewRecord[]>(
    `${API_BASE}/reviews${query}`,
    undefined,
    'Failed to load GitHub reviews'
  );
}

export async function retryReviewPublication(reviewRecordId: string): Promise<GitHubReviewRecord> {
  return fetchJson<GitHubReviewRecord>(
    `${API_BASE}/reviews/${encodeURIComponent(reviewRecordId)}/retry`,
    { method: 'POST' },
    'Failed to retry GitHub review publication'
  );
}

export async function fetchRepoReviewSettings(owner: string, repo: string): Promise<RepoReviewSettings> {
  return fetchJson<RepoReviewSettings>(
    `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/review-settings`,
    undefined,
    'Failed to fetch repository review settings'
  );
}

export async function updateRepoReviewSettings(
  owner: string,
  repo: string,
  autoReviewEnabled: boolean,
  confidenceThreshold = 'medium'
): Promise<RepoReviewSettings> {
  return fetchJson<RepoReviewSettings>(
    `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/review-settings`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auto_review_enabled: autoReviewEnabled,
        confidence_threshold: confidenceThreshold,
      }),
    },
    'Failed to update automatic PR review settings'
  );
}

export async function updateFindingLifecycleStatus(
  recordId: string,
  status: LifecycleStatus,
  notes?: string,
  verificationEvidence?: string
): Promise<FindingLifecycleRecord> {
  return fetchJson<FindingLifecycleRecord>(
    `${API_BASE}/findings/lifecycle/${encodeURIComponent(recordId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        notes,
        verification_evidence: verificationEvidence,
      }),
    },
    'Failed to update finding lifecycle status'
  );
}

// =============================================================================
// REGRAVA AI ASSISTANT API
// =============================================================================

export async function fetchAssistantProviderStatus(): Promise<AssistantProviderStatus> {
  return fetchJson<AssistantProviderStatus>(
    `${API_BASE}/assistant/providers/status`,
    undefined,
    'Failed to fetch AI Assistant provider status'
  );
}

export async function configureAssistantProvider(
  provider: string,
  apiKey?: string,
  model?: string
): Promise<AssistantProviderStatus> {
  return fetchJson<AssistantProviderStatus>(
    `${API_BASE}/assistant/providers/config`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: apiKey, model }),
    },
    'Failed to configure AI Assistant provider'
  );
}

export async function fetchAssistantConversations(query?: string): Promise<AssistantConversation[]> {
  const q = query ? `?q=${encodeURIComponent(query)}` : '';
  return fetchJson<AssistantConversation[]>(
    `${API_BASE}/assistant/conversations${q}`,
    undefined,
    'Failed to load assistant conversations'
  );
}

export async function createAssistantConversation(payload: {
  title?: string;
  selected_repo?: string;
  selected_pr_number?: number;
  selected_finding_id?: string;
}): Promise<AssistantConversation> {
  return fetchJson<AssistantConversation>(
    `${API_BASE}/assistant/conversations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Failed to create new conversation'
  );
}

export async function fetchAssistantConversation(conversationId: string): Promise<AssistantConversation> {
  return fetchJson<AssistantConversation>(
    `${API_BASE}/assistant/conversations/${encodeURIComponent(conversationId)}`,
    undefined,
    'Failed to load conversation details'
  );
}

export async function updateAssistantConversation(
  conversationId: string,
  payload: {
    title?: string;
    selected_repo?: string;
    selected_pr_number?: number;
    selected_finding_id?: string;
  }
): Promise<AssistantConversation> {
  return fetchJson<AssistantConversation>(
    `${API_BASE}/assistant/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Failed to update conversation'
  );
}

export async function deleteAssistantConversation(conversationId: string): Promise<{ deleted: boolean }> {
  return fetchJson<{ deleted: boolean }>(
    `${API_BASE}/assistant/conversations/${encodeURIComponent(conversationId)}`,
    { method: 'DELETE' },
    'Failed to delete conversation'
  );
}

export async function streamAssistantChat(
  payload: {
    conversation_id: string;
    message: string;
    selected_repo?: string;
    selected_pr_number?: number;
    selected_finding_id?: string;
  },
  onChunk: (delta: string) => void,
  onDone: (data: { message_id?: string; sources?: any[]; complete_text?: string }) => void,
  onError: (errorText: string) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/assistant/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      onError(`Request failed (${response.status}): ${errText}`);
      return;
    }

    if (!response.body) {
      onError('Readable stream not supported in this browser.');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const ev of events) {
        if (!ev.trim()) continue;
        const lines = ev.split('\n');
        let eventType = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
        }

        if (dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            if (eventType === 'chunk') {
              if (parsed.delta) onChunk(parsed.delta);
            } else if (eventType === 'done') {
              onDone(parsed);
            } else if (eventType === 'error') {
              onError(parsed.error || 'Unknown streaming error');
            }
          } catch {
            // Ignore non-json lines
          }
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // User aborted stream
      return;
    }
    onError(err.message || 'Error communicating with assistant');
  }
}

export async function streamAssistantRegenerate(
  conversationId: string,
  payload: {
    selected_repo?: string;
    selected_pr_number?: number;
    selected_finding_id?: string;
  },
  onChunk: (delta: string) => void,
  onDone: (data: { message_id?: string; sources?: any[]; complete_text?: string }) => void,
  onError: (errorText: string) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/assistant/conversations/${encodeURIComponent(conversationId)}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      onError(`Regeneration failed (${response.status}): ${errText}`);
      return;
    }

    if (!response.body) {
      onError('Readable stream not supported in this browser.');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const ev of events) {
        if (!ev.trim()) continue;
        const lines = ev.split('\n');
        let eventType = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
        }

        if (dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            if (eventType === 'chunk') {
              if (parsed.delta) onChunk(parsed.delta);
            } else if (eventType === 'done') {
              onDone(parsed);
            } else if (eventType === 'error') {
              onError(parsed.error || 'Unknown streaming error');
            }
          } catch {
            // Ignore non-json lines
          }
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return;
    }
    onError(err.message || 'Error communicating with assistant');
  }
}

export async function fetchAssistantContextRepositories(): Promise<Array<{ full_name: string; name: string; owner: string; description: string; open_prs_count: number }>> {
  return fetchJson(
    `${API_BASE}/assistant/context/repositories`,
    undefined,
    'Failed to load repositories for assistant context'
  );
}

export async function fetchAssistantContextPullRequests(repoFullName: string): Promise<Array<{ number: number; title: string; author: string; state: string }>> {
  return fetchJson(
    `${API_BASE}/assistant/context/pull-requests?repo=${encodeURIComponent(repoFullName)}`,
    undefined,
    'Failed to load pull requests for assistant context'
  );
}

export async function fetchAssistantContextFindings(repoFullName: string, prNumber?: number): Promise<Array<{ id: string; title: string; severity: string; category: string; file_path?: string; line_number?: number; lifecycle_status?: string }>> {
  const prQuery = prNumber ? `&pr=${prNumber}` : '';
  return fetchJson(
    `${API_BASE}/assistant/context/findings?repo=${encodeURIComponent(repoFullName)}${prQuery}`,
    undefined,
    'Failed to load findings for assistant context'
  );
}

// --- Issue Sentinel API ---
export async function fetchRepoIssues(
  owner: string,
  repo: string,
  state: string = 'open'
): Promise<IssueItem[]> {
  return fetchJson<IssueItem[]>(
    `${API_BASE}/repos/${owner}/${repo}/issues?state=${state}`,
    undefined,
    `Failed to fetch issues for ${owner}/${repo}`
  );
}

export async function fetchRepoIssue(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<IssueItem> {
  return fetchJson<IssueItem>(
    `${API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}`,
    undefined,
    `Failed to fetch issue #${issueNumber}`
  );
}

export async function triageRepoIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  autoClose: boolean = true,
  dryRun: boolean = false
): Promise<any> {
  return fetchJson<any>(
    `${API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/triage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_close: autoClose, dry_run: dryRun }),
    },
    `Failed to triage issue #${issueNumber}`
  );
}

export async function reopenRepoIssue(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<{ status: string; repo_full_name: string; issue_number: number }> {
  return fetchJson<{ status: string; repo_full_name: string; issue_number: number }>(
    `${API_BASE}/repos/${owner}/${repo}/issues/${issueNumber}/reopen`,
    { method: 'POST' },
    `Failed to reopen issue #${issueNumber}`
  );
}

export async function fetchIssueStats(repo?: string): Promise<IssueSentinelStats> {
  const query = repo ? `?repo=${encodeURIComponent(repo)}` : '';
  return fetchJson<IssueSentinelStats>(
    `${API_BASE}/issues/stats${query}`,
    undefined,
    'Failed to fetch issue stats'
  );
}

export async function fetchRepoSentinelSettings(
  owner: string,
  repo: string
): Promise<IssueSentinelSettings> {
  return fetchJson<IssueSentinelSettings>(
    `${API_BASE}/repos/${owner}/${repo}/issues/settings`,
    undefined,
    `Failed to fetch issue sentinel settings for ${owner}/${repo}`
  );
}

export async function updateRepoSentinelSettings(
  owner: string,
  repo: string,
  data: { enabled: boolean; auto_close: boolean; mode: string }
): Promise<IssueSentinelSettings> {
  return fetchJson<IssueSentinelSettings>(
    `${API_BASE}/repos/${owner}/${repo}/issues/settings`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    `Failed to update issue sentinel settings for ${owner}/${repo}`
  );
}


