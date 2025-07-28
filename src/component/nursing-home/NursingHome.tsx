import NursingHomeMenu from './organisms/NursingHomeMenu';

const HEADER_HEIGHT = 56; // 14 * 4(px)
const SIDEBAR_WIDTH = 256; // 64 * 4(px)

export const NursingHome = ({ children }: { children?: React.ReactNode }) => {
  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* 상단 헤더 고정 */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between w-full px-6 text-white bg-blue-600 shadow h-14"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold tracking-wide">HHDEMO</span>
          <button className="px-2 py-1 ml-2 text-xs bg-blue-700 rounded">최근내역</button>
          <button className="px-2 py-1 ml-1 text-xs bg-blue-700 rounded">즐겨찾기</button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">사용메뉴</span>
          <span className="text-sm">20250711-1550</span>
          <span className="text-sm">KR</span>
          <span className="text-sm">dhmaster ▼</span>
          <button className="px-2 py-1 text-xs bg-blue-700 rounded">회사변경</button>
          <button className="px-2 py-1 text-xs bg-blue-700 rounded">비밀번호 변경</button>
          <button className="px-2 py-1 text-xs bg-blue-700 rounded">로그아웃</button>
        </div>
      </header>
      {/* 왼쪽 메뉴 고정 */}
      <aside
        className="fixed z-40 top-14 left-0 h-[calc(100vh-56px)] bg-white border-r border-gray-200"
        style={{ width: SIDEBAR_WIDTH, top: HEADER_HEIGHT }}
      >
        <NursingHomeMenu />
      </aside>
      {/* 본문 컨텐츠 */}
      <main
        className="min-h-screen p-8"
        style={{ marginLeft: SIDEBAR_WIDTH, marginTop: HEADER_HEIGHT }}
      >
        {children || <div className="mt-20 text-center text-gray-400">메뉴를 선택하세요</div>}
      </main>
    </div>
  );
};