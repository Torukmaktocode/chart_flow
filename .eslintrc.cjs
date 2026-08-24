module.exports = {
  root: true,
  env: { node: true, es2020: true },
  extends: ['eslint:recommended'],
  ignorePatterns: ['dist', '.eslintrc.cjs', '*.config.*', 'node_modules/', 'assets/'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'off',
  },
};
