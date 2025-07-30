import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import * as svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

export default [
	{
		ignores: [
			'dist/**',
			'build/**',
			'.svelte-kit/**',
			'node_modules/**',
			'*.config.js',
			'*.config.ts'
		]
	},
	js.configs.recommended,
	{
		files: ['**/*.js', '**/*.ts', '**/*.svelte'],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				// Svelte 5 runes
				$state: 'readonly',
				$derived: 'readonly',
				$effect: 'readonly',
				$props: 'readonly',
				$bindable: 'readonly',
				$inspect: 'readonly',
				// SvelteKit
				$app: 'readonly'
			}
		}
	},
	{
		files: ['**/*.ts', '**/*.js'],
		languageOptions: {
			parser: typescriptParser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				project: './tsconfig.json'
			}
		},
		plugins: {
			'@typescript-eslint': typescript
		},
		rules: {
			...typescript.configs.recommended.rules,
			'@typescript-eslint/no-unused-vars': ['error', { 
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_'
			}],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/ban-ts-comment': ['error', {
				'ts-ignore': 'allow-with-description',
				'minimumDescriptionLength': 3
			}],
			'no-undef': 'off',
			'no-unused-vars': 'off'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: typescriptParser,
				ecmaVersion: 'latest',
				sourceType: 'module',
				extraFileExtensions: ['.svelte']
			}
		},
		plugins: {
			svelte,
			'@typescript-eslint': typescript
		},
		rules: {
			'svelte/no-at-html-tags': 'off',
			'svelte/valid-compile': 'warn',
			'svelte/prefer-svelte-reactivity': 'off',
			// Disable TypeScript rules that conflict with Svelte
			'@typescript-eslint/no-unused-vars': 'off',
			'no-unused-vars': 'off',
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.test.ts', '**/*.test.js', '**/*.svelte.test.ts'],
		rules: {
			'no-console': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
		}
	}
];