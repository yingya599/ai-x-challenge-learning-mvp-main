// Client-side adapter: fetch real data from the MVP backend APIs and map to
// the UI types; fall back to the local mock data when the backend (Feishu
// env vars etc.) is not configured, so the UI always renders.
import {
  challenges as mockChallenges,
  portfolioItems as mockPortfolio,
  type Challenge,
  type PortfolioItem,
} from "./data";

type BackendChallenge = {
  challenge_id: string;
  title: string;
  brief?: string;
  objective?: string;
  deadline?: string;
  status?: string;
  deliverables?: string;
  rubric?: string;
  skills?: string;
  github_repo?: string;
  learning_objectives?: string;
  required_deliverables?: string;
};

type BackendPortfolioItem = {
  portfolio_item_id?: string;
  student_id: string;
  student_name: string;
  submission_id?: string;
  title: string;
  summary?: string;
  skills?: string;
  github_url?: string;
  demo_url?: string;
  is_public?: boolean;
  created_at?: string;
};

export async function fetchChallenges(): Promise<{ items: Challenge[]; live: boolean }> {
  try {
    const res = await fetch("/api/challenges");
    const data = await res.json();
    // BUGFIX: empty list is valid (no published challenges yet), don't fall back to mock
    if (!data.ok || !Array.isArray(data.challenges)) throw new Error();
    // Sort by challenge number: extract code (C1, C2, C2A, C10H, etc.)
    const order = ["C1","C2","C2A","C2G","C3","C3C","C4","C4A","C4B","C4C","C4D","C5","C5A","C6","C6A","C7","C8","C9","C10","C10H"];
    const sorted = [...(data.challenges as BackendChallenge[])].sort((a, b) => {
      const extractCode = (title: string) => title.match(/^C\d+[A-Z]?/)?.[0] || "";
      const idxA = order.indexOf(extractCode(a.title));
      const idxB = order.indexOf(extractCode(b.title));
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
    const items: Challenge[] = sorted.map((c, i) => ({
      id: c.challenge_id,
      number: `Challenge ${String(i + 1).padStart(2, "0")}`,
      title: c.title,
      description: c.brief || c.objective || "",
      difficulty: "进阶",
      status: c.status === "closed" ? "已完成" : "进行中",
      team: "",
      deliverables: c.deliverables,
      rubric: c.rubric,
      deadline: c.deadline,
      skills: c.skills,
      github_repo: c.github_repo,
      objective: c.objective,
      brief: c.brief,
      learning_objectives: c.learning_objectives,
      required_deliverables: c.required_deliverables,
    }));
    return { items, live: true };
  } catch {
    return { items: mockChallenges, live: false };
  }
}

export async function fetchPortfolio(): Promise<{ items: PortfolioItem[]; live: boolean }> {
  try {
    const res = await fetch("/api/portfolio");
    const data = await res.json();
    const list = data.portfolioItems ?? data.items;
    if (!data.ok || !Array.isArray(list)) throw new Error();
    const items: PortfolioItem[] = (list as BackendPortfolioItem[]).map((p) => ({
      id: p.portfolio_item_id || p.submission_id || p.title,
      studentName: p.student_name,
      studentId: p.student_id,
      challengeTitle: p.title,
      challengeId: p.submission_id || "",
      summary: p.summary || "",
      techStack: (p.skills || "").split(",").map((s) => s.trim()).filter(Boolean),
      demoUrl: p.demo_url || undefined,
      githubRepo: (p.github_url || "").replace(/^https?:\/\/github\.com\//, ""),
      aiScore: 0,
      isPublic: p.is_public ?? true,
      submittedAt: p.created_at || "",
    }));
    return { items, live: true };
  } catch {
    return { items: mockPortfolio, live: false };
  }
}

export type GithubCheckResult = {
  repoExists: boolean;
  readmeExists: boolean;
  latestCommitAt?: string;
  warnings: string[];
  score: number;
};

export async function checkGithubRepo(repoUrl: string): Promise<GithubCheckResult | null> {
  try {
    const res = await fetch("/api/github/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl }),
    });
    const data = await res.json();
    return data.ok ? data.githubCheck : null;
  } catch {
    return null;
  }
}

export type SubmitPayload = {
  studentId: string;
  challengeId: string;
  projectTitle: string;
  projectSummary: string;
  githubRepoUrl: string;
  githubBranch?: string;
  demoUrl?: string;
  aarText: string;
  selfEvaluationText: string;
  isPublic: boolean;
};

export async function submitProject(payload: SubmitPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "提交失败" };
  }
}

