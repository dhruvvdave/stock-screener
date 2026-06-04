module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.js$': 'babel-jest' },
  // Treat .js files in api/ and src/ as transformable (they're ESM)
  transformIgnorePatterns: ['/node_modules/'],
};
