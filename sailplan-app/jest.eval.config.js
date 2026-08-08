/**
 * Jest config for the opt-in evaluation suites (`*.eval.ts`), which are
 * excluded from the default run (they match no default testMatch pattern).
 * Run with `npm run eval:suggestions`.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.eval.ts'],
};
