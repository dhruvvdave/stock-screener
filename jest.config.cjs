module.exports = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      transform: { '^.+\\.jsx?$': 'babel-jest' },
      testMatch: ['<rootDir>/src/__tests__/**/*.test.js'],
    },
    {
      displayName: 'dom',
      testEnvironment: 'jsdom',
      transform: { '^.+\\.jsx?$': 'babel-jest' },
      testMatch: ['<rootDir>/src/__tests__/**/*.test.jsx'],
      setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
    },
  ],
};
