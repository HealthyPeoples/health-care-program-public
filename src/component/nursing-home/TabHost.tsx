"use client";

import { useEffect, useMemo, useState } from 'react';
import MemberInfoView from './pages/MemberInfoView';

interface TabItem {
  id: string; // href 기반 고유키
  title: string;
  href: string;
}

function renderInternal(href: string) {
  switch (href) {
    case '/nursingHome/member-info':
      return <MemberInfoView />;
    default:
      return null;
  }
}

export default function TabHost() {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { href: string; title: string };
      const id = detail.href;
      setTabs((prev) => {
        const exists = prev.some((t) => t.id === id);
        const next = exists ? prev : [...prev, { id, title: detail.title, href: detail.href }];
        return next;
      });
      setActiveId(id);
    };
    window.addEventListener('NH_OPEN_TAB', handler as EventListener);
    return () => window.removeEventListener('NH_OPEN_TAB', handler as EventListener);
  }, []);

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeId) || null, [tabs, activeId]);

  const closeTab = (id: string) => {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveId((curr) => {
      if (curr === id) {
        const remain = tabs.filter((t) => t.id !== id);
        return remain.length ? remain[remain.length - 1].id : null;
      }
      return curr;
    });
  };

  if (tabs.length === 0) {
    return <div className="text-gray-400 text-center mt-20">좌측 메뉴를 클릭해 탭을 여세요</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* 탭 바 */}
      <div className="flex items-center gap-1 border-b border-gray-200 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`group flex items-center gap-2 px-3 py-2 text-sm border-r border-gray-200 ${
              tab.id === activeId ? 'bg-blue-100 text-blue-900 font-semibold' : 'hover:bg-gray-50'
            }`}
            onClick={() => setActiveId(tab.id)}
          >
            <span>{tab.title}</span>
            <span
              className="ml-1 text-gray-400 group-hover:text-gray-600"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >×</span>
          </button>
        ))}
      </div>
      {/* 컨텐츠 */}
      <div className="flex-1 bg-white">
        {activeTab && (renderInternal(activeTab.href) || (
          <iframe src={activeTab.href} className="w-full h-[70vh]" />
        ))}
      </div>
    </div>
  );
}
