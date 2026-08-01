/**
 * @file 유지보수 스크립트 — add-file-jsdoc
 *
 * @description
 * src 파일에 @file JSDoc 일괄 삽입
 *
 * @module scripts/add-file-jsdoc
 */
/**
 * src 하위 .ts/.tsx/.js/.jsx에 @file JSDoc이 없으면 경로 기반으로 삽입합니다.
 * 이미 @file이 있으면 건너뜁니다. 치명 버그/로직은 수정하지 않습니다.
 *
 * 사용: node scripts/add-file-jsdoc.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/** kebab-case 기능 폴더 → 한글 설명 */
const FEATURE_KO = {
  'annual-schedule': '연간일정',
  'bath-service': '목욕서비스',
  'bedsore-management': '욕창관리',
  'bedsore-risk-measurement': '욕창위험도측정',
  'beneficiary-status-inquiry': '수급자현황조회',
  'case-management': '사례관리',
  'cognitive-assessment-record': '인지기능평가기록',
  'connection-record': '연계기록',
  'connection-record copy': '연계기록(복사본)',
  'counseling-record': '상담기록',
  'daily-beneficiary-performance': '일 수급자급여실적',
  'daily-longterm-care': '일 장기요양급여제공기록',
  'data-room': '자료실',
  'disease-history': '질병력',
  'emergency-record': '응급기록',
  'employee-annual-leave': '직원연차',
  'employee-attendance': '직원근태',
  'employee-attendance-monthly': '직원근태(월간)',
  'employee-basic-info': '직원기본정보',
  'employee-beneficiary-mapping': '직원-수급자 매핑',
  'employee-job-training': '직원직무교육',
  'employee-meeting-minutes': '직원회의록',
  'employee-program-mapping': '직원-프로그램 매핑',
  'entrusted-medical': '위탁진료',
  'evaluation-checklist': '평가지침/체크리스트',
  'excretion-observation': '배설관찰',
  'facility-basic-info': '시설기본정보',
  'facility-daily-schedule': '시설일일일정',
  'facility-user-management': '시설사용자관리',
  'facility-work-log': '시설업무일지',
  'facility-work-log-approval': '시설업무일지 결재',
  'fact-verification': '사실확인서',
  'fall-risk-measurement': '낙상위험도측정',
  'grade-salary-table': '등급별급여표',
  'group-volunteer-performance': '단체자원봉사실적',
  'guardian-info': '보호자정보',
  'guardian-meeting': '보호자회의',
  'health-examination': '건강검진',
  'individual-volunteer-performance': '개인자원봉사실적',
  'indwelling-catheter': '유치도뇨',
  'intensive-excretion-observation': '집중배설관찰',
  'longterm-beneficiary-status': '장기요양수급자현황',
  'longterm-care-registration': '장기요양급여제공계획',
  'longterm-functional-cognitive': '장기요양 기능·인지',
  'longterm-nursing-instruction': '장기요양 간호지시',
  'longterm-physical-activity': '장기요양 신체활동',
  'longterm-record-format': '장기요양기록양식',
  'medication-performance': '투약실적',
  'medication-registration': '투약등록',
  'medication-time': '투약시간',
  'member-contract-info': '수급자계약정보',
  'member-info': '수급자정보',
  'monthly-longterm-summary': '월 장기요양 요약',
  'monthly-program-plan': '월 프로그램계획',
  'monthly-salary-collection': '월 급여수납',
  'monthly-salary-data': '월 급여자료',
  'monthly-salary-statement': '월 급여명세서',
  'needs-assessment-record': '욕구사정기록',
  'notice-inquiry': '공지조회',
  'notice-registration': '공지등록',
  'nursing-service': '간호서비스',
  'outing-info': '외출·외박대장',
  'outpatient-record': '외래진료기록',
  'physical-therapy-performance': '물리치료실적',
  'physical-therapy-performance-evaluation': '물리치료실적평가',
  'physical-therapy-plan-evaluation': '물리치료계획평가',
  'physical-therapy-standard-time': '물리치료기준시간',
  'position-change-record': '체위변경기록',
  'program-daily-log': '프로그램일지',
  'program-evaluation': '프로그램평가',
  'program-feedback': '프로그램피드백',
  'program-plan-registration': '프로그램계획등록',
  'snack-bulk-registration': '간식일괄등록',
  'status-change-observation': '상태변화관찰',
  'UDC-page': 'UDC 페이지',
  'user-code-registration': '사용자코드등록',
  'vital-signs': '활력징후',
  'vital-signs-periodic': '활력징후(정기)',
  'work-schedule': '근무표',
};

/** API 폴더 → 한글 설명 */
const API_KO = {
  'annual-schedule': '연간일정 API',
  auth: '인증(세션 확인·연장·사용자정보)',
  'data-room': '자료실 API',
  dbtest: 'DB 연결 테스트(개발용)',
  'evaluation-checklists': '평가 체크리스트 API',
  f00110: '시설(기관) 기본정보 F00110',
  f00120: '시설 사용자 F00120',
  f00130: '시설 코드/설정 F00130',
  f00131: '시설 코드 상세 F00131',
  f00132: '시설 코드 상세 F00132',
  f01001: '공지 F01001',
  f01002: '공지/게시 F01002',
  f01010: '자료실·첨부 F01010',
  f02010: '사용자코드 F02010',
  f10010: '수급자 기본정보 F10010',
  'f10010-columns': '수급자 컬럼 메타',
  f10020: '보호자정보 F10020',
  f11010: '직원 기본정보 F11010',
  f11020: '직원 관련 F11020',
  f11040: '직원 매핑/배정 F11040',
  f11060: '직원 근태 F11060',
  f11061: '직원 근태(월) F11061',
  f11070: '직원 연차 F11070',
  f11080: '직원 교육/회의 F11080',
  f14020: '일 수급자급여실적·장기요양기록 F14020',
  f14030: '일지/케어 관련 F14030',
  f14040: '프로그램 관련 F14040',
  'f14041-program-feedback': '프로그램 피드백 F14041',
  f14050: '프로그램/일정 F14050',
  f14070: '자원봉사 실적 F14070',
  f14090: '시설업무일지 F14090',
  f14091: '시설업무일지 결재 F14091',
  f14110: '외출·외박 등 F14110',
  f20020: '욕구사정/평가 F20020',
  f20110: '인지·기능평가 F20110',
  f20130: '평가 관련 F20130',
  f30030: '급여/수가 F30030',
  f30110: '투약등록 F30110',
  f30111: '투약시간 F30111',
  f30112: '투약실적 F30112',
  f30120: '투약 관련 F30120',
  f30130: '투약 관련 F30130',
  f32010: '활력징후 F32010',
  f32020: '활력징후(정기) F32020',
  f32090: '건강/간호 관련 F32090',
  f33010: '욕창/낙상 등 F33010',
  f33020: '욕창위험도 F33020',
  f33021: '욕창관리 F33021',
  f33030: '낙상위험도 F33030',
  f33040: '배설관찰 F33040',
  f33050: '간호/관찰 기록 F33050',
  f40010: '물리치료 기준 F40010',
  f40100: '월 급여계산 F40100',
  f40110: '월 급여수납 F40110',
  f40120: '월 급여명세서 F40120',
  f51010: '상담기록 F51010',
  f51012: '연계/사례 F51012',
  f51013: '응급기록 F51013',
  f51014: '외래진료 F51014',
  f51015: '인지평가 F51015',
  f51130: '회의/보호자 F51130',
  f60010: '근무표 F60010',
  f60020: '시설일정 F60020',
  f60030: '연간일정 F60030',
  f60031: '연간일정 상세 F60031',
  f60040: '일정/스케줄 F60040',
  f60060: '프로그램계획 F60060',
  f71030: '질병력 F71030',
  f71031: '건강검진 F71031',
  f71040: '위탁진료 F71040',
  f71041: '유치도뇨 등 F71041',
  f90030: '등급별급여표 F90030',
  'f90030-columns': '등급별급여표 컬럼 메타',
  'forgot-password': '비밀번호 찾기',
  login: '로그인',
  logout: '로그아웃',
  'medication-print': '투약 인쇄 데이터',
  'outing-info': '외출·외박대장 OUTING_INFO',
  'program-daily-log': '프로그램일지',
  tables: '테이블 목록/스키마 조회(개발용)',
  'user-code-list': '사용자코드 목록',
  v10010a: '수급자 조회 뷰 V10010A',
  v10010b: '수급자 조회 뷰 V10010B',
  v10010c: '수급자 조회 뷰 V10010C',
  v11010b: '직원 조회 뷰 V11010B',
  v11010c: '직원 조회 뷰 V11010C',
  v11070a: '연차 조회 뷰 V11070A',
  v30030r: '급여 조회 뷰 V30030R',
  v40100: '월급여 조회 뷰 V40100',
  v40100d: '월급여 상세 뷰 V40100D',
  v40100e: '월급여 상세 뷰 V40100E',
  v40100g: '월급여 상세 뷰 V40100G',
  'work-schedule': '근무표 API',
};

const EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(ent.name))) out.push(full);
  }
  return out;
}

function relPosix(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function featureLabel(slug) {
  return FEATURE_KO[slug] || slug.replace(/-/g, ' ');
}

function detectRole(rel) {
  const parts = rel.split('/');
  // src/app/api/...
  if (parts[0] === 'src' && parts[1] === 'app' && parts[2] === 'api') {
    const apiName = parts[3];
    const leaf = parts[parts.length - 1];
    const apiLabel = API_KO[apiName] || `${apiName} API`;
    if (leaf === 'route.js' || leaf === 'route.ts') {
      return {
        title: `API /api/${parts.slice(3, -1).join('/')} — ${apiLabel}`,
        description: `${apiLabel} Next.js Route Handler. 세션 ANCD 게이트·MSSQL 직접 접근 패턴을 따릅니다.`,
      };
    }
    return {
      title: `${apiLabel} 보조 모듈 (${leaf})`,
      description: `/api/${apiName} 관련 헬퍼·서브라우트입니다.`,
    };
  }

  // src/app/nursingHome/<feature>/page.tsx
  if (parts[0] === 'src' && parts[1] === 'app') {
    const area = parts[2]; // nursingHome, login, ...
    if (parts[parts.length - 1].startsWith('page.')) {
      const feature = parts[3];
      if (area === 'nursingHome' && feature) {
        const label = featureLabel(feature);
        return {
          title: `App Router 페이지 — ${label}`,
          description: `/nursingHome/${feature} thin wrapper. 실제 UI는 component/nursing-home/pages/${feature} 를 렌더합니다.`,
        };
      }
      return {
        title: `App Router 페이지 — ${parts.slice(2, -1).join('/') || 'root'}`,
        description: `경로 /${parts.slice(2, -1).join('/')} 의 page 엔트리입니다.`,
      };
    }
    if (parts[parts.length - 1].startsWith('layout.')) {
      return {
        title: `App Router 레이아웃 — ${parts.slice(2, -1).join('/') || 'root'}`,
        description: '해당 세그먼트의 공통 레이아웃(탭 셸·네비 등)을 정의합니다.',
      };
    }
    if (parts[parts.length - 1] === 'error.tsx') {
      return {
        title: 'App Router 에러 바운더리',
        description: '세그먼트 렌더 오류 시 표시하는 error.tsx입니다.',
      };
    }
    if (parts[parts.length - 1] === 'loading.tsx') {
      return {
        title: 'App Router 로딩 UI',
        description: '세그먼트 로딩 중 표시하는 loading.tsx입니다.',
      };
    }
    if (parts[parts.length - 1] === 'not-found.tsx') {
      return {
        title: 'App Router 404',
        description: '해당 세그먼트 not-found 페이지입니다.',
      };
    }
  }

  // component/nursing-home/pages/<feature>/...
  const pageIdx = parts.indexOf('pages');
  if (parts.includes('nursing-home') && pageIdx >= 0 && parts[pageIdx + 1]) {
    const feature = parts[pageIdx + 1];
    const label = featureLabel(feature);
    const leaf = parts[parts.length - 1];
    const base = leaf.replace(/\.(tsx?|jsx?)$/, '');
    let kind = '모듈';
    if (/^use[A-Z]/.test(base) || base.startsWith('use')) kind = '커스텀 훅';
    else if (/Print|print/.test(base)) kind = '인쇄 헬퍼';
    else if (/Utils|utils|Mapper|mapper|types|Types/.test(base)) kind = '유틸/타입/매퍼';
    else if (/Modal|Dialog|Panel|Grid|Form|View/.test(base)) kind = 'UI 부분 컴포넌트';
    else if (base.replace(/[-_]/g, '').toLowerCase().includes(feature.replace(/-/g, '')))
      kind = '화면 컴포넌트';
    else if (/\.test\./.test(leaf) || leaf.includes('.test.')) kind = '단위 테스트';
    return {
      title: `${label} — ${kind} (${leaf})`,
      description: `요양원 ${label} 기능의 ${kind}입니다. 폴더: component/nursing-home/pages/${feature}`,
    };
  }

  if (parts.includes('nursing-home')) {
    const leaf = parts[parts.length - 1];
    if (leaf === 'NursingHome.tsx') {
      return {
        title: '요양원 앱 셸',
        description: '요양원 영역 루트 컴포넌트(메뉴·탭 호스트 연결)입니다.',
      };
    }
    if (leaf === 'TabHost.tsx') {
      return {
        title: '요양원 탭 호스트',
        description: '다중 탭으로 요양원 화면을 열고 전환합니다.',
      };
    }
    if (parts.includes('hooks')) {
      return {
        title: `요양원 공통 훅 — ${leaf}`,
        description: '요양원 화면에서 공유하는 React 훅입니다.',
      };
    }
    if (parts.includes('organisms') || parts.includes('molecules') || parts.includes('atoms')) {
      return {
        title: `요양원 UI — ${leaf}`,
        description: '요양원 공통 UI(메뉴·패널 등) 컴포넌트입니다.',
      };
    }
    if (parts.includes('utils')) {
      return {
        title: `요양원 유틸 — ${leaf}`,
        description: '요양원 도메인 공통 유틸리티입니다.',
      };
    }
  }

  if (parts[1] === 'config') {
    return {
      title: `서버/앱 설정 — ${parts[parts.length - 1]}`,
      description: 'DB 풀·세션·환경 등 서버 설정 모듈입니다.',
    };
  }
  if (parts[1] === 'lib') {
    return {
      title: `공유 라이브러리 — ${parts[parts.length - 1]}`,
      description: 'API·화면에서 공유하는 도메인 로직 모듈입니다.',
    };
  }
  if (parts[1] === 'utils') {
    return {
      title: `공통 유틸 — ${parts[parts.length - 1]}`,
      description: '날짜·응답·포맷 등 프로젝트 공통 유틸리티입니다.',
    };
  }
  if (parts[1] === 'types') {
    return {
      title: `공통 타입 — ${parts[parts.length - 1]}`,
      description: '프로젝트 전역 TypeScript 타입 정의입니다.',
    };
  }
  if (parts[1] === 'atom') {
    return {
      title: 'Recoil 전역 상태',
      description: 'Recoil atom/selector 정의입니다.',
    };
  }
  if (parts[1] === 'containers') {
    return {
      title: `레이아웃 컨테이너 — ${parts[parts.length - 1]}`,
      description: '페이지를 감싸는 레이아웃 컨테이너 컴포넌트입니다.',
    };
  }
  if (parts[1] === 'data') {
    return {
      title: `정적 데이터 — ${parts[parts.length - 1]}`,
      description: '네비게이션·상수 등 정적 데이터 모듈입니다.',
    };
  }
  if (parts[1] === 'component' && parts[2] === 'main-') {
    return {
      title: `공통 UI — ${parts[parts.length - 1]}`,
      description: '메인/블로그 스타일 공통 UI 컴포넌트입니다.',
    };
  }
  if (parts[1] === 'component' && (parts[2] === 'day-night-care' || parts[2] === 'short-term-care')) {
    return {
      title: `${parts[2]} — ${parts[parts.length - 1]}`,
      description: '주야간/단기보호 영역 컴포넌트입니다.',
    };
  }

  return {
    title: parts[parts.length - 1],
    description: `${rel} 모듈입니다.`,
  };
}

function buildBlock(rel, role) {
  return `/**
 * @file ${role.title}
 *
 * @description
 * ${role.description}
 *
 * @module ${rel.replace(/\.(tsx?|jsx?)$/, '').replace(/^src\//, '')}
 */
`;
}

function insertJsdoc(content, block) {
  if (content.includes('@file')) return null;

  // shebang
  if (content.startsWith('#!')) {
    const nl = content.indexOf('\n');
    return content.slice(0, nl + 1) + '\n' + block + content.slice(nl + 1);
  }

  // "use client" / "use server" must stay first
  const useMatch = content.match(/^(?:'use (?:client|server)'|"use (?:client|server)");?\r?\n/);
  if (useMatch) {
    const rest = content.slice(useMatch[0].length).replace(/^\r?\n*/, '');
    return `${useMatch[0]}\n${block}${rest}`;
  }

  // existing leading block comment without @file — prepend new @file before it
  // or insert at top
  return block + content.replace(/^\uFEFF/, '');
}

function main() {
  const files = walk(SRC);
  let added = 0;
  let skipped = 0;
  const errors = [];

  for (const abs of files) {
    const rel = relPosix(abs);
    try {
      const content = fs.readFileSync(abs, 'utf8');
      if (content.includes('@file')) {
        skipped++;
        continue;
      }
      const role = detectRole(rel);
      const block = buildBlock(rel, role);
      const next = insertJsdoc(content, block);
      if (!next) {
        skipped++;
        continue;
      }
      fs.writeFileSync(abs, next, 'utf8');
      added++;
    } catch (e) {
      errors.push(`${rel}: ${e.message}`);
    }
  }

  console.log(JSON.stringify({ total: files.length, added, skipped, errors }, null, 2));
}

main();
