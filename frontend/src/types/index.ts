export type Severity = 'high' | 'medium' | 'low' | 'info';
export type Confidence = 'high' | 'medium' | 'low';
export type TestEvidenceStatus = 'found' | 'not_found_by_analyzer' | 'unknown';
export type ReviewStatus = 'open' | 'reviewed' | 'dismissed';

export interface ChangedFileRef {
  path: string;
  line: number;
  symbol?: string;
  old_value?: string;
  new_value?: string;
}

export interface AffectedFileRef {
  path: string;
  line: number;
  symbol: string;
  context_snippet?: string;
}

export interface TestEvidenceItem {
  file_path: string;
  test_name: string;
  line: number;
  matched_target: string;
  description: string;
}

export interface Finding {
  id: string;
  category: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  summary: string;
  changed_file?: ChangedFileRef;
  affected_file?: AffectedFileRef;
  evidence: string[];
  conditions?: string[];
  attack_scenario?: string;
  recommendation: string;
  limitations?: string[];
  test_evidence: TestEvidenceStatus;
  test_evidence_items?: TestEvidenceItem[];
  review_status?: ReviewStatus;
  review_notes?: string;
  route_path?: string;
  field_name?: string;
  model_name?: string;
  change_type?: string;
}

export interface AnalysisMetrics {
  total_findings: number;
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  info_severity_count: number;
  security_findings_count?: number;
  regression_findings_count?: number;
  affected_consumers_count?: number;
  affected_consumers_identified?: number;
  breaking_contract_changes?: number;
  test_evidence_gaps: number;
  files_analyzed: number;
}

export interface PRAnalysisResult {
  id: string;
  repo_name: string;
  pr_number: number;
  pr_title: string;
  author: string;
  author_avatar?: string;
  base_ref: string;
  head_ref: string;
  status: string;
  metrics: AnalysisMetrics;
  findings: Finding[];
  summary: {
    pr_number: number;
    pr_title: string;
    author: string;
    base_ref: string;
    head_ref: string;
    contract_diff?: {
      fields_removed: string[];
      fields_added: string[];
      fields_type_changed: string[];
      routes_removed: string[];
    };
    warnings?: string[];
  };
  changed_files: string[];
  execution_time_ms: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  auth_provider: string;
  is_demo: boolean;
}

export interface GitHubAccount {
  user_id: string;
  github_username: string;
  installation_id?: string;
  authorized_repos: string[];
}

export interface RepositoryItem {
  id: string;
  name: string;
  full_name: string;
  owner: string;
  description: string;
  is_private: boolean;
  default_branch: string;
  open_pull_requests_count: number;
  updated_at: string;
}

export interface PullRequestItem {
  number: number;
  title: string;
  author: string;
  author_avatar?: string;
  state: string;
  base_ref: string;
  head_ref: string;
  created_at: string;
  changed_files_count: number;
  additions: number;
  deletions: number;
}

export interface AnalysisHistoryItem {
  id: string;
  repo_name: string;
  pr_number: number;
  pr_title: string;
  base_ref: string;
  head_ref: string;
  head_sha?: string;
  publication_status?: string;
  github_review_url?: string;
  github_review_id?: string;
  status: string;
  metrics: AnalysisMetrics;
  execution_time_ms: number;
  created_at: string;
}

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  breaking: boolean;
  expected_findings: number;
}

export interface AnalysisResult {
  id: string;
  repo_path?: string;
  status: string;
  metrics: AnalysisMetrics;
  findings: Finding[];
  summary: any;
  changed_files: string[];
  execution_time_ms: number;
  analyzed_at?: string;
}

export type HealthGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export type CheckStatus = 'passed' | 'warning' | 'failed' | 'pending';

export interface SecurityCheckItem {
  id: string;
  layer: number;
  name: string;
  status: CheckStatus;
  alerts_count: number;
  description: string;
  recommendation?: string;
}

export interface RepositorySecurityHealth {
  repo_id: string;
  repo_name: string;
  repo_full_name: string;
  owner: string;
  is_private: boolean;
  default_branch: string;
  health_score: number;
  health_grade: HealthGrade;
  status: 'hardened' | 'compliant' | 'moderate_risk' | 'at_risk' | 'critical';
  checks: SecurityCheckItem[];
  checks_passed_count: number;
  total_checks_count: number;
  open_findings_count: number;
  open_findings?: Finding[];
  high_severity_count: number;
  medium_severity_count: number;
  low_severity_count: number;
  breaking_contracts_count: number;
  test_evidence_gaps_count: number;
  total_prs_analyzed: number;
  clean_prs_count: number;
  flagged_prs_count: number;
  last_scan_at: string | null;
  last_pr_number?: number;
  last_pr_title?: string;
  top_risk_summary: string;
  category_alert_counts?: Record<string, number>;
}

export interface FleetSecurityPosture {
  average_health_score: number;
  fleet_grade: HealthGrade;
  total_repositories: number;
  hardened_repositories: number;
  at_risk_repositories: number;
  total_security_alerts: number;
  total_critical_high: number;
  total_breaking_contracts: number;
  total_test_gaps: number;
  total_checks_passed: number;
  total_checks_evaluated: number;
  category_distribution: Record<string, number>;
  compliance_readiness: {
    soc2_ready: boolean;
    owasp_top10_status: string;
    unresolved_blockers: number;
  };
  repositories: RepositorySecurityHealth[];
}

export type TargetAITool = 'cursor' | 'claude_code' | 'copilot' | 'windsurf' | 'generic';

export interface SteeredPromptResponse {
  finding_id: string;
  target_tool: TargetAITool;
  prompt_text: string;
  target_files: string[];
  constraints: string[];
  suggested_command?: string;
  synthesized_test_snippet?: string;
  suggested_patch_diff?: string;
}

export type AIAuditVerdict =
  | 'verified_sound'
  | 'hallucinated_api'
  | 'contract_regression'
  | 'security_risk'
  | 'cosmetic_noise';

export interface AIAuditItem {
  id: string;
  source_bot: string;
  comment_body: string;
  target_file: string;
  target_line?: number;
  verdict: AIAuditVerdict;
  explanation: string;
  ast_evidence: string[];
  suggested_action: string;
}

export interface AIAuditReport {
  pr_number?: number;
  total_audited: number;
  sound_count: number;
  hallucination_count: number;
  regression_count: number;
  security_risk_count: number;
  noise_count: number;
  items: AIAuditItem[];
}

export type ReviewJobState =
  | 'ready'
  | 'in_progress'
  | 'collecting_pr_changes'
  | 'running_security_checks'
  | 'generating_review'
  | 'publishing_review'
  | 'published'
  | 'dry_run'
  | 'failed'
  | 'already_reviewed';

export interface ReviewStepItem {
  label: string;
  status: 'done' | 'error' | 'running';
  timestamp: string;
}

export interface GitHubReviewInlineComment {
  path: string;
  line: number;
  side: 'RIGHT' | 'LEFT';
  body: string;
  finding_id?: string;
  fingerprint?: string;
  github_comment_id?: string;
  html_url?: string;
}

export interface GitHubReviewRecord {
  id: string;
  repo_full_name: string;
  repo_id?: string;
  pr_number: number;
  head_sha: string;
  analyzer_version: string;
  analysis_id?: string;
  github_review_id?: string;
  github_review_url?: string;
  summary_body: string;
  inline_comments: GitHubReviewInlineComment[];
  published_fingerprints: string[];
  publication_status: 'published' | 'dry_run' | 'failed' | 'stale_discarded' | 'already_reviewed';
  error_detail?: string;
  mode: 'manual' | 'automatic';
  triggered_by?: string;
  created_at: string;
  updated_at: string;
  dry_run_payload?: {
    endpoint: string;
    commit_id: string;
    event: string;
    body: string;
    comments: Array<{ path: string; line: number; side: string; body: string }>;
  };
}

export interface ReviewJobRecord {
  job_id: string;
  user_id: string;
  repo_full_name: string;
  pr_number: number;
  head_sha?: string;
  state: ReviewJobState;
  steps: ReviewStepItem[];
  analysis_id?: string;
  review_record_id?: string;
  error_message?: string;
  dry_run: boolean;
  created_at: string;
  updated_at: string;
  review?: GitHubReviewRecord;
}

export type LifecycleStatus =
  | 'Open'
  | 'Fix Attempted'
  | 'Verified Fixed'
  | 'Still Present'
  | 'Dismissed with Reason'
  | 'Accepted with Reason'
  | 'Verification Inconclusive';

export interface FindingLifecycleRecord {
  id: string;
  finding_id: string;
  fingerprint: string;
  repo_full_name: string;
  pr_number: number;
  original_head_sha: string;
  current_head_sha: string;
  category: string;
  severity: string;
  confidence: string;
  title: string;
  file_path?: string;
  line_number?: number;
  evidence: string[];
  published_review_id?: string;
  published_comment_id?: string;
  published_to_github: boolean;
  previous_status?: string;
  current_status: LifecycleStatus;
  resolution_notes?: string;
  verification_evidence?: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface RepoReviewSettings {
  repo_full_name: string;
  auto_review_enabled: boolean;
  confidence_threshold: string;
  updated_by?: string;
  updated_at?: string;
}

export interface PRReviewsBundle {
  repo_full_name: string;
  pr_number: number;
  reviews: GitHubReviewRecord[];
  latest_job: ReviewJobRecord | null;
  finding_lifecycle: FindingLifecycleRecord[];
  settings: RepoReviewSettings;
}

export interface GitHubAppStatus {
  is_app_configured: boolean;
  app_name: string;
  webhook_configured: boolean;
  analyzer_version: string;
  confidence_threshold_default: string;
  required_permissions: Record<string, string>;
  subscribed_events: string[];
}
