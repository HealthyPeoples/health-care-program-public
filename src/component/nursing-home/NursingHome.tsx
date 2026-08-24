"use client";

/**
 * @file 요양원 앱 셸
 *
 * @description
 * 요양원 영역 루트 컴포넌트(메뉴·탭 호스트 연결)입니다.
 *
 * @module component/nursing-home/NursingHome
 */
import NursingHomeMenu from './organisms/NursingHomeMenu';
import DayNightCareMenu from './organisms/DayNightCareMenu';
import ShortTermCareMenu from './organisms/ShortTermCareMenu';
import TabHost from './TabHost';
import { ReactNode, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { logout, checkAuth } from '../../utils/auth';

const HEADER_HEIGHT = 56; // 14 * 4(px)
const SIDEBAR_WIDTH = 256; // 64 * 4(px)
const SIDEBAR_COLLAPSED_KEY = 'nh_sidebar_collapsed';
const LG_MEDIA = '(min-width: 1024px)';

interface NursingHomeProps {
  children?: ReactNode;
}

export const NursingHome = ({ children }: NursingHomeProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [institutionName, setInstitutionName] = useState<string>('');
  /** 사원명(F00120 EMPNM), 없으면 로그인 아이디(uid) */
  const [accountDisplayName, setAccountDisplayName] = useState<string>('');
  /** lg 미만: 사이드바 오버레이 열림 */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** lg 이상: 사이드바 숨김(본문 확장) */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLg, setIsLg] = useState(false);
  const [collapsedReady, setCollapsedReady] = useState(false);

  // 인증 체크 및 강제 로그아웃
  useEffect(() => {
    const verifyAuth = async () => {
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        await logout();
        router.push('/login');
      }
    };
    verifyAuth();
    
    // 주기적으로 인증 상태 확인 (5분마다)
    const interval = setInterval(verifyAuth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/user-info', { credentials: 'include' });
        const json = await res.json();
        const d = json?.success ? json.data : null;
        const annm = d?.annm ? String(d.annm).trim() : '';
        const empnm = d?.empnm ? String(d.empnm).trim() : '';
        const uid = d?.uid != null ? String(d.uid).trim() : '';
        const label = empnm || uid;
        if (!cancelled) {
          setInstitutionName(annm);
          setAccountDisplayName(label);
        }
      } catch {
        if (!cancelled) {
          setInstitutionName('');
          setAccountDisplayName('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 경로 변경 시 모바일/태블릿 사이드바 닫기
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia(LG_MEDIA);
    const apply = () => setIsLg(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
        setSidebarCollapsed(true);
      }
    } catch {
      /* ignore */
    }
    setCollapsedReady(true);
  }, []);

  useEffect(() => {
    if (!collapsedReady) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed, collapsedReady]);

  const sidebarExpanded = isLg ? !sidebarCollapsed : sidebarOpen;

  const toggleSidebar = () => {
    if (isLg) {
      setSidebarCollapsed((v) => !v);
    } else {
      setSidebarOpen((v) => !v);
    }
  };

  const hideSidebar = () => {
    if (isLg) {
      setSidebarCollapsed(true);
    } else {
      setSidebarOpen(false);
    }
  };

  const showSidebar = () => {
    if (isLg) {
      setSidebarCollapsed(false);
    } else {
      setSidebarOpen(true);
    }
  };
  
  const handleLogoClick = () => {
    if (pathname?.includes('nursingHome')) {
      router.push('/nursingHome');
    } else if (pathname?.includes('dayNightCare')) {
      router.push('/dayNightCare');
    } else if (pathname?.includes('shortTermCare')) {
      router.push('/shortTermCare');
    } else {
      router.push('/');
    }
  };
  
  const handleMainMoveClick = async () => {
    setShowConfirmModal(true);
  };
  
  const handleConfirmMove = async () => {
    setShowConfirmModal(false);
    await logout();
    router.push('/');
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };
  
  const handleCancelMove = () => {
    setShowConfirmModal(false);
  };
  
  const getDisplayText = () => {
    let base = 'CareProgram_DEMO';
    if (pathname?.includes('nursingHome')) {
      base = 'CareProgram_DEMO 요양원';
    } else if (pathname?.includes('dayNightCare')) {
      base = 'CareProgram_DEMO 주야간보호';
    } else if (pathname?.includes('shortTermCare')) {
      base = 'CareProgram_DEMO 단기보호';
    }
    if (institutionName) {
      return `${base} · ${institutionName}`;
    }
    return base;
  };
  
  const displayText = getDisplayText();

  const renderMenu = () => {
    if (pathname?.includes('dayNightCare')) {
      return <DayNightCareMenu />;
    } else if (pathname?.includes('shortTermCare')) {
      return <ShortTermCareMenu />;
    }
    return <NursingHomeMenu />;
  };

  return (
    <div className="nh-root-shell w-full min-h-screen min-w-0 max-w-[100vw] overflow-x-hidden bg-gray-50 h-fit">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              .nh-root-shell { background: #fff !important; min-height: auto !important; }
              .nh-main-content {
                margin-left: 0 !important;
                margin-top: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: none !important;
              }
              .nh-sidebar-overlay { display: none !important; }
              .nh-sidebar-expand { display: none !important; }
            }
          `,
        }}
      />
      {/* 상단 헤더 고정 */}
      <header
        className="print:hidden fixed top-0 left-0 right-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-blue-600 h-14 px-3 sm:px-6 text-white shadow w-full min-w-0"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button
            type="button"
            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-700 rounded text-sm hover:bg-blue-800 transition-colors"
            aria-label={sidebarExpanded ? '메뉴 숨기기' : '메뉴 펼치기'}
            aria-expanded={sidebarExpanded}
            onClick={toggleSidebar}
          >
            {/* 햄버거: 모바일 닫힘 / 데스크톱 숨김 상태 */}
            <svg
              className={`w-4 h-4 ${sidebarOpen ? 'hidden' : 'block'} ${sidebarCollapsed ? 'lg:block' : 'lg:hidden'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {/* 접기 아이콘: 모바일 열림 / 데스크톱 펼침 상태 */}
            <svg
              className={`w-4 h-4 ${sidebarOpen ? 'block' : 'hidden'} ${sidebarCollapsed ? 'lg:hidden' : 'lg:block'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
            <span>메뉴</span>
          </button>
          <button
            onClick={handleMainMoveClick}
            className="shrink-0 px-2 sm:px-3 py-1.5 bg-blue-700 rounded text-xs sm:text-sm hover:bg-blue-800 transition-colors"
          >
            메인으로 이동
          </button>
          <span 
            className="text-base sm:text-2xl font-bold tracking-wide cursor-pointer transition-opacity truncate min-w-0"
            // onClick={handleLogoClick}
          >
            {displayText}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 shrink-0">
          {institutionName || accountDisplayName ? (
            <span
              className="text-sm font-medium text-white/95 max-w-[min(40vw,280px)] sm:max-w-[min(100%,420px)] truncate inline-block align-middle"
              title={
                [institutionName && `기관명 ${institutionName}`, accountDisplayName && `${accountDisplayName}님`]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
            >
              {institutionName ? (
                <>
                 <span className="text-base font-bold">{institutionName}</span>
                </>
              ) : null}
              {institutionName && accountDisplayName ? (
                <span className="mx-1.5 text-white/70" aria-hidden>
                  ·
                </span>
              ) : null}
              {accountDisplayName ? (
                <>
                  <span className="text-base font-bold">{accountDisplayName}</span>님
                </>
              ) : null}
            </span>
          ) : null}
          <button 
            onClick={handleLogout}
            className="shrink-0 px-2 py-1 bg-blue-700 rounded text-xs hover:bg-blue-800 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* lg 미만 사이드바 오버레이 배경 */}
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="메뉴 닫기"
          className="nh-sidebar-overlay print:hidden lg:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* 데스크톱에서 숨긴 뒤 다시 펼치는 탭 */}
      {sidebarCollapsed ? (
        <button
          type="button"
          className="nh-sidebar-expand print:hidden hidden lg:flex fixed z-40 left-0 items-center justify-center h-14 w-7 rounded-r-md bg-blue-600 text-white shadow-md hover:bg-blue-700"
          style={{ top: HEADER_HEIGHT + 12 }}
          aria-label="메뉴 펼치기"
          onClick={showSidebar}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : null}

      {/* 왼쪽 메뉴: lg 이상 고정, 미만 오버레이. 데스크톱에서는 숨기기/펼치기 가능 */}
      <aside
        className={[
          'print:hidden fixed z-40 left-0 h-[calc(100vh-56px)] bg-white border-r border-gray-200 overflow-y-auto transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed ? 'lg:-translate-x-full' : 'lg:translate-x-0',
        ].join(' ')}
        style={{ width: SIDEBAR_WIDTH, top: HEADER_HEIGHT }}
        aria-hidden={!sidebarExpanded}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <span className="text-sm font-semibold text-blue-900">메뉴</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
            onClick={hideSidebar}
            aria-label={isLg ? '메뉴 숨기기' : '메뉴 닫기'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="lg:hidden">닫기</span>
            <span className="hidden lg:inline">숨기기</span>
          </button>
        </div>
        {renderMenu()}
      </aside>

      {/* 본문 컨텐츠: TabHost를 항상 표시
          w-full + ml-64 조합은 뷰포트보다 넓어져 페이지(탭 포함) 가로 스크롤이 생기므로
          lg에서는 사이드바 폭만큼 뺀 너비를 사용한다. */}
      <main
        className={[
          'nh-main-content min-h-screen min-w-0 p-0 w-full max-w-[100vw] overflow-x-hidden transition-[margin,width,max-width] duration-200 ease-out',
          sidebarCollapsed
            ? 'lg:ml-0 lg:w-full lg:max-w-[100vw]'
            : 'lg:ml-64 lg:w-[calc(100%-16rem)] lg:max-w-[calc(100vw-16rem)]',
        ].join(' ')}
        style={{ marginTop: HEADER_HEIGHT }}
      >
        <TabHost />
      </main>

      {/* 확인 모달 */}
      {showConfirmModal && (
        <div className="print:hidden fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 Tab:p-8 PC:p-10 max-w-md w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg Tab:text-xl PC:text-2xl font-bold text-gray-900 mb-4 PC:mb-6">
                확인
              </h3>
              <p className="text-sm Tab:text-base PC:text-lg text-gray-700 mb-6 Tab:mb-8 PC:mb-10">
                로그아웃 후 이동합니다.<br />
                정말로 이동하시겠습니까?
              </p>
              <div className="flex flex-wrap gap-3 Tab:gap-4 justify-center">
                <button
                  onClick={handleCancelMove}
                  className="px-6 Tab:px-8 PC:px-10 py-2 Tab:py-2.5 PC:py-3 bg-gray-200 text-gray-700 rounded-lg PC:rounded-xl hover:bg-gray-300 transition-colors text-sm Tab:text-base PC:text-lg font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmMove}
                  className="px-6 Tab:px-8 PC:px-10 py-2 Tab:py-2.5 PC:py-3 bg-blue-600 text-white rounded-lg PC:rounded-xl hover:bg-blue-700 transition-colors text-sm Tab:text-base PC:text-lg font-medium"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
