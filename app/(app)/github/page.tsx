import {
  Github,
  ExternalLink,
  GitFork,
  Star,
  GitPullRequest,
  Users,
  BookOpen,
  Code2,
} from "lucide-react";

const repos = [
  {
    name: "nseap-core",
    description: "NSEAP 智能教育平台核心引擎 · 认知细胞架构实现",
    language: "TypeScript",
    stars: 24,
    forks: 8,
    updated: "2 天前",
    url: "https://github.com/nseap/nseap-core",
  },
  {
    name: "elite20-course",
    description: "Elite20 AI Native 课程内容 · Syllabus · Lecture · Lab · Challenge",
    language: "Markdown",
    stars: 18,
    forks: 12,
    updated: "12 小时前",
    url: "https://github.com/nseap/elite20-course",
  },
  {
    name: "agent-library",
    description: "NSEAP Agent 库 · Student Companion · Instructor · Mentor · Coding Coach",
    language: "Python",
    stars: 31,
    forks: 15,
    updated: "1 天前",
    url: "https://github.com/nseap/agent-library",
  },
  {
    name: "challenge-catalog",
    description: "Builder Challenge 目录 · PBL 挑战设计与评估标准",
    language: "JSON",
    stars: 12,
    forks: 5,
    updated: "3 天前",
    url: "https://github.com/nseap/challenge-catalog",
  },
  {
    name: "ontology-schema",
    description: "课程本体论 Schema · Skill · Course · Project · Assessment Ontology",
    language: "JSON Schema",
    stars: 9,
    forks: 3,
    updated: "1 周前",
    url: "https://github.com/nseap/ontology-schema",
  },
  {
    name: "knowledge-base",
    description: "课程统一知识库 · FAQ · 教材 · Prompt · 最佳实践 · 视频",
    language: "MDX",
    stars: 16,
    forks: 7,
    updated: "5 小时前",
    url: "https://github.com/nseap/knowledge-base",
  },
  {
    name: "nseap-docs",
    description: "NSEAP 文档门户 · 架构设计 · 开发指南 · 部署手册 · API 参考",
    language: "MDX",
    stars: 11,
    forks: 4,
    updated: "7 小时前",
    url: "https://github.com/nseap/nseap-docs",
  },
  {
    name: "demo-showcase",
    description: "Demo 演示 · Landing Page · Demo Video · Presentation · Website",
    language: "TypeScript",
    stars: 7,
    forks: 2,
    updated: "2 天前",
    url: "https://github.com/nseap/demo-showcase",
  },
];

const langColors: Record<string, string> = {
  TypeScript: "bg-blue-500",
  Python: "bg-green-500",
  Markdown: "bg-gray-400",
  JSON: "bg-yellow-500",
  "JSON Schema": "bg-yellow-500",
  MDX: "bg-indigo-400",
};

export default function GitHubPage() {
  return (
    <div className="space-y-6">
      {/* 组织概览 */}
      <div className="rounded-xl bg-gray-900 p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10">
            <Github className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold">NSEAP · Elite20</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              AI Native 智能教育平台 · 开源构建 · Builder Community
            </p>
            <div className="mt-3 flex gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                42 Builders
              </span>
              <span className="flex items-center gap-1">
                <GitFork className="h-4 w-4" />
                56 Forks
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4" />
                128 Stars
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 仓库列表 */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">仓库 ({repos.length})</h3>
          <a
            href="https://github.com/nseap"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            查看全部 <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="space-y-3">
          {repos.map((repo) => (
            <div
              key={repo.name}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-gray-400" />
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary-600 hover:underline"
                    >
                      NSEAP/{repo.name}
                    </a>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{repo.description}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${langColors[repo.language] || "bg-gray-400"}`}
                      />
                      {repo.language}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" /> {repo.stars}
                    </span>
                    <span className="flex items-center gap-1">
                      <GitFork className="h-3 w-3" /> {repo.forks}
                    </span>
                    <span>更新于 {repo.updated}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Builder 工作流 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-base font-semibold text-gray-900">Builder 工作流</h3>
        <div className="mt-4 grid grid-cols-5 gap-4">
          {[
            { step: "1", label: "认领任务", icon: Users },
            { step: "2", label: "AI 辅助开发", icon: Code2 },
            { step: "3", label: "提交 PR", icon: GitPullRequest },
            { step: "4", label: "Review", icon: Users },
            { step: "5", label: "合并发布", icon: GitFork },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
                <item.icon className="h-6 w-6 text-primary-600" />
              </div>
              <p className="mt-2 text-xs font-medium text-gray-900">步骤 {item.step}</p>
              <p className="text-xs text-gray-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
