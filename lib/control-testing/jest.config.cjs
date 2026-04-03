/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['./jest.setup.cjs'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'Node',
          lib: ['ES2022', 'DOM'],
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@workspace/json-control$': '<rootDir>/../../lib/json-control/src/index.js',
  },
};
