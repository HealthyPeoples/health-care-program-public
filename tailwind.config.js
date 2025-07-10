/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/component/**/*.{js,ts,jsx,tsx,mdx}',
    './src/containers/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        //숫자가 낮을수록 연함

        // Brown 갈색 현재 1과 2 메인 글자 기본색으로 사용
        mainBrown1: '#D6D3D1',
        mainBrown2: '#A8A29E',
        mainBrown3: '#78716C',
        innerBg : '#EEEEEE', // 배경회색
        titleGray : '#111111',
        textGray : '#444444'
      },
      // 반응형의 경우 디자인 변형 기준을 위한 너비 설정
      screens: {
        PC: '1020px',
        Tab: '650px',
        App: '320px',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.clamp-3': {
          display: '-webkit-box',
          overflow: 'hidden',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '3',
        },
      }
      addUtilities(newUtilities, ['responsive', 'hover'])
    },
  ],
}
