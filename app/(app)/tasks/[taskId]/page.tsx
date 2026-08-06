"use client";
import { useParams } from "next/navigation";
import TaskDetailView from "@/components/tasks/TaskDetailView";
export default function InternTaskDetailPage() { const { taskId } = useParams<{ taskId: string }>(); return <TaskDetailView taskId={taskId} management={false} />; }
