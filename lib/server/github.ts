import { optionalEnv } from "./env";
import type { GitHubCheck } from "./types";
import { readEncryptedSecret } from "./secret-config";

export function parseGitHubUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

async function githubFetch(path: string) {
  const token = await readEncryptedSecret("GITHUB_TOKEN").catch(() => optionalEnv("GITHUB_TOKEN"));
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub API failed: ${response.status} ${response.statusText}`);
  return response.json();
}

export async function getRepoInfo(owner: string, repo: string) {
  return githubFetch(`/repos/${owner}/${repo}`);
}

export async function getReadme(owner: string, repo: string) {
  return githubFetch(`/repos/${owner}/${repo}/readme`);
}

export async function getLatestCommit(owner: string, repo: string) {
  const commits = await githubFetch(`/repos/${owner}/${repo}/commits?per_page=1`);
  return Array.isArray(commits) ? commits[0] : null;
}

export async function getReadmeContent(owner: string, repo: string): Promise<string | null> {
  const readme = await getReadme(owner, repo);
  if (!readme?.content) return null;
  try {
    return Buffer.from(readme.content, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

export async function getFileTree(owner: string, repo: string, branch?: string): Promise<string[]> {
  const ref = branch || "HEAD";
  const tree = await githubFetch(
    `/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`
  );
  if (!tree?.tree) return [];
  return tree.tree
    .filter((item: { type: string; path: string }) => item.type === "blob")
    .map((item: { type: string; path: string }) => item.path);
}

export async function getLatestCommitMsg(owner: string, repo: string): Promise<string | null> {
  const commit = await getLatestCommit(owner, repo);
  if (!commit?.commit?.message) return null;
  // truncate to first 500 chars
  return commit.commit.message.slice(0, 500);
}

export async function checkRepoHealth(repoUrl: string): Promise<GitHubCheck> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return {
      repoUrl,
      repoExists: false,
      repoAccessible: false,
      readmeExists: false,
      warnings: ["GitHub URL 格式不正确"],
      score: 0,
    };
  }

  const warnings: string[] = [];
  const repoInfo = await getRepoInfo(parsed.owner, parsed.repo);
  const repoExists = Boolean(repoInfo);
  if (!repoExists) warnings.push("仓库不存在或当前 token 无法访问");

  let readmeExists = false;
  let latestCommitAt: string | undefined;
  let latestCommitSha: string | undefined;
  let defaultBranch: string | undefined;
  let readmeContent: string | undefined;
  let fileList: string[] | undefined;
  let latestCommitMsg: string | undefined;

  if (repoExists) {
    defaultBranch = repoInfo.default_branch;
    const readme = await getReadme(parsed.owner, parsed.repo);
    readmeExists = Boolean(readme);
    if (!readmeExists) warnings.push("未检测到 README");

    // Phase 1: fetch actual content for AI evaluation
    const [content, files, commitMsg] = await Promise.all([
      getReadmeContent(parsed.owner, parsed.repo),
      getFileTree(parsed.owner, parsed.repo, defaultBranch),
      getLatestCommitMsg(parsed.owner, parsed.repo),
    ]);
    readmeContent = content ?? undefined;
    fileList = files.length > 0 ? files : undefined;
    latestCommitMsg = commitMsg ?? undefined;

    const commit = await getLatestCommit(parsed.owner, parsed.repo);
    latestCommitAt = commit?.commit?.committer?.date;
    latestCommitSha = commit?.sha;
    if (!latestCommitAt) warnings.push("未检测到最近提交");
  }

  const score = [repoExists, readmeExists, Boolean(latestCommitAt)].filter(Boolean).length * 30 + 10;
  return {
    repoUrl,
    owner: parsed.owner,
    repo: parsed.repo,
    repoExists,
    repoAccessible: repoExists,
    readmeExists,
    latestCommitAt,
    latestCommitSha,
    defaultBranch,
    readmeContent,
    fileList,
    latestCommitMsg,
    warnings,
    score: Math.min(score, 100),
  };
}
