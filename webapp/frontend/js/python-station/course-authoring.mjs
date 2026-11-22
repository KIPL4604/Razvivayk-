export const theory = (text, code = "", example) => ({ kind: "theory", text, code, example, runtime: "python" });

export const quiz = (text, code, correct, distractors, why, hint = "") =>
  ({ kind: "quiz", text, code, options: [correct, ...distractors], why, hint });

export function exercise({ text, starter = "", cases, hint, solution, display = "", continueCode = false }) {
  return {
    kind: "practice", text, starter, hint, solution, display, continueCode,
    cases: cases.map(sample => ({ initial: {}, ...sample })),
    runtime: "python",
  };
}
