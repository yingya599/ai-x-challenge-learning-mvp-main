export type FeishuRecord<T> = T & {
  recordId?: string;
};

export type Student = {
  student_id: string;
  name: string;
  email?: string;
  feishu_open_id?: string;
  api_key?: string;
  api_key_hash?: string;
  feishu_app_id?: string;
  feishu_app_secret?: string;
  class_id?: string;
  github_username?: string;
  github_profile_url?: string;
  school?: string;
  major?: string;
  grade?: string;
  cohort?: string;
  ai_x_direction?: string;
  status?: string;
  portfolio_url?: string;
  department?: string;
  position?: string;
  mentor_id?: string;
  internship_start_date?: string;
  internship_end_date?: string;
};

export type JobDirection = "business_analysis" | "data_analysis" | "quant";

export type EvidenceType =
  | "document"
  | "spreadsheet"
  | "presentation"
  | "dashboard"
  | "github"
  | "demo"
  | "other";

export type EvidenceRequirement = {
  type: EvidenceType;
  label: string;
  required: boolean;
};

export type EvidenceItem = {
  type: EvidenceType;
  label: string;
  url: string;
  note?: string;
};

export type UploadedTaskFile = {
  file_token: string;
  name: string;
  size: number;
  type: string;
  evidence_type: EvidenceType;
};

export type TaskCategory = {
  category_id: string;
  title: string;
  job_direction: JobDirection;
  summary?: string;
  instructions_md?: string;
  acceptance_criteria?: string;
  evidence_requirements_json?: string;
  competency_ids_json?: string;
  source_type?: "business" | "historical_challenge" | "template";
  status?: string;
  github_repo?: string;
  created_at?: string;
  updated_at?: string;
};

export type PersonalTask = {
  recordId?: string;
  task_id: string;
  category_id: string;
  job_direction: JobDirection;
  student_id: string;
  mentor_id: string;
  title: string;
  business_context?: string;
  objective?: string;
  instructions_md?: string;
  acceptance_criteria?: string;
  evidence_requirements_json?: string;
  competency_ids_json?: string;
  start_date?: string;
  due_date?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  confidentiality?: "internal" | "confidential" | "restricted";
  status?: "draft" | "assigned" | "in_progress" | "submitted" | "returned" | "accepted" | "cancelled";
  risk_status?: "normal" | "due_soon" | "overdue" | "repeated_return" | "no_progress";
  return_count?: number;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
  raw_task_brief?: string;
  ai_clarification_questions_json?: string;
  ai_plan_json?: string;
  ai_generation_mode?: "model" | "demo";
  ai_updated_at?: string;
  task_config_json?: string;
};

export type AiGenerationMode = "model" | "demo";

export type TaskDraft = {
  title: string;
  business_context: string;
  objective: string;
  acceptance_criteria: string;
  priority: "low" | "medium" | "high" | "urgent";
  confidentiality: "internal" | "confidential" | "restricted";
  evidence_requirements: EvidenceRequirement[];
  clarification_questions: string[];
  assumptions: string[];
  suggested_category_title?: string;
  mode: AiGenerationMode;
};

export type TaskPlanStep = {
  title: string;
  purpose: string;
  actions: string[];
  deliverable: string;
  mentor_checkpoint?: string;
};

export type TaskPlan = {
  summary: string;
  steps: TaskPlanStep[];
  clarification_questions: string[];
  risks: string[];
  pre_submit_checklist: string[];
  mode: AiGenerationMode;
  generated_at: string;
};

export type Competency = {
  competency_id: string;
  name: string;
  job_direction: JobDirection | "common";
  description?: string;
  evidence_guidance?: string;
  sort_order?: number;
  status?: string;
};

export type CompetencyAssessmentLevel = "not_demonstrated" | "emerging" | "meets" | "outstanding";

export type CompetencyAssessment = {
  competency_id: string;
  level: CompetencyAssessmentLevel;
  note?: string;
};

export type AiAssessmentRole = "business_analyst" | "data_analyst" | "quant";

export type AiAssessmentConfidence = "low" | "medium" | "high";

export type AiInternAssessmentResult = {
  internId: string;
  role: AiAssessmentRole;
  overallScore: number;
  level: string;
  strengths: string[];
  weaknesses: string[];
  recommendedTasks: Array<{
    taskId: string;
    matchScore: number;
    reason: string;
    mentorAction: string;
  }>;
  confidence: AiAssessmentConfidence;
  evidenceConfidence: AiAssessmentConfidence;
  evidence: string[];
  source: "rule_based" | "ai";
  generatedAt: string;
};

export type RubricDimension = {
  id: string;
  label: string;
  weight: number;
  maxPoints: number;
  description: string;
  signals: string[];
  negativeSignals: string[];
};

export type RubricConfig = {
  dimensions: RubricDimension[];
  totalPoints: number;
};

export type RedFlag = {
  id: string;
  description: string;
  pattern: string;
  affectedDimension: string;
  maxScore: number;
};

export type Challenge = {
  challenge_id: string;
  title: string;
  brief?: string;
  objective?: string;
  deliverables?: string;
  rubric?: string;
  rubric_dimensions?: string;   // Phase 3: JSON of RubricConfig
  red_flags?: string;            // Phase 3: JSON of { flags: RedFlag[] }
  deadline?: string;
  status?: string;
  created_by?: string;
  teacher_id?: string;
  teacher_agent_id?: string;
  feishu_group_id?: string;
  airtable_record_id?: string;
  ontology_nodes?: string;
  learning_objectives?: string;
  required_deliverables?: string;
  rubric_pointer?: string;
  skills?: string;
  created_at?: string;
  updated_at?: string;
  github_repo?: string;
  job_direction?: JobDirection;
  instructions_md?: string;
  competency_ids_json?: string;
  evidence_requirements_json?: string;
  source_type?: "business" | "historical_challenge" | "template";
};

export type SubmissionInput = {
  studentId: string;
  challengeId: string;
  projectTitle: string;
  projectSummary: string;
  githubRepoUrl: string;
  taskId?: string;
  evidenceItems?: EvidenceItem[];
  resultSummary?: string;
  githubBranch?: string;
  readmeUrl?: string;
  demoUrl?: string;
  aarText: string;
  selfEvaluationText: string;
  isPublic: boolean;
  reviewMode?: string;
};

export type GitHubCheck = {
  repoUrl: string;
  owner?: string;
  repo?: string;
  repoExists: boolean;
  repoAccessible: boolean;
  readmeExists: boolean;
  latestCommitAt?: string;
  latestCommitSha?: string;
  defaultBranch?: string;
  readmeContent?: string;
  fileList?: string[];
  latestCommitMsg?: string;
  warnings: string[];
  score: number;
};

export type AiEvaluation = {
  scoreTotal: number;
  scores: Record<string, number>;
  strengths: string;
  weaknesses: string;
  suggestions: string;
  feedback: string;
  fallback?: boolean;
  fallbackReason?: string;
  redFlagsHit?: string[];
};

export type PortfolioDescription = {
  publicDescription: string;
  skills: string[];
  fallback?: boolean;
};

export type PortfolioItem = {
  portfolio_item_id?: string;
  student_id: string;
  student_name: string;
  submission_id?: string;
  title: string;
  type?: string;
  summary?: string;
  public_description?: string;
  github_url?: string;
  demo_url?: string;
  cover_image_url?: string;
  skills?: string;
  ai_feedback_summary?: string;
  is_public?: boolean;
  created_at?: string;
};

export type WorkflowResult = {
  ok: boolean;
  submissionId?: string;
  evaluationId?: string;
  portfolioItemId?: string;
  githubCheck?: GitHubCheck;
  aiEvaluation?: AiEvaluation;
  error?: string;
  auditTrail?: unknown[];
};

export type Teacher = {
  teacher_id: string;
  name: string;
  email?: string;
  role?: string;
  api_key_hash?: string;
  class_id?: string;
  status?: string;
  feishu_open_id?: string;
  teacher_agent_id?: string;
  department?: string;
};

export type Admin = {
  admin_id: string;
  name: string;
  email?: string;
  role?: string;
  api_key_hash?: string;
  status?: string;
  feishu_open_id?: string;
  last_login_at?: string;
};
