"use client";

import { useState, useEffect } from "react";
import { FileText, Search, ChevronRight, Clock, User, Tag, BookOpen, Loader2 } from "lucide-react";

interface DocSection {
  id: string;
  title: string;
  category: string;
  author: string;
  lastUpdated: string;
  content: string;
}

const categories = ["架构设计", "开发指南", "课程设计", "运维指南"];

export default function DocsPage() {
  const [docs, setDocs] = useState<DocSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocSection | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platform-content")
      .then((r) => r.json())
      .then((d) => {
        const list = d.docs || [];
        setDocs(list);
        if (list.length > 0) setSelectedDoc(list[0]);
      })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = docs.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase()) ||
      d.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || d.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Loader2 className="mb-2 h-8 w-8 animate-spin" />
        <p className="text-sm">加载中...</p>
      </div>
    );
  }

  if (!selectedDoc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <BookOpen className="mb-2 h-8 w-8" />
        <p className="text-sm">暂无文档</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 flex-shrink-0 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="搜索文档..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none" />
        </div>
        <div>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase text-gray-400">文档分类</h3>
          <div className="space-y-1">
            <button onClick={() => setActiveCategory(null)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                !activeCategory ? "bg-primary-50 text-primary-700 font-medium" : "text-gray-600 hover:bg-gray-100"
              }`}><Tag className="h-3.5 w-3.5" />全部</button>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeCategory === cat ? "bg-primary-50 text-primary-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                }`}><Tag className="h-3.5 w-3.5" />{cat}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          {filtered.map((doc) => (
            <button key={doc.id} onClick={() => setSelectedDoc(doc)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                selectedDoc.id === doc.id ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50"
              }`}>
              <FileText className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.title}</p>
                <p className="text-xs text-gray-400">{doc.category}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-gray-200 bg-white p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <BookOpen className="h-4 w-4" /><span>{selectedDoc.category}</span>
            <ChevronRight className="h-3 w-3" /><span className="text-gray-600">{selectedDoc.title}</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">{selectedDoc.title}</h1>
          <div className="mt-3 flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{selectedDoc.author}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{selectedDoc.lastUpdated}</span>
          </div>
        </div>
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-700 leading-relaxed">{selectedDoc.content}</p>
        </div>
      </div>
    </div>
  );
}
