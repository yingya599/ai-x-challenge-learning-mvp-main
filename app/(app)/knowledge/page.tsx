"use client";

import { useState, useEffect } from "react";
import {
  Search, MessageCircle, BookOpen, Terminal,
  Lightbulb, Video, Clock, ExternalLink, Loader2,
} from "lucide-react";

interface KnowledgeItem {
  id: string;
  title: string;
  type: string;
  tags: string[];
  summary: string;
  lastUpdated: string;
}

const typeIcons: Record<string, React.ElementType> = {
  FAQ: MessageCircle,
  教材: BookOpen,
  Prompt: Terminal,
  最佳实践: Lightbulb,
  视频: Video,
};

const typeColors: Record<string, string> = {
  FAQ: "bg-blue-50 text-blue-700 border-blue-200",
  教材: "bg-amber-50 text-amber-700 border-amber-200",
  Prompt: "bg-purple-50 text-purple-700 border-purple-200",
  最佳实践: "bg-green-50 text-green-700 border-green-200",
  视频: "bg-red-50 text-red-700 border-red-200",
};

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platform-content")
      .then((r) => r.json())
      .then((d) => setItems(d.knowledge || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((item) => {
    const matchesSearch =
      search === "" ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.summary.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesType = !activeType || item.type === activeType;
    return matchesSearch && matchesType;
  });

  const types = Array.from(new Set(items.map((k) => k.type)));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Loader2 className="mb-2 h-8 w-8 animate-spin" />
        <p className="text-sm">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索知识库..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveType(null)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            !activeType ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}>全部</button>
        {types.map((type) => {
          const Icon = typeIcons[type] || BookOpen;
          return (
            <button key={type} onClick={() => setActiveType(type)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                activeType === type ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              <Icon className="h-3.5 w-3.5" />{type}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((item) => {
          const Icon = typeIcons[item.type] || BookOpen;
          return (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border ${typeColors[item.type] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{item.title}</h3>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${typeColors[item.type] || "bg-gray-50 text-gray-600 border-gray-200"}`}>{item.type}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-gray-500">{item.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tag}</span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center text-xs text-gray-400">
                    <Clock className="mr-1 h-3 w-3" />{item.lastUpdated}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Search className="mb-2 h-8 w-8" />
          <p className="text-sm">未找到匹配的知识条目</p>
        </div>
      )}
    </div>
  );
}
