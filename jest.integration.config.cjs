module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript' }, target: 'es2022' }, module: { type: 'commonjs' } }] },
  moduleNameMapper: { '^@packages/(.*)$': '<rootDir>/packages/$1' },
  testTimeout: 120000,
  maxWorkers: 1,
};
