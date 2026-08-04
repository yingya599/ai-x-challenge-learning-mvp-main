import { redirect } from "next/navigation";

export default async function LegacyTeacherPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  const challengeId = typeof params.challengeId === "string" ? params.challengeId : undefined;
  if (challengeId) query.set("categoryId", challengeId);
  redirect(`/management${query.size ? `?${query.toString()}` : ""}`);
}
