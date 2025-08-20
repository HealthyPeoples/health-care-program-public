import NursingHomeMenu from './organisms/NursingHomeMenu';
import TabHost from './TabHost';
import { ReactNode } from 'react';

const HEADER_HEIGHT = 56; // 14 * 4(px)
const SIDEBAR_WIDTH = 256; // 64 * 4(px)

interface NursingHomeProps {
  children?: ReactNode;
}

export const NursingHome = ({ children }: NursingHomeProps) => {
  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* 상단 헤더 고정 */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-blue-600 h-14 px-6 text-white shadow w-full"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold tracking-wide">HHDEMO</span>
          <button className="ml-2 px-2 py-1 bg-blue-700 rounded text-xs">최근내역</button>
          <button className="ml-1 px-2 py-1 bg-blue-700 rounded text-xs">즐겨찾기</button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">사용메뉴</span>
          <span className="text-sm">20250711-1550</span>
          <span className="text-sm">KR</span>
          <span className="text-sm">dhmaster ▼</span>
          <button className="px-2 py-1 bg-blue-700 rounded text-xs">회사변경</button>
          <button className="px-2 py-1 bg-blue-700 rounded text-xs">비밀번호 변경</button>
          <button className="px-2 py-1 bg-blue-700 rounded text-xs">로그아웃</button>
        </div>
      </header>
      {/* 왼쪽 메뉴 고정 */}
      <aside
        className="fixed z-40 top-14 left-0 h-[calc(100vh-56px)] bg-white border-r border-gray-200"
        style={{ width: SIDEBAR_WIDTH, top: HEADER_HEIGHT }}
      >
        <NursingHomeMenu />
      </aside>
      {/* 본문 컨텐츠: TabHost를 항상 표시 */}
      <main
        className="min-h-screen p-0"
        style={{ marginLeft: SIDEBAR_WIDTH, marginTop: HEADER_HEIGHT }}
      >
        <TabHost />
      </main>
    </div>
  );
};