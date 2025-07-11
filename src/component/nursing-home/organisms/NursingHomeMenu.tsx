import Link from 'next/link';

export default function NursingHomeMenu() {
  const sections = {
    '수급자관리': [
      { name: '수급자기본정보관리', link: '/nursingHome/memberInfo' },
      { name: '질병별건강관리', link: '/' },
      { name: '약물관리', link: '/' },
      { name: '상담관리', link: '/' },
      { name: '외박관리', link: '/' },
      { name: '건강수준평가', link: '/' },
      { name: '질병별관리기록', link: '/' },
      { name: '배설관리기록', link: '/' },
      { name: '욕창관리기록', link: '/' },
      { name: '서비스제공기록지', link: '/' },
      { name: '체위변경기록', link: '/' },
      { name: '하루보호상황사관리', link: '/' },
      { name: '수급자재정관리기록', link: '/' },
      { name: '수급자현황', link: '/' },
      { name: '수급자확인정보', link: '/' },
      { name: '물리치료표준시간등록', link: '/' },
      { name: '보조메뉴', link: '/' },
    ],
    '수급자서비스관리': [
      { name: '서비스실적 등록', link: '/' },
      { name: '물리치료실적 등록', link: '/' },
      { name: '물리치료기록지 등록', link: '/' },
      { name: '진료기록지', link: '/' },
      { name: '월 실적 조회', link: '/' },
      { name: '월 수급자서비스현황 조회', link: '/' },
      { name: '월 수급자종합실적 조회', link: '/' },
    ],
    '수급자급여관리': [
      { name: '급여산정자료관리', link: '/' },
      { name: '급여비용청구관리', link: '/' },
      { name: '급여비용세부명세작성', link: '/' },
    ],
    '수급자급여기준정보': [
      { name: '수급자급여Table', link: '/' },
      { name: '근무시간표', link: '/' },
    ],
    '사원관리': [
      { name: '사원 기본정보관리', link: '/' },
      { name: '사원 근태현황', link: '/' },
      { name: '사원 년차관리', link: '/' },
    ],
    '센터 업무관리': [
      { name: '장기요양제공내역 관리', link: '/' },
      { name: '월 장기요양제공 내역', link: '/' },
      { name: '월 간호내역&욕구관리', link: '/' },
    ],
    '프로그램관리': [
      { name: '프로그램일지', link: '/' },
      { name: '프로그램계획서', link: '/' },
      { name: '월 프로그램 수혜계획', link: '/' },
      { name: '월 프로그램 계획/평가', link: '/' },
    ],
    '고객지원': [
      { name: '공지사항조회', link: '/' },
      { name: '시사토론자료', link: '/' },
      { name: 'Q&A', link: '/' },
      { name: '보호자정보 찾기', link: '/' },
    ],
    '장기요양요구도조사': [
      { name: '욕구사정기록지', link: '/' },
      { name: '욕창위험도측정', link: '/' },
      { name: '낙상위험측정(Huhn)', link: '/' },
      { name: '인지상태평가', link: '/' },
    ],
    '자금입출금관리': [
      { name: '입출금전표등록', link: '/' },
      { name: '입/출금장조회', link: '/' },
      { name: '원장조회(계정과목별)', link: '/' },
      { name: '수급자별입/출금내역조회', link: '/' },
      { name: '종별분석보고서', link: '/' },
      { name: '계정별분석서', link: '/' },
    ],
    '센터 업무일지': [
      { name: '센터 업무일지 관리', link: '/' },
    ],
    '회의&사례관리': [
      { name: '회의록관리', link: '/' },
      { name: '사례관리일지', link: '/' },
      { name: '직원간담회', link: '/' },
      { name: '직원직무교육', link: '/' },
    ],
    '제개센터관리': [
      { name: '사용자제정보관리', link: '/' },
      { name: '사원/프로그램매핑', link: '/' },
      { name: '사원/수급자 매핑', link: '/' },
      { name: '공지사항 등록', link: '/' },
      { name: '시사토론자료 등록', link: '/' },
      { name: '홍보메체 샘플 등록', link: '/' },
      { name: '센터(직원)일과표 관리', link: '/' },
    ],
    '문자메세지관리': [
      { name: '문자메세지작성및전송', link: '/' },
      { name: '표준메세지작성관리', link: '/' },
      { name: '쿠폰등록요청이력조회', link: '/' },
    ],
    '센터봉사자관리': [
      { name: '단체 봉사실적등록', link: '/' },
      { name: '개인 봉사실적등록', link: '/' },
    ],
    '시설장결재': [
      { name: '센터별재작업', link: '/' },
    ],
  };

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Object.entries(sections).map(([title, items]) => (
        <div key={title}>
          <h2 className="mb-2 text-lg font-semibold text-blue-700 dark:text-blue-400">
            {title}
          </h2>
          <ul className="space-y-1 text-sm text-gray-800 list-disc list-inside dark:text-white">
            {items.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.link}
                  className="hover:underline hover:text-blue-500 dark:hover:text-blue-300"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