// ---- Auth (T9) ----

export type LoginPayload = { studentId: string; name: string };
export type UserInfo = { person: string; role: string; name?: string };

export async function login(payload: LoginPayload): Promise<{ ok: boolean; error?: string; person?: string; role?: string; name?: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "登录失败" };
  }
}

export async function fetchCurrentUser(): Promise<{ ok: boolean; person?: string; role?: string; name?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.ok) return data;
    return { ok: false, error: data.error || "未登录" };
  } catch {
    return { ok: false, error: "网络错误" };
  }
}

// ---- Students (for dashboard stats) ----

export type StudentInfo = {
  student_id: string;
  name: string;
  email?: string;
  cohort?: string;
  status?: string;
};

export async function fetchStudents(): Promise<{ ok: boolean; students?: StudentInfo[]; error?: string }> {
  try {
    const res = await fetch("/api/students");
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "加载失败" };
  }
}

// ---- Dashboard stats (combined) ----

export type DashboardStats = {
  studentCount: number;
  challengeCount: number;
  submissionCount: number;
  pendingReview: number;
  completedCount: number;
  live: boolean;
};

export async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const [studentsRes, challengesRes, submissionsRes] = await Promise.all([
      fetch("/api/students"),
      fetch("/api/challenges"),
      fetch("/api/submissions"),
    ]);
    const students = await studentsRes.json();
    const challenges = await challengesRes.json();
    const submissions = await submissionsRes.json();

    const subs = submissions.ok ? (submissions.submissions || []) : [];
    return {
      studentCount: students.ok ? (students.students || []).length : 0,
      challengeCount: challenges.ok ? (challenges.challenges || []).length : 0,
      submissionCount: subs.length,
      pendingReview: subs.filter((s: SubmissionListItem) =>
        s.task_state === "pending_teacher_review" || s.status === "checked"
      ).length,
      completedCount: subs.filter((s: SubmissionListItem) =>
        s.task_state === "COMPLETED" || s.status === "accepted"
      ).length,
      live: students.ok || challenges.ok || submissions.ok,
    };
  } catch {
    return { studentCount: 0, challengeCount: 0, submissionCount: 0, pendingReview: 0, completedCount: 0, live: false };
  }
}

// ---- Submissions (T10) ----

export type SubmissionListItem = {
  submission_id: string;
  student_id: string;
  student_name: string;
  challenge_id: string;
  project_title: string;
  project_summary?: string;
  github_repo_url?: string;
  status?: string;
  task_state?: string;
  review_mode?: string;
  submitted_at?: string;
  score_total?: number;
};

export type EvaluationData = {
  evaluation_id: string;
  submission_id: string;
  student_id: string;
  challenge_id: string;
  evaluator_type: "ai" | "teacher" | "peer";
  evaluator_id: string;
  score_total: number;
  feedback: string;
  strengths?: string;
  weaknesses?: string;
  suggestions?: string;
  scores_json?: string;
  created_at: string;
};

export async function fetchSubmissions(): Promise<{ ok: boolean; submissions?: SubmissionListItem[]; error?: string }> {
  try {
    const res = await fetch("/api/submissions");
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "加载失败" };
  }
}

export type PeerReviewStatus = { assigned: boolean; completed: boolean };

export async function fetchSubmissionById(id: string): Promise<{ ok: boolean; submission?: SubmissionListItem; peer_review?: PeerReviewStatus; evaluation?: EvaluationData | null; teacher_evaluation?: EvaluationData | null; error?: string }> {
  try {
    const res = await fetch(`/api/submissions/${id}`);
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "加载失败" };
  }
}

// ---- Peer review (P2) ----

export type PeerReviewItem = {
  evaluation_id: string;
  submission_id: string;
  student_id: string;
  challenge_id: string;
  score_total: number;
  feedback: string;
  created_at: string;
  pending: boolean;
  project_title: string;
  submitter_name: string;
};

/** List my peer-review assignments (student) or all evaluations (teacher). */
export async function fetchMyPeerReviews(): Promise<{ ok: boolean; evaluations?: PeerReviewItem[]; error?: string }> {
  try {
    const res = await fetch("/api/evaluations");
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "加载失败" };
  }
}

export async function submitPeerReview(input: { submissionId: string; score: number; feedback: string }): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch("/api/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evaluator_type: "peer", ...input }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "提交失败" };
  }
}
