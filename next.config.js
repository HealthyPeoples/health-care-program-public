/** @type {import('next').NextConfig} */
const isWin = process.platform === 'win32';

const nextConfig = {
  // ✅ 트레이싱 전체 비활성화 (CSC 접근 원천 차단)
  outputFileTracing: false,

  // (선택) 혹시 모를 경로 제외를 남겨두고 싶다면 그대로 유지해도 됩니다
  experimental: {
    outputFileTracingExcludes: {
      '*': isWin ? ['C:\\\\Windows\\\\CSC\\\\**', 'C:/Windows/CSC/**'] : [],
    },
  },

  // ✅ 빌드 중 ESLint로 인한 광범위 스캔 방지
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
