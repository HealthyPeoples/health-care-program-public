"use client";

import React, { useState } from 'react';
import Link from 'next/link';

const sections = {
  '수급자관리': [
    { name: '수급자기본정보관리', link: '/nursingHome/memberInfo' },
    { name: '질병별건강관리', link: '/nursingHome' },
    { name: '약물관리', link: '/nursingHome' },
    { name: '상담관리', link: '/nursingHome' },
    { name: '외박관리', link: '/nursingHome' },
    { name: '건강수준평가', link: '/nursingHome' },
    { name: '질병별관리기록', link: '/nursingHome' },
    { name: '배설관리기록', link: '/nursingHome' },
    { name: '욕창관리기록', link: '/nursingHome' },
    { name: '서비스제공기록지', link: '/nursingHome' },
    { name: '체위변경기록', link: '/nursingHome' },
    { name: '하루보호상황사관리', link: '/nursingHome' },
    { name: '수급자재정관리기록', link: '/nursingHome' },
    { name: '수급자현황', link: '/nursingHome' },
    { name: '수급자확인정보', link: '/nursingHome' },
    { name: '물리치료표준시간등록', link: '/nursingHome' },
    { name: '보조메뉴', link: '/nursingHome' },
  ],
  '수급자서비스관리': [
    { name: '서비스실적 등록', link: '/nursingHome' },
    { name: '물리치료실적 등록', link: '/nursingHome' },
    { name: '물리치료기록지 등록', link: '/nursingHome' },
    { name: '진료기록지', link: '/nursingHome' },
    { name: '월 실적 조회', link: '/nursingHome' },
    { name: '월 수급자서비스현황 조회', link: '/nursingHome' },
    { name: '월 수급자종합실적 조회', link: '/nursingHome' },
  ],
  '수급자급여관리': [
    { name: '급여산정자료관리', link: '/nursingHome' },
    { name: '급여비용청구관리', link: '/nursingHome' },
    { name: '급여비용세부명세작성', link: '/nursingHome' },
  ],
  '수급자급여기준정보': [
    { name: '수급자급여Table', link: '/nursingHome' },
    { name: '근무시간표', link: '/nursingHome' },
  ],
  '사원관리': [
    { name: '사원 기본정보관리', link: '/nursingHome' },
    { name: '사원 근태현황', link: '/nursingHome' },
    { name: '사원 년차관리', link: '/nursingHome' },
  ],
  '센터 업무관리': [
    { name: '장기요양제공내역 관리', link: '/nursingHome' },
    { name: '월 장기요양제공 내역', link: '/nursingHome' },
    { name: '월 간호내역&욕구관리', link: '/nursingHome' },
  ],
  '프로그램관리': [
    { name: '프로그램일지', link: '/nursingHome' },
    { name: '프로그램계획서', link: '/nursingHome' },
    { name: '월 프로그램 수혜계획', link: '/nursingHome' },
    { name: '월 프로그램 계획/평가', link: '/nursingHome' },
  ],
  '고객지원': [
    { name: '공지사항조회', link: '/nursingHome' },
    { name: '시사토론자료', link: '/nursingHome' },
    { name: 'Q&A', link: '/nursingHome' },
    { name: '보호자정보 찾기', link: '/nursingHome' },
  ],
  '장기요양요구도조사': [
    { name: '욕구사정기록지', link: '/nursingHome' },
    { name: '욕창위험도측정', link: '/nursingHome' },
    { name: '낙상위험측정(Huhn)', link: '/nursingHome' },
    { name: '인지상태평가', link: '/nursingHome' },
  ],
  '자금입출금관리': [
    { name: '입출금전표등록', link: '/nursingHome' },
    { name: '입/출금장조회', link: '/nursingHome' },
    { name: '원장조회(계정과목별)', link: '/nursingHome' },
    { name: '수급자별입/출금내역조회', link: '/nursingHome' },
    { name: '종별분석보고서', link: '/nursingHome' },
    { name: '계정별분석서', link: '/nursingHome' },
  ],
  '센터 업무일지': [
    { name: '센터 업무일지 관리', link: '/nursingHome' },
  ],
  '회의&사례관리': [
    { name: '회의록관리', link: '/nursingHome' },
    { name: '사례관리일지', link: '/nursingHome' },
    { name: '직원간담회', link: '/nursingHome' },
    { name: '직원직무교육', link: '/nursingHome' },
  ],
  '제개센터관리': [
    { name: '사용자제정보관리', link: '/nursingHome' },
    { name: '사원/프로그램매핑', link: '/nursingHome' },
    { name: '사원/수급자 매핑', link: '/nursingHome' },
    { name: '공지사항 등록', link: '/nursingHome' },
    { name: '시사토론자료 등록', link: '/nursingHome' },
    { name: '홍보메체 샘플 등록', link: '/nursingHome' },
    { name: '센터(직원)일과표 관리', link: '/nursingHome' },
  ],
  '문자메세지관리': [
    { name: '문자메세지작성및전송', link: '/nursingHome' },
    { name: '표준메세지작성관리', link: '/nursingHome' },
    { name: '쿠폰등록요청이력조회', link: '/nursingHome' },
  ],
  '센터봉사자관리': [
    { name: '단체 봉사실적등록', link: '/nursingHome' },
    { name: '개인 봉사실적등록', link: '/nursingHome' },
  ],
  '시설장결재': [
    { name: '센터별재작업', link: '/nursingHome' },
  ],
};

export default function NursingHomeMenu() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const handleToggle = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <nav className="w-64 min-h-screen bg-white border-r border-gray-200 p-4">
      <ul>
        {Object.entries(sections).map(([title, items]) => (
          <li key={title} className="mb-2">
            <button
              className="flex items-center w-full px-3 py-2 text-left font-semibold text-blue-700 hover:bg-blue-50 rounded transition"
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
              <ul className="mt-1 ml-4 border-l border-blue-100 pl-2">
                {items.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.link}
                      className="block px-2 py-1 text-gray-700 hover:text-blue-500 hover:bg-blue-50 rounded"
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
    </nav>
  );
}
