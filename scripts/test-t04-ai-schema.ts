/**
 * T04 验收自测脚本
 * 验证 AiEvaluationSchema 能拦截缺字段/错误类型的 AI 返回
 * 用法: npx tsx scripts/test-t04-ai-schema.ts
 */
import { z } from "zod";

const AiEvaluationSchema = z.object({
  problemUnderstanding: z.number().int().min(0).max(20),
  aiUsage: z.number().int().min(0).max(20),
  artifactCompleteness: z.number().int().min(0).max(20),
  technicalExecution: z.number().int().min(0).max(20),
  reflectionQuality: z.number().int().min(0).max(20),
  scoreTotal: z.number().int().min(0).max(100),
  strengths: z.string().min(1),
  weaknesses: z.string().min(1),
  suggestions: z.string().min(1),
  feedback: z.string().min(1),
});

let passed = 0;
let failed = 0;

function test(name: string, input: unknown, expectOk: boolean) {
  const result = AiEvaluationSchema.safeParse(input);
  const ok = result.success === expectOk;
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     expected ${expectOk ? "pass" : "fail"}, got ${result.success ? "pass" : "fail"}`);
    if (!result.success) {
      console.log(`     errors:`, JSON.stringify(result.error.flatten().fieldErrors));
    }
  }
}

const valid: z.infer<typeof AiEvaluationSchema> = {
  problemUnderstanding: 16,
  aiUsage: 15,
  artifactCompleteness: 18,
  technicalExecution: 14,
  reflectionQuality: 17,
  scoreTotal: 80,
  strengths: "项目目标清晰，AAR 反思深入",
  weaknesses: "代码缺乏测试覆盖",
  suggestions: "增加单元测试和 Demo 录屏",
  feedback: "整体质量良好，建议补充测试",
};

console.log("\n--- Valid input ---");
test("fully valid input", valid, true);

console.log("\n--- Missing fields (模拟 DeepSeek 漏字段) ---");
test("missing problemUnderstanding", { ...valid, problemUnderstanding: undefined }, false);
test("missing feedback", { ...valid, feedback: undefined }, false);

console.log("\n--- Wrong types ---");
test("string instead of number", { ...valid, scoreTotal: "eighty" }, false);
test("empty string for strengths", { ...valid, strengths: "" }, false);

console.log("\n--- Out of range ---");
test("score > 100", { ...valid, scoreTotal: 150 }, false);
test("dimension > 20", { ...valid, problemUnderstanding: 25 }, false);
test("negative score", { ...valid, scoreTotal: -1 }, false);

console.log("\n--- Extra fields (should pass) ---");
test("extra junk field", { ...valid, junk: "whatever" }, true);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
