"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

const sections = {
  '수급자관리': {
    '수급자 기본정보 관리': [
      { name: '수급자 기본정보 등록', link: '/nursingHome/beneficiary-basic-info' },
      { name: '수급자 계약정보 등록', link: '/nursingHome/beneficiary-contract-info' },
      { name: '보호자정보 등록', link: '/nursingHome/guardian-info' },
    ],
    '서비스실적등록': [
      { name: '일 수급자급여실적 등록', link: '/nursingHome/daily-beneficiary-performance' },
      { name: '일 장기요양제공내역 등록', link: '/nursingHome/daily-longterm-care' },
      { name: '간식내역 일괄 등록', link: '/nursingHome/snack-bulk-registration' },
      { name: '외출/외박 처리', link: '/nursingHome/outing-processing' },
    ],
    '수급자서비스 입력기준 정보 등록': [
      { name: '약물복용시간', link: '/nursingHome/medication-time' },
      { name: '장기요양-신체활동', link: '/nursingHome/longterm-physical-activity' },
      { name: '장기요양-간호및지시', link: '/nursingHome/longterm-nursing-instruction' },
      { name: '장기요양-기능및인지관리', link: '/nursingHome/longterm-functional-cognitive' },
      { name: '장기요양-수급자상태', link: '/nursingHome/longterm-beneficiary-status' },
      { name: '장기요양기록양식 출력', link: '/nursingHome/longterm-record-format' },
    ],
    '상담관리': [
      { name: '보호자(수급자)상담내역 등록', link: '/nursingHome/counseling-record' },
      { name: '사실확인서 출력', link: '/nursingHome/fact-verification' },
      { name: '연계기록지 출력', link: '/nursingHome/connection-record' },
      { name: '수급자 상태변화(관찰)내역 등록', link: '/nursingHome/status-change-observation' },
      { name: '응급상황기록', link: '/nursingHome/emergency-record' },
    ],
    '사례회의 관리': [
      { name: '사례관리 등록', link: '/nursingHome/case-management' },
    ],
    '월 장기요양 제공내역 관리': [
      { name: '월 장기요양제공내역 집계 및 출력', link: '/nursingHome/monthly-longterm-summary' },
    ],
    '보호자 간담회': [
      { name: '보호자 간담회내역 등록', link: '/nursingHome/guardian-meeting' },
    ],
    '수급자 현황': [
      { name: '수급자 현황 조회 및 출력', link: '/nursingHome/beneficiary-status-inquiry' },
    ],
  },
  '요양 서비스': {
    '장기요양제공 관리': [
      { name: '장기요양제공내역 등록', link: '/nursingHome/longterm-care-registration' },
    ],
    '배설관찰 관리': [
      { name: '집중배설관찰 등록', link: '/nursingHome/intensive-excretion-observation' },
      { name: '배설관찰 등록', link: '/nursingHome/excretion-observation' },
    ],
    '목욕서비스 관리': [
      { name: '목욕서비스제공내역 등록', link: '/nursingHome/bath-service' },
    ],
    '체위변경 관리': [
      { name: '체위변경내역 등록', link: '/nursingHome/position-change-record' },
    ],
  },
  '간호 서비스': {
    '질병 및 건강관리': [
      { name: '활력증상 등록', link: '/nursingHome/vital-signs' },
      { name: '수급자건강검진내역 등록', link: '/nursingHome/health-examination' },
      { name: '수급자질병내역 등록', link: '/nursingHome/disease-history' },
    ],
    '약물관리': [
      { name: '수급자 복용약물 등록', link: '/nursingHome/medication-registration' },
      { name: '약물복용실적 등록', link: '/nursingHome/medication-performance' },
    ],
    '진료기록관리': [
      { name: '외래진료실적 등록', link: '/nursingHome/outpatient-record' },
      { name: '촉탁의진료내역 등록', link: '/nursingHome/entrusted-medical' },
      { name: '간호서비스내역', link: '/nursingHome/nursing-service' },
    ],
    '욕창 관리': [
      { name: '욕창관리내역 등록', link: '/nursingHome/bedsore-management' },
    ],
    '유치도뇨관 관리': [
      { name: '유치도뇨관괸리내역 등록', link: '/nursingHome/indwelling-catheter' },
    ],
  },
  '물리(작업)치료 서비스': {
    '물리치료관리': [
      { name: '물리치료표준시간 등록', link: '/nursingHome/physical-therapy-standard-time' },
      { name: '물리치료실적 등록', link: '/nursingHome/physical-therapy-performance' },
      { name: '물리치료 계획 및 평가 등록', link: '/nursingHome/physical-therapy-plan-evaluation' },
      { name: '물리치료실적 평가 등록', link: '/nursingHome/physical-therapy-performance-evaluation' },
    ],
  },
  '프로그램 서비스': {
    '사원프로그램 계획 관리정보': [
      { name: '프로그램계획서 등록', link: '/nursingHome/program-plan-registration' },
      { name: '프로그램 총평 및 수급자평가 등록', link: '/nursingHome/program-evaluation' },
    ],
    '프로그램 일지': [
      { name: '프로그램 일지 등록', link: '/nursingHome/program-daily-log' },
    ],
    '월 프로그램 수행계획': [
      { name: '월 프로그램 수행계획 등록', link: '/nursingHome/monthly-program-plan' },
    ],
    '프로그램 의견수렴 및 반영': [
      { name: '프로그램 의견수렴 및 반영', link: '/nursingHome/program-feedback' },
    ],
  },
  '요구도관리': {
    '욕구 사정 기록지': [
      { name: '욕구 사정 기록지 등록', link: '/nursingHome/needs-assessment-record' },
    ],
    '욕창 위험도 측정': [
      { name: '욕창 위험도 측정내역 등록', link: '/nursingHome/bedsore-risk-measurement' },
    ],
    '낙상 위험측정(Hnhn)': [
      { name: '낙상 위험측정(Hnhn) 내역 등록', link: '/nursingHome/fall-risk-measurement' },
    ],
    '인지상태 평가': [
      { name: '인지상태 평가내역 등록', link: '/nursingHome/cognitive-assessment-record' },
    ],
  },
  '수급자 부담금 관리': {
    '부담금 발생자료 관리': [
      { name: '월급여자료 생성', link: '/nursingHome/monthly-salary-data' },
    ],
    '부담금 수금내역 관리': [
      { name: '월급여 수금내역 등록', link: '/nursingHome/monthly-salary-collection' },
    ],
    '부담금 명세서 발부대장': [
      { name: '월급여명세서및 발부 대장', link: '/nursingHome/monthly-salary-statement' },
    ],
    '수급자 급여 기초설정': [
      { name: '등급별급여Table 등록', link: '/nursingHome/grade-salary-table' },
    ],
  },
  '직원(사원)관리': {
    '사원 기본정보관리': [
      { name: '사원 기본(인적)정보 등록', link: '/nursingHome/employee-basic-info' },
    ],
    '사원근태관리': [
      { name: '사원 근태 등록', link: '/nursingHome/employee-attendance' },
      { name: '사원 근태현황(월) 조회', link: '/nursingHome/employee-attendance-monthly' },
    ],
    '사원년차관리': [
      { name: '년차 생성 및 조회', link: '/nursingHome/employee-annual-leave' },
    ],
    '근무시간표': [
      { name: '근무시간표', link: '/nursingHome/work-schedule' },
    ],
    '연간일정표': [
      { name: '연간 일정 등록 및 조회', link: '/nursingHome/annual-schedule' },
    ],
    '직원 회의록': [
      { name: '직원 회의록 등록', link: '/nursingHome/employee-meeting-minutes' },
    ],
    '직무교육': [
      { name: '직원직무교육내역 등록', link: '/nursingHome/employee-job-training' },
    ],
  },
  '시설 관리 및 기타': {
    '시설정보등록': [
      { name: '시설기본정보 등록', link: '/nursingHome/facility-basic-info' },
      { name: '시설 사용자(ID) 관리', link: '/nursingHome/facility-user-management' },
    ],
    '업무프로그램관리': [
      { name: '사원/업무프로그램 매핑', link: '/nursingHome/employee-program-mapping' },
      { name: '사원/수급자 매핑', link: '/nursingHome/employee-beneficiary-mapping' },
    ],
    '시설 일과표': [
      { name: '시설(직원)일과표 관리', link: '/nursingHome/facility-daily-schedule' },
    ],
    '센터 업무현황': [
      { name: '시설업무일지 등록', link: '/nursingHome/facility-work-log' },
      { name: '시설업무일지 결재', link: '/nursingHome/facility-work-log-approval' },
    ],
    '자원봉사자 관리': [
      { name: '단체봉사 실적 등록', link: '/nursingHome/group-volunteer-performance' },
      { name: '개인봉사 실적 등록', link: '/nursingHome/individual-volunteer-performance' },
    ],
    '공지사항관리': [
      { name: '공지사항 등록', link: '/nursingHome/notice-registration' },
      { name: '공지사항 조회', link: '/nursingHome/notice-inquiry' },
    ],
    '자료실': [
      { name: '자료실', link: '/nursingHome/data-room' },
    ],
    '평가체크리스트': [
      { name: '평가체크리스트', link: '/nursingHome/evaluation-checklist' },
    ],
  },
};

