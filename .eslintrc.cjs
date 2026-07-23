module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', '*.config.*', 'node_modules/', 'assets/'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '19.0' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'react/prop-types': 'off',
    'no-unused-vars': 'warn',
    'no-console': 'off',
    'react/no-unknown-property': ['error', { ignore: ['opacity'] }],
  },
  overrides: [
    {
      files: ['*.mjs'],
      env: { node: true, browser: false },
      rules: { 'no-console': 'off' },
    },
  ],
};