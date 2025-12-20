import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

/**
 * ESLint flat config for ui-kit package.
 * Pure React components with NO Electron dependencies.
 * All components must work in any browser environment (no Node.js APIs).
 */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', '*.cjs', '*.mjs'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        MouseEvent: 'readonly',
        HTMLDivElement: 'readonly',
        // TypeScript/React types (available globally with JSX transform)
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      // React rules
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      
      // Enforce browser-only APIs (no Node.js)
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'ui-kit must not use Node.js APIs. This is a pure React library for renderer-only use.',
        },
        {
          name: 'require',
          message: 'ui-kit must not use require(). Use ES modules import instead.',
        },
        {
          name: '__dirname',
          message: 'ui-kit must not use Node.js globals. This is a browser-only library.',
        },
        {
          name: '__filename',
          message: 'ui-kit must not use Node.js globals. This is a browser-only library.',
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  // Test files configuration
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
    languageOptions: {
      globals: {
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        test: 'readonly',
        // Browser/test globals
        HTMLElement: 'readonly',
        Element: 'readonly',
      },
    },
  },
];