export default function NursingHomeMenu() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openSubSection, setOpenSubSection] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleToggle = (section: string) => {
    setOpenSection(openSection === section ? null : section);
    setOpenSubSection(null);
  };

  const handleSubToggle = (subSection: string) => {
    setOpenSubSection(openSubSection === subSection ? null : subSection);
  };

  // 검색 결과 필터링
  const filteredSections = useMemo(() => {
    if (!searchTerm.trim()) {
      return sections;
    }

    const filtered: Record<string, Record<string, { name: string; link: string; }[]>> = {};
    Object.entries(sections).forEach(([sectionTitle, subSections]) => {
      const filteredSubSections: Record<string, { name: string; link: string; }[]> = {};
      
      Object.entries(subSections).forEach(([subSectionTitle, items]) => {
        const filteredItems = items.filter(item =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sectionTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          subSectionTitle.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (filteredItems.length > 0) {
          filteredSubSections[subSectionTitle] = filteredItems;
        }
      });
      
      if (Object.keys(filteredSubSections).length > 0) {
        filtered[sectionTitle] = filteredSubSections;
      }
    });

    return filtered;
  }, [searchTerm]);

  // 검색 시 해당 섹션 자동 열기
  React.useEffect(() => {
    if (searchTerm.trim()) {
      const matchingSections = Object.keys(filteredSections);
      if (matchingSections.length > 0) {
        const firstSection = matchingSections[0];
        setOpenSection(firstSection);
        const sectionData = filteredSections[firstSection];
        if (sectionData && typeof sectionData === 'object') {
          const firstSubSections = Object.keys(sectionData);
          if (firstSubSections.length > 0) {
            setOpenSubSection(firstSubSections[0]);
          }
        }
      }
    } else {
      setOpenSection(null);
      setOpenSubSection(null);
    }
  }, [searchTerm, filteredSections]);

  return (
    <nav className="w-64 h-screen p-4 overflow-y-auto bg-white border-r border-gray-200">
      {/* 검색 입력창 */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="메뉴 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 pl-10 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <ul>
        {Object.entries(filteredSections).map(([title, subSections]) => (
          <li key={title} className="mb-2">
            <button
              className="flex items-center w-full px-3 py-2 font-semibold text-left text-blue-700 transition rounded hover:bg-blue-50"
              onClick={() => handleToggle(title)}
              aria-expanded={openSection === title}
            >
              <span className="flex-1">{title}</span>
              <svg
                className={`w-4 h-4 ml-2 transition-transform ${openSection === title ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {openSection === title && (
              <ul className="pl-2 mt-1 ml-4 border-l border-blue-100">
                {Object.entries(subSections).map(([subTitle, items]) => (
                  <li key={subTitle} className="mb-1">
                    <button
                      className="flex items-center w-full px-2 py-1 text-sm font-medium text-left text-gray-700 transition rounded hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => handleSubToggle(subTitle)}
                      aria-expanded={openSubSection === subTitle}
                    >
                      <span className="flex-1">{subTitle}</span>
                      <svg
                        className={`w-3 h-3 ml-1 transition-transform ${openSubSection === subTitle ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {openSubSection === subTitle && (
                      <ul className="pl-2 mt-1 ml-4 border-l border-gray-200">
                        {items.map((item) => (
                          <li key={item.name}>
                            <Link
                              href={item.link}
                              className="block px-2 py-1 text-xs text-gray-600 rounded hover:text-blue-500 hover:bg-blue-50"
                            >
                              {item.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      
      {/* 검색 결과가 없을 때 */}
      {searchTerm && Object.keys(filteredSections).length === 0 && (
        <div className="py-4 text-center text-gray-500">
          검색 결과가 없습니다.
        </div>
      )}
    </nav>
  );
}
