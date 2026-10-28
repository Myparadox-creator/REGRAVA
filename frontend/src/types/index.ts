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
