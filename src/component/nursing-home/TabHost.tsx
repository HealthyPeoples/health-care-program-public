"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import MemberInfoView from '@/component/nursing-home/pages/member-info/MemberInfoView';
import DiseaseHistoryView from '@/component/nursing-home/pages/disease-history/DiseaseHistoryView';
import MemberContractInfo from '@/component/nursing-home/pages/member-contract-info/MemberContractInfo';
import GuardianInfo from '@/component/nursing-home/pages/guardian-info/GuardianInfo';
import DailyBeneficiaryPerformance from '@/component/nursing-home/pages/daily-beneficiary-performance/DailyBeneficiaryPerformance';
import EmployeeBasicInfo from '@/component/nursing-home/pages/employee-basic-info/EmployeeBasicInfo';
import ProgramPlanRegistration from '@/component/nursing-home/pages/program-plan-registration/ProgramPlanRegistration';

interface TabItem {
  id: string; // href 기반 고유키
  title: string;
  href: string;
}

function renderInternal(href: string) {
  switch (href) {
    case '/nursingHome/member-info':
      return <MemberInfoView />;
    case '/nursingHome/member-contract-info':
      return <MemberContractInfo />;
    case '/nursingHome/guardian-info':
      return <GuardianInfo />;

    case '/nursingHome/daily-beneficiary-performance':
      return <DailyBeneficiaryPerformance />;
    case '/nursingHome/daily-longterm-care':
      return <DailyBeneficiaryPerformance />;
    case '/nursingHome/snack-bulk-registration':
      return <DailyBeneficiaryPerformance />;
    case '/nursingHome/outing-processing':
      return <DailyBeneficiaryPerformance />;

    case '/nursingHome/medication-time':
      return <MemberInfoView />;
    case '/nursingHome/longterm-physical-activity':
      return <MemberInfoView />;
    case '/nursingHome/longterm-nursing-instruction':
      return <MemberInfoView />;
    case '/nursingHome/longterm-functional-cognitive':
      return <MemberInfoView />;
    case '/nursingHome/longterm-beneficiary-status':
      return <MemberInfoView />;
    case '/nursingHome/longterm-record-format':
      return <MemberInfoView />;

    case '/nursingHome/counseling-record':
      return <MemberInfoView />;
    case '/nursingHome/fact-verification':
      return <MemberInfoView />;
    case '/nursingHome/connection-record':
      return <MemberInfoView />;
    case '/nursingHome/status-change-observation':
      return <MemberInfoView />;
    case '/nursingHome/fact-verification-record-detail-detail':
      return <MemberInfoView />;

    case '/nursingHome/disease-history':
      return <DiseaseHistoryView />;

    case '/nursingHome/employee-basic-info':
      return <EmployeeBasicInfo />;
    case '/nursingHome/program-plan-registration':
      return <ProgramPlanRegistration />;
    default:
      return null;
  }
}

export default function TabHost() {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const router = useRouter();

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
      // 새 탭이 열릴 때 URL 업데이트
      router.push(detail.href);
    };
    window.addEventListener('NH_OPEN_TAB', handler as EventListener);
    return () => window.removeEventListener('NH_OPEN_TAB', handler as EventListener);
  }, [router]);

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeId) || null, [tabs, activeId]);

  const handleTabClick = (tab: TabItem) => {
    setActiveId(tab.id);
    // 탭 클릭 시 해당 페이지의 URL로 이동
    router.push(tab.href);
  };

  const closeTab = (id: string) => {
    setTabs((prev) => prev.filter((t) => t.id !== id));
    setActiveId((curr) => {
      if (curr === id) {
        const remain = tabs.filter((t) => t.id !== id);
        if (remain.length > 0) {
          const newActiveTab = remain[remain.length - 1];
          // 탭이 닫힐 때 남은 탭의 URL로 이동
          router.push(newActiveTab.href);
          return newActiveTab.id;
        } else {
          // 모든 탭이 닫힐 때 기본 페이지로 이동
          router.push('/nursingHome');
          return null;
        }
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
              tab.id === activeId ? 'bg-blue-100 text-blue-900 font-semibold' : 'bg-white text-blue-900 hover:bg-gray-50'
            }`}
            onClick={() => handleTabClick(tab)}
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
