// 教师评价有效性规则（P0-5）
// 历史重复记录不删除；同一 Submission 最早产生的教师评价是唯一有效终审。

export interface EvaluationIdentity {
  evaluation_id: string;
  evaluator_type: string;
  created_at?: string;
}

function compareEvaluationOrder(
  left: EvaluationIdentity,
  right: EvaluationIdentity,
): number {
  const leftTime = Date.parse(left.created_at || "");
  const rightTime = Date.parse(right.created_at || "");
  const leftHasTime = Number.isFinite(leftTime);
  const rightHasTime = Number.isFinite(rightTime);

  if (leftHasTime && rightHasTime && leftTime !== rightTime) {
    return leftTime - rightTime;
  }
  // 历史脏数据缺少 created_at 时，优先选择有明确时间的记录；
  // 若双方都缺失，再使用包含时间戳的 evaluation_id 做稳定排序。
  if (leftHasTime !== rightHasTime) return leftHasTime ? -1 : 1;
  return left.evaluation_id.localeCompare(right.evaluation_id);
}

export function selectEffectiveTeacherEvaluation<T extends EvaluationIdentity>(
  evaluations: readonly T[],
): T | undefined {
  return evaluations
    .filter((evaluation) => evaluation.evaluator_type === "teacher")
    .sort(compareEvaluationOrder)[0];
}

export function effectiveTeacherEvaluationIds<
  T extends EvaluationIdentity & { submission_id?: string },
>(evaluations: readonly T[]): ReadonlySet<string> {
  const bySubmission = new Map<string, T[]>();

  for (const evaluation of evaluations) {
    if (evaluation.evaluator_type !== "teacher" || !evaluation.submission_id) continue;
    const group = bySubmission.get(evaluation.submission_id) || [];
    group.push(evaluation);
    bySubmission.set(evaluation.submission_id, group);
  }

  return new Set(
    Array.from(bySubmission.values())
      .map(selectEffectiveTeacherEvaluation)
      .filter((evaluation): evaluation is T => Boolean(evaluation))
      .map((evaluation) => evaluation.evaluation_id),
  );
}
