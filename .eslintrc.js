module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true, // Node.js 환경 추가
  },
  extends: [
    'eslint:recommended', 
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended'
  ],
  overrides: [
    {
      env: {
        node: true,
      },
      files: ['.eslintrc.{js,cjs}', '**/*.js', '**/*.mjs'], // JavaScript 파일들 포함
      parserOptions: {
        sourceType: 'script',
      },
      rules: {
        '@typescript-eslint/no-unused-vars': 'off', // JS 파일에서는 비활성화
        'no-undef': 'off', // Node.js 전역 변수 허용
        '@typescript-eslint/no-var-requires': 'off', // CommonJS require 허용
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/react-in-jsx-scope': 'off', // Next.js App Router에서는 불필요
    'react/prop-types': 'off', // TypeScript를 사용하므로 불필요
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
}
