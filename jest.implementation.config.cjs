module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/implementation'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript', tsx: true }, target: 'es2022' }, module: { type: 'commonjs' } }] },
  moduleNameMapper: { '^@packages/(.*)$': '<rootDir>/packages/$1' },
  setupFilesAfterEnv: ['<rootDir>/tests/implementation/setup.ts'],
  clearMocks: true,
};
