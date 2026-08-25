/**
 * @file 욕구사정기록 — 유틸/타입/매퍼 (f51012Mapper.ts)
 *
 * @description
 * 요양원 욕구사정기록 기능의 유틸/타입/매퍼입니다. 폴더: component/nursing-home/pages/needs-assessment-record
 *
 * @module component/nursing-home/pages/needs-assessment-record/f51012Mapper
 */
/**
 * F51012(욕구사정기록) 화면 상태 ↔ DB 컬럼 매핑
 */

/** A 완전자립 / B 간접도움 / C 직접도움 / D 완전도움 (구 1·2·3 기호는 hydrate 시 변환) */
export type ActivityLevel = '' | 'A' | 'B' | 'C' | 'D';
export type ActivityAssessment = { key: string; activity: string; value: ActivityLevel };

export const ACTIVITY_LEVELS: { code: ActivityLevel; label: string }[] = [
	{ code: 'A', label: '완전자립' },
	{ code: 'B', label: '간접도움' },
	{ code: 'C', label: '직접도움' },
	{ code: 'D', label: '완전도움' },
];

export const PHYSICAL_ACTIVITY_GROUPS: { group: string; items: { key: string; label: string }[] }[] = [
	{
		group: '위생관리',
		items: [
			{ key: 'C05', label: '세수하기' },
			{ key: 'C09', label: '양치질하기' },
			{ key: 'C06', label: '목욕하기' },
		],
	},
	{
		group: '일상생활',
		items: [
			{ key: 'C01', label: '옷벗고 입기' },
			{ key: 'C02', label: '식사하기' },
			{ key: 'C04', label: '화장실 이용하기' },
			{ key: 'C13', label: '음식삼키기' },
		],
	},
	{
		group: '도구적일상생활',
		items: [
			{ key: 'C14', label: '전화사용' },
			{ key: 'C15', label: '물건사기' },
			{ key: 'C16', label: '식사준비' },
			{ key: 'C17', label: '집안일' },
			{ key: 'C18', label: '교통수단이용' },
			{ key: 'C19', label: '금전관리' },
		],
	},
];

export const PHYSICAL_ACTIVITY_ITEMS: { key: string; label: string }[] = PHYSICAL_ACTIVITY_GROUPS.flatMap((g) => g.items);

const UNUSED_C_KEYS = ['C03', 'C07', 'C08', 'C10', 'C11', 'C12'] as const;

export function createEmptyActivities(): ActivityAssessment[] {
	return PHYSICAL_ACTIVITY_ITEMS.map((it) => ({ key: it.key, activity: it.label, value: '' }));
}

function getRowVal(row: Record<string, unknown>, key: string): unknown {
	if (row[key] != null && row[key] !== '') return row[key];
	const upper = key.toUpperCase();
	const lower = key.toLowerCase();
	if (row[upper] != null && row[upper] !== '') return row[upper];
	if (row[lower] != null && row[lower] !== '') return row[lower];
	const found = Object.keys(row).find((k) => k.toUpperCase() === upper);
	return found != null ? row[found] : undefined;
}

function coerceScalar(v: unknown): string {
	if (v == null) return '';
	if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
	if (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) return v.toString('utf8').trim();
	// mssql CHAR 패딩 / 공백 제거
	return String(v).replace(/\u0000/g, '').trim();
}

function activityToDb(v: ActivityLevel | string): string | null {
	if (v === 'A' || v === 'B' || v === 'C' || v === 'D') return v;
	return null;
}

/** 구코드 1=완전도움 2=부분도움 3=완전자립 · 기호 X/△/○ → A~D */
function dbToActivity(c: unknown): ActivityLevel {
	const s = coerceScalar(c);
	if (!s) return '';
	if (s === 'A' || s === 'B' || s === 'C' || s === 'D') return s;
	if (s === '4' || s === '○' || s === 'O' || s === 'o' || s === '●' || s === '◯') return 'A';
	if (s === '3') return 'A';
	if (s === '△' || s === '^') return 'B';
	if (s === '2') return 'B';
	if (s === '▲') return 'C';
	if (s === 'X' || s === 'x' || s === '×' || s === '✕' || s === '1' || s === 'Ⅹ') return 'D';
	return '';
}

function yn(b: boolean): string {
	return b ? 'Y' : 'N';
}

function parseYn(v: unknown): boolean {
	return String(v ?? '').trim().toUpperCase() === 'Y';
}

/** 질병1 UI 키 순서 → DB 컬럼 */
const DISEASE1_COLS: string[] = [
	'D01_01',
	'D01_02',
	'D01_03',
	'D01_04',
	'D01_05',
	'D01_06',
	'D01_07',
	'D01_08',
	'D02_01',
	'D02_02',
	'D02_03',
	'D02_04',
	'D02_05',
	'D02_06',
	'D03_01',
	'D03_02',
	'D03_03',
	'D03_04',
	'D03_05',
	'D03_06',
	'D04_01',
	'D04_02',
	'D04_03',
	'D04_04',
	'D04_05',
	'D05_01',
	'D05_02',
	'D05_03',
	'D05_04',
	'D05_05',
	'D05_06',
	'D06_01',
	'D06_02',
	'D06_03',
	'D06_04',
	'D07_01',
	'D07_02',
	'D07_03',
	'D07_04',
	'D08_01',
	'D08_02',
	'D08_03',
	'D08_04',
	'D08_05',
];

const DISEASE1_UI_KEYS: string[] = [
	'내분.대사-당뇨',
	'내분.대사-갑상선질환',
	'내분.대사-탈수',
	'내분.대사-영양상태이상',
	'내분.대사-만성간염',
	'내분.대사-자기면역질환',
	'내분.대사-빈혈',
	'내분.대사-기타',
	'소화기계-위염',
	'소화기계-위궤양',
	'소화기계-십이지궤양',
	'소화기계-변비',
	'소화기계-간경변증',
	'소화기계-기타',
	'순환기계-고혈압',
	'순환기계-저혈압',
	'순환기계-협심증',
	'순환기계-심근경색증',
	'순환기계-뇌혈관질환',
	'순환기계-기타',
	'근골격계-관절염',
	'근골격계-요통,좌골통',
	'근골격계-기타 척추질환',
	'근골격계-골다공증',
	'근골격계-기타',
	'신경계-치매',
	'신경계-뇌경색',
	'신경계-파킨슨병',
	'신경계-두통',
	'신경계-두통외 통증',
	'신경계-기타',
	'정신.행동-신경증',
	'정신.행동-우울증',
	'정신.행동-수면장애',
	'정신.행동-기타',
	'호흡기계-폐결핵',
	'호흡기계-만성기관지염',
	'호흡기계-호흡곤란',
	'호흡기계-기타',
	'눈.귀질환-백내장',
	'눈.귀질환-녹내장',
	'눈.귀질환-난청',
	'눈.귀질환-만성중이염',
	'눈.귀질환-이명',
];

const DISEASE2_COLS = ['D09_01', 'D09_02', 'D09_03', 'D09_04', 'D10_01', 'D10_02', 'D11_01', 'D11_02', 'D11_03'] as const;
const DISEASE2_UI_KEYS = [
	'비뇨.생식-전립선비대',
	'비뇨.생식-요실금',
	'비뇨.생식-만성방광염',
	'비뇨.생식-기타',
	'만성신장-만성신부전증',
	'만성신장-기타',
	'기타질환-암',
	'기타질환-알레르기',
	'기타질환-기타',
] as const;

export const DISEASE1_CATEGORIES: { category: string; diseases: string[] }[] = [
	{ category: '내분.대사', diseases: ['당뇨', '갑상선질환', '탈수', '영양상태이상', '만성간염', '자기면역질환', '빈혈', '기타'] },
	{ category: '소화기계', diseases: ['위염', '위궤양', '십이지궤양', '변비', '간경변증', '기타'] },
	{ category: '순환기계', diseases: ['고혈압', '저혈압', '협심증', '심근경색증', '뇌혈관질환', '기타'] },
	{ category: '근골격계', diseases: ['관절염', '요통,좌골통', '기타 척추질환', '골다공증', '기타'] },
	{ category: '신경계', diseases: ['치매', '뇌경색', '파킨슨병', '두통', '두통외 통증', '기타'] },
	{ category: '정신.행동', diseases: ['신경증', '우울증', '수면장애', '기타'] },
	{ category: '호흡기계', diseases: ['폐결핵', '만성기관지염', '호흡곤란', '기타'] },
	{ category: '눈.귀질환', diseases: ['백내장', '녹내장', '난청', '만성중이염', '이명'] },
];

export const DISEASE2_CATEGORIES: { category: string; diseases: string[] }[] = [
	{ category: '비뇨.생식', diseases: ['전립선비대', '요실금', '만성방광염', '기타'] },
	{ category: '만성신장', diseases: ['만성신부전증', '기타'] },
	{ category: '기타질환', diseases: ['암', '알레르기', '기타'] },
];

const REHAB_UI_TO_COL: Record<string, string> = {
	우측상지: 'E01',
	좌측상지: 'E02',
	우측하지: 'E03',
	좌측하지: 'E04',
	'어깨관절(우)': 'E05_01',
	'어깨관절(좌)': 'E05_02',
	'팔꿈치관절(우)': 'E06_01',
	'팔꿈치관절(좌)': 'E06_02',
	'손목 및 수지관절(우)': 'E07_01',
	'손목 및 수지관절(좌)': 'E07_02',
	'고관절(우)': 'E08_01',
	'고관절(좌)': 'E08_02',
	'무릎관절(우)': 'E09_01',
	'무릎관절(좌)': 'E09_02',
	'발목관절(우)': 'E10_01',
	'발목관절(좌)': 'E10_02',
};

export const NURSING_GROUPS: { group: string; items: string[] }[] = [
	{ group: '호흡기', items: ['기관지 절개관 간호', '흡인', '산소요법'] },
	{ group: '피부·상처', items: ['욕창간호', '상처간호', '당뇨발간호'] },
	{ group: '영양', items: ['경관영양', '위루간호', '정맥영양'] },
	{ group: '배설', items: ['도뇨관리', '유치도뇨', '단순도뇨', '방광루', '장루간호', '투석간호'] },
	{ group: '통증', items: ['통증간호'] },
	{ group: '기타 간호관리', items: ['혈압측정', '혈당측정', '주사', '투약관리', '암관리', '호스피스'] },
];

const NURSING_UI_TO_COL: Record<string, string> = {
	'기관지 절개관 간호': 'F01',
	흡인: 'F02',
	산소요법: 'F03',
	욕창간호: 'F04',
	경관영양: 'F05',
	통증간호: 'F06',
	장루간호: 'F07',
	도뇨관리: 'F08',
	투석간호: 'F09',
	당뇨발간호: 'F10',
	상처간호: 'F11',
	위루간호: 'F12',
	정맥영양: 'F13',
	유치도뇨: 'F14',
	단순도뇨: 'F15',
	방광루: 'F16',
	혈압측정: 'F17',
	혈당측정: 'F18',
	주사: 'F19',
	투약관리: 'F20',
	암관리: 'F21',
	호스피스: 'F22',
};

export const COG_GROUPS: { group: string; labels: readonly string[] }[] = [
	{ group: '인지기능', labels: ['지남력', '기억력', '주의집중 및 계산', '언어적기능', '판단력'] },
	{
		group: '행동증상',
		labels: ['편집증과 망상', '환각', '배회', '반복적인 활동', '부적절한 행동', '언어폭팔', '신체적 공격 또는 폭력행위'],
	},
	{ group: '심리 증상', labels: ['우울', '일반적인 불안', '혼자 남겨짐에 대한 공포'] },
];

const COG_LABELS = COG_GROUPS.flatMap((g) => g.labels);

/** 의사소통 H01 청취능력 */
export const H01_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '들리는지 판단불능' },
	{ code: '2', label: '거의 들리지 않는다' },
	{ code: '3', label: '큰 소리는 들을 수 있다' },
	{ code: '4', label: '보통의 소리를 듣기는 하고, 못 듣기도 한다' },
	{ code: '5', label: '정상(보청기사용포함)' },
];

/** 의사소통 H02 */
export const H02_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '모두 이해하고 의사를 표현한다' },
	{ code: '2', label: '대부분 이해하고 의사를 표현한다' },
	{ code: '3', label: '가끔 이해하고 의사를 표현한다' },
	{ code: '4', label: '거의 이해하지 못하고 의사를 전달하지 못한다' },
];

/** 의사소통 H03 발음능력 */
export const H03_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '정확하게 발음이 가능하다' },
	{ code: '2', label: '응얼거리는 소리로만 한다' },
	{ code: '3', label: '간혹 어눌한 발음이 섞인다' },
	{ code: '4', label: '전혀 발음하지 못한다' },
];

/** 의사소통 H04 시력상태 */
export const H04_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '정상(안경사용포함)' },
	{ code: '2', label: '조금 보인다' },
	{ code: '3', label: '거의 보이지 않는다' },
	{ code: '4', label: '보이지 않는다' },
	{ code: '5', label: '판단불능' },
];

const H1_LABEL_TO_CODE: Record<string, string> = Object.fromEntries([
	...H01_OPTIONS.map((o) => [o.label, o.code] as const),
	// 구 UI 라벨 호환
	['정상적으로 들린다', '5'],
	['거의 들리지 않는다', '2'],
	['보통의 소리를 듣기는 하고, 못 듣기도 한다', '4'],
]);
const H1_CODE_TO_LABEL: Record<string, string> = Object.fromEntries(H01_OPTIONS.map((o) => [o.code, o.label]));

const H2_LABEL_TO_CODE: Record<string, string> = Object.fromEntries([
	...H02_OPTIONS.map((o) => [o.label, o.code] as const),
	['정상적으로 의사소통한다', '1'],
	['가끔 이해하고 의사를 표현한다', '3'],
	['의사소통이 어렵다', '4'],
]);
const H2_CODE_TO_LABEL: Record<string, string> = Object.fromEntries(H02_OPTIONS.map((o) => [o.code, o.label]));

const H3_LABEL_TO_CODE: Record<string, string> = Object.fromEntries([
	...H03_OPTIONS.map((o) => [o.label, o.code] as const),
	['정상적인 발음', '1'],
	['간혹 어눌한 발음이 섞인다', '3'],
	['발음이 매우 어눌하다', '2'],
]);
const H3_CODE_TO_LABEL: Record<string, string> = Object.fromEntries(H03_OPTIONS.map((o) => [o.code, o.label]));

function normalizeHCode(raw: string, max: number, labelToCode: Record<string, string>): string {
	const s = String(raw ?? '').trim();
	if (!s) return '';
	if (/^\d+$/.test(s)) {
		const n = parseInt(s, 10);
		if (n >= 1 && n <= max) return String(n);
	}
	return labelToCode[s] || '';
}

/** 구강과 영양 I01 치아상태 */
export const I01_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '양호' },
	{ code: '2', label: '의치착용(부분)' },
	{ code: '3', label: '의치착용(완전)' },
	{ code: '4', label: '잔존치아없음' },
];

/** 영양 I02 식사시문제점 */
export const I02_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '식욕저하' },
	{ code: '2', label: '저작곤란' },
	{ code: '3', label: '연하곤란' },
	{ code: '4', label: '소화불량' },
	{ code: '5', label: '구토' },
	{ code: '6', label: '없음' },
];

/** 영양 I03 식사형태 */
export const I03_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '미음' },
	{ code: '2', label: '죽' },
	{ code: '3', label: '일반식' },
	{ code: '4', label: '당뇨식' },
	{ code: '5', label: '경관식' },
];

/** 영양 I04 도구사용 */
export const I04_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '숟가락' },
	{ code: '2', label: '젓가락' },
	{ code: '3', label: '포크숟가락' },
	{ code: '4', label: '사용불가' },
];

/** 영양 I05 배설양상 */
export const I05_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '정상' },
	{ code: '2', label: '설사' },
	{ code: '3', label: '변비' },
	{ code: '4', label: '복부팽만' },
];

const I1_LABEL_TO_CODE: Record<string, string> = Object.fromEntries([
	...I01_OPTIONS.map((o) => [o.label, o.code] as const),
	['보통', '1'],
	['불량', '2'],
	['의치', '3'],
	['의치착용', '3'],
]);
const I2_LABEL_TO_CODE: Record<string, string> = Object.fromEntries([
	...I02_OPTIONS.map((o) => [o.label, o.code] as const),
	['삼킴곤란', '3'],
]);
const I3_LABEL_TO_CODE: Record<string, string> = Object.fromEntries([
	...I03_OPTIONS.map((o) => [o.label, o.code] as const),
	['경관영양', '5'],
	['연식', '2'],
	['유동식', '2'],
]);
const I4_LABEL_TO_CODE: Record<string, string> = Object.fromEntries([
	...I04_OPTIONS.map((o) => [o.label, o.code] as const),
	['손', '4'],
	['도움', '4'],
]);
const I5_LABEL_TO_CODE: Record<string, string> = Object.fromEntries([
	...I05_OPTIONS.map((o) => [o.label, o.code] as const),
	['실금', '1'],
]);

/** 구강건강 I06 */
export const I06_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '양호' },
	{ code: '2', label: '구취/위생불량' },
	{ code: '3', label: '잇몸출혈/통증' },
	{ code: '4', label: '구강건조' },
	{ code: '5', label: '기타' },
];

/** 치료식 I07 */
export const I07_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '해당없음' },
	{ code: '2', label: '당뇨식' },
	{ code: '3', label: '저염식' },
	{ code: '4', label: '기타' },
];

/** 영양상태 I08 */
export const I08_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '양호' },
	{ code: '2', label: '식욕부진' },
	{ code: '3', label: '체중감소' },
	{ code: '4', label: '체중과다' },
	{ code: '5', label: '기타' },
];

/** 배뇨기능 C20 */
export const C20_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '정상' },
	{ code: '2', label: '요실금' },
	{ code: '3', label: '배뇨곤란' },
	{ code: '4', label: '기타' },
];

/** 배변기능 C21 */
export const C21_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '정상' },
	{ code: '2', label: '변비' },
	{ code: '3', label: '설사' },
	{ code: '4', label: '실변' },
	{ code: '5', label: '기타' },
];

/** 배뇨방법 C22 */
export const C22_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '화장실' },
	{ code: '2', label: '이동식변기' },
	{ code: '3', label: '기저귀' },
	{ code: '4', label: '유치도뇨' },
	{ code: '5', label: '기타' },
];

/** 배변방법 C23 */
export const C23_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '화장실' },
	{ code: '2', label: '이동식변기' },
	{ code: '3', label: '기저귀' },
	{ code: '4', label: '장루' },
	{ code: '5', label: '기타' },
];

export const E13_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '유' },
	{ code: '2', label: '무' },
];

export const E14_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '없음' },
	{ code: '2', label: '편마비(좌)' },
	{ code: '3', label: '편마비(우)' },
	{ code: '4', label: '사지마비' },
];

export const E16_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '독립보행' },
	{ code: '2', label: '보조보행' },
	{ code: '3', label: '휠체어' },
	{ code: '4', label: '와상' },
];

export const E17_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '자립' },
	{ code: '2', label: '준와상' },
	{ code: '3', label: '와상' },
];

export const J04_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '자가' },
	{ code: '2', label: '전세' },
	{ code: '3', label: '월세' },
	{ code: '4', label: '무상' },
	{ code: '5', label: '시설' },
	{ code: '6', label: '기타' },
];

export const J05_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '자주 한다' },
	{ code: '2', label: '가끔 한다' },
	{ code: '3', label: '거의 하지 않는다' },
	{ code: '4', label: '전혀 하지 않는다' },
];

export const COMMUNITY_SERVICE_ITEMS: { key: string; col: string; label: string }[] = [
	{ key: '급식 및 도시락배달', col: 'K03_01', label: '급식 및 도시락배달' },
	{ key: '이미용', col: 'K03_02', label: '이미용' },
	{ key: '주거개선사업', col: 'K03_03', label: '주거개선사업' },
	{ key: '노인맞춤돌봄서비스', col: 'K03_05', label: '노인맞춤돌봄서비스' },
	{ key: '노인복지관', col: 'K03_06', label: '노인복지관' },
	{ key: '보건의료서비스', col: 'K03_07', label: '보건의료서비스' },
	{ key: '이동지원서비스', col: 'K03_08', label: '이동지원서비스' },
	{ key: '장애인활동지원서비스', col: 'K03_09', label: '장애인활동지원서비스' },
];

export const INDIVIDUAL_NEED_ITEMS: { field: string; col: string; label: string }[] = [
	{ field: 'medicationAdministrationRequest', col: 'L01_01', label: '약물투약요구' },
	{ field: 'hospitalAccompaniment', col: 'L01_02', label: '병원동행' },
	{ field: 'outingAccompaniment', col: 'L01_03', label: '외출동행(은행 등)' },
	{ field: 'physicalActivitySupport', col: 'L01_04', label: '신체활동지원' },
	{ field: 'cognitiveActivitySupport', col: 'L01_05', label: '인지활동지원' },
	{ field: 'emotionalSupport', col: 'L01_06', label: '정서지원' },
	{ field: 'rehabTraining', col: 'L01_07', label: '기능회복훈련' },
	{ field: 'oralCare', col: 'L01_08', label: '구강관리' },
	{ field: 'nutritionCare', col: 'L01_09', label: '영양관리' },
	{ field: 'familyCounseling', col: 'L01_10', label: '가족상담' },
];

function normalizeICode(raw: string, max: number, labelToCode: Record<string, string>): string {
	return normalizeHCode(raw, max, labelToCode);
}

function normalizeCodeFromOptions(
	raw: string,
	options: { code: string; label: string }[],
	extraLabelMap: Record<string, string> = {}
): string {
	const s = String(raw ?? '').trim();
	if (!s) return '';
	if (options.some((o) => o.code === s)) return s;
	if (/^\d+$/.test(s)) {
		const n = String(parseInt(s, 10));
		const byNum = options.find((o) => o.code === n || o.code === s);
		if (byNum) return byNum.code;
	}
	const labelMap: Record<string, string> = {
		...Object.fromEntries(options.map((o) => [o.label, o.code])),
		...extraLabelMap,
	};
	return labelMap[s] || '';
}

/** 가족환경 J01 결혼여부 */
export const J01_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '기혼' },
	{ code: '2', label: '미혼' },
];

/** 가족환경 J01_01 배우자생존여부 */
export const J01_01_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '생존' },
	{ code: '2', label: '사망' },
	{ code: '9', label: '관계없음' },
];

/** 가족환경 J02 주수발자 — 1.유 2.무 */
export const J02_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '유' },
	{ code: '2', label: '무' },
];

/** 가족환경 J02_02 주수발자-관계 */
export const J02_02_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '배우자' },
	{ code: '2', label: '자녀' },
	{ code: '3', label: '자부' },
	{ code: '4', label: '사위' },
	{ code: '5', label: '형제자매' },
	{ code: '6', label: '친척' },
	{ code: '9', label: '기타' },
];

/** 가족환경 J02_04 주수발자-경제상태 */
export const J02_04_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '안정' },
	{ code: '2', label: '불안' },
	{ code: '3', label: '연금생활' },
	{ code: '4', label: '생활보호' },
];

/** 가족환경 J03 동거인 */
export const J03_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '독거' },
	{ code: '2', label: '부부' },
	{ code: '3', label: '부모' },
	{ code: '4', label: '자녀' },
	{ code: '5', label: '손자녀' },
	{ code: '6', label: '친척' },
	{ code: '7', label: '친구/이웃' },
];

const J01_EXTRA: Record<string, string> = { 이혼: '2', 사별: '2' };
const J02_EXTRA: Record<string, string> = {}; // 구코드 유=2,무=1 이었을 수 있어 hydrate는 DB코드 우선
const J02_04_EXTRA: Record<string, string> = { 불안정: '2', 보통: '1' };
const J03_EXTRA: Record<string, string> = {
	혼자: '1',
	배우자: '2',
	형제자매: '6',
	기타: '7',
};

/** 자원이용 K01 종교 — 1.천주교 2.기독교 3.불교 4.기타 */
export const K01_OPTIONS: { code: string; label: string }[] = [
	{ code: '1', label: '천주교' },
	{ code: '2', label: '기독교' },
	{ code: '3', label: '불교' },
	{ code: '4', label: '기타' },
];
/** 구코드 9(기타) → 4 */
const K01_EXTRA: Record<string, string> = { '9': '4' };

export type F51012UiSnapshot = {
	formData: {
		beneficiary: string;
		creationDate: string;
		/** 화면 표시용 작성자명 (F01010.EMPNM) */
		creator: string;
		/** F51012.RQEMP = F01010.EMPNO */
		creatorEmpno: string;
		height: string;
		weight: string;
		judgmentBasis: string;
		/** F51012 C99 — 0: 미완료, 1: 입력완료 */
		physicalInputComplete: boolean;
	};
	activities: ActivityAssessment[];
	disease1Data: Record<string, boolean>;
	disease2Data: Record<string, boolean>;
	diseaseFormData: { pastMedicalHistory: string; currentDiagnosis: string; judgmentBasis: string; otherDiseaseNote: string };
	rehabilitationData: Record<string, boolean>;
	rehabilitationJudgmentBasis: string;
	nursingData: Record<string, boolean>;
	nursingJudgmentBasis: string;
	cognitionData: Record<string, boolean>;
	cognitionJudgmentBasis: string;
	communicationData: {
		/** H01 코드 1~5 (또는 구 라벨) */
		listeningAbility: string;
		/** H02 코드 1~4 */
		communication: string;
		/** H03 코드 1~4 */
		pronunciationAbility: string;
		/** H04 시력상태 */
		visionStatus: string;
		judgmentBasis: string;
		/** H99 */
		inputComplete: boolean;
	};
	nutritionData: {
		/** I01 코드 */
		dentalCondition: string;
		/** I02 코드 */
		eatingProblems: string;
		/** I03 코드 */
		eatingStatus: string;
		/** I04 코드 — 화면에서 삭제, 구데이터만 유지 */
		toolUsage: string;
		/** I05 코드 — 신체 탭에서 입력 */
		excretionPattern: string;
		/** I06 구강건강 */
		oralHealth: string;
		oralHealthOther: string;
		/** I07 치료식 */
		therapeuticDiet: string;
		therapeuticDietOther: string;
		/** I08 영양상태 */
		nutritionStatus: string;
		nutritionStatusOther: string;
		judgmentBasis: string;
		/** I99 */
		inputComplete: boolean;
	};
	physicalExtra: {
		urineFunction: string;
		bowelFunction: string;
		urineMethod: string;
		bowelMethod: string;
	};
	rehabilitationExtra: {
		contractureYn: string;
		contractureSite: string;
		paralysis: string;
		atrophyYn: string;
		atrophySite: string;
		gait: string;
		physicalFunction: string;
	};
	familyEnvironmentData: {
		/** J01 */
		maritalStatus: string;
		/** J02 — 1.유 2.무 */
		primaryCaregiver: string;
		/** J02_02 */
		primaryCaregiverRelationship: string;
		/** J03 */
		cohabitant: string;
		/** J01_02 */
		numberOfChildren: string;
		/** J02_01 */
		primaryCaregiverAge: string;
		/** J02_03 */
		otherRelationship: string;
		/** J01_01 */
		spouseSurvivalStatus: string;
		/** J02_04 */
		primaryCaregiverEconomicStatus: string;
		/** J04 주거형태 */
		housingType: string;
		housingTypeOther: string;
		/** J05 사회적교류 */
		socialExchange: string;
		/** J90 */
		judgmentBasis: string;
		/** J99 */
		inputComplete: boolean;
	};
	resourceUtilizationData: {
		/** K01 */
		religion: string;
		/** K01_01 */
		religionOther: string;
		/** K02 */
		primaryMedicalInstitution: string;
		/** K02_01 */
		phoneNumber: string;
		/** K03_01, K03_02 */
		communityServices: Record<string, boolean>;
		/** K03_03 */
		housingImprovementProject: boolean;
		/** K03_04 */
		other: string;
		/** K90 */
		judgmentBasis: string;
		/** K99 */
		inputComplete: boolean;
	};
	individualNeedsData: {
		medicationAdministrationRequest: boolean;
		hospitalAccompaniment: boolean;
		outingAccompaniment: boolean;
		physicalActivitySupport: boolean;
		cognitiveActivitySupport: boolean;
		emotionalSupport: boolean;
		rehabTraining: boolean;
		oralCare: boolean;
		nutritionCare: boolean;
		familyCounseling: boolean;
		/** L01 수급자 희망 */
		notes: string;
		/** L03 보호자 희망 */
		guardianNotes: string;
	};
	overallAssessmentData: { content: string };
};

function rowStr(r: Record<string, unknown>, k: string): string {
	return coerceScalar(getRowVal(r, k));
}

/** DB 한 행 → 화면 스냅샷 */
export function hydrateFromF51012Row(row: Record<string, unknown> | null | undefined, beneficiaryName: string): F51012UiSnapshot {
	if (!row || typeof row !== 'object') {
		return emptySnapshot(beneficiaryName, '');
	}

	const activities: ActivityAssessment[] = PHYSICAL_ACTIVITY_ITEMS.map((it) => ({
		key: it.key,
		activity: it.label,
		value: dbToActivity(getRowVal(row, it.key)),
	}));

	const disease1Data: Record<string, boolean> = {};
	DISEASE1_UI_KEYS.forEach((key, i) => {
		disease1Data[key] = parseYn(getRowVal(row, DISEASE1_COLS[i]));
	});

	const disease2Data: Record<string, boolean> = {};
	DISEASE2_UI_KEYS.forEach((key, i) => {
		disease2Data[key] = parseYn(getRowVal(row, DISEASE2_COLS[i]));
	});

	const rehabilitationData: Record<string, boolean> = {};
	Object.keys(REHAB_UI_TO_COL).forEach((label) => {
		rehabilitationData[label] = parseYn(getRowVal(row, REHAB_UI_TO_COL[label]));
	});

	const nursingData: Record<string, boolean> = {};
	Object.keys(NURSING_UI_TO_COL).forEach((label) => {
		nursingData[label] = parseYn(getRowVal(row, NURSING_UI_TO_COL[label]));
	});

	const cognitionData: Record<string, boolean> = {};
	COG_LABELS.forEach((label, i) => {
		const col = `G${String(i + 1).padStart(2, '0')}`;
		cognitionData[label] = parseYn(getRowVal(row, col));
	});

	const h1c = normalizeHCode(rowStr(row, 'H01'), 5, H1_LABEL_TO_CODE);
	const h2c = normalizeHCode(rowStr(row, 'H02'), 4, H2_LABEL_TO_CODE);
	const h3c = normalizeHCode(rowStr(row, 'H03'), 4, H3_LABEL_TO_CODE);

	return {
		formData: {
			beneficiary: beneficiaryName || rowStr(row, '수급자성명'),
			creationDate: normalizeYmdFromRow(row.RQDT ?? row.rqdt),
			creator: rowStr(row, '검사자') || rowStr(row, 'RQEMP_NM') || rowStr(row, 'EMPNM') || '',
			creatorEmpno: rowStr(row, 'RQEMP') || '',
			height: rowStr(row, 'HEIGHT') || '0.0',
			weight: rowStr(row, 'WEIGHT') || '0.0',
			judgmentBasis: rowStr(row, 'C90'),
			physicalInputComplete: rowStr(row, 'C99') === '1',
		},
		activities,
		disease1Data,
		disease2Data,
		diseaseFormData: {
			pastMedicalHistory: rowStr(row, 'D20'),
			currentDiagnosis: rowStr(row, 'D21'),
			judgmentBasis: rowStr(row, 'D90'),
			otherDiseaseNote: rowStr(row, 'D11_NOTE'),
		},
		rehabilitationData,
		rehabilitationJudgmentBasis: rowStr(row, 'E90'),
		rehabilitationExtra: {
			contractureYn: normalizeCodeFromOptions(rowStr(row, 'E13'), E13_OPTIONS),
			contractureSite: rowStr(row, 'E13_01'),
			paralysis: normalizeCodeFromOptions(rowStr(row, 'E14'), E14_OPTIONS),
			atrophyYn: normalizeCodeFromOptions(rowStr(row, 'E15'), E13_OPTIONS),
			atrophySite: rowStr(row, 'E15_01'),
			gait: normalizeCodeFromOptions(rowStr(row, 'E16'), E16_OPTIONS),
			physicalFunction: normalizeCodeFromOptions(rowStr(row, 'E17'), E17_OPTIONS),
		},
		nursingData,
		nursingJudgmentBasis: rowStr(row, 'F90'),
		cognitionData,
		cognitionJudgmentBasis: rowStr(row, 'G90'),
		communicationData: {
			listeningAbility: h1c,
			communication: h2c,
			pronunciationAbility: h3c,
			visionStatus: normalizeCodeFromOptions(rowStr(row, 'H04'), H04_OPTIONS),
			judgmentBasis: rowStr(row, 'H90'),
			inputComplete: rowStr(row, 'H99') === '1',
		},
		nutritionData: {
			dentalCondition: normalizeICode(rowStr(row, 'I01'), 4, I1_LABEL_TO_CODE),
			eatingProblems: normalizeICode(rowStr(row, 'I02'), 6, I2_LABEL_TO_CODE),
			eatingStatus: normalizeICode(rowStr(row, 'I03'), 5, I3_LABEL_TO_CODE),
			toolUsage: normalizeICode(rowStr(row, 'I04'), 4, I4_LABEL_TO_CODE),
			excretionPattern: normalizeICode(rowStr(row, 'I05'), 4, I5_LABEL_TO_CODE),
			oralHealth: normalizeCodeFromOptions(rowStr(row, 'I06'), I06_OPTIONS),
			oralHealthOther: rowStr(row, 'I06_01'),
			therapeuticDiet: normalizeCodeFromOptions(rowStr(row, 'I07'), I07_OPTIONS),
			therapeuticDietOther: rowStr(row, 'I07_01'),
			nutritionStatus: normalizeCodeFromOptions(rowStr(row, 'I08'), I08_OPTIONS),
			nutritionStatusOther: rowStr(row, 'I08_01'),
			judgmentBasis: rowStr(row, 'I90'),
			inputComplete: rowStr(row, 'I99') === '1',
		},
		physicalExtra: {
			urineFunction: normalizeCodeFromOptions(rowStr(row, 'C20'), C20_OPTIONS),
			bowelFunction: normalizeCodeFromOptions(rowStr(row, 'C21'), C21_OPTIONS),
			urineMethod: normalizeCodeFromOptions(rowStr(row, 'C22'), C22_OPTIONS),
			bowelMethod: normalizeCodeFromOptions(rowStr(row, 'C23'), C23_OPTIONS),
		},
		familyEnvironmentData: {
			maritalStatus: normalizeCodeFromOptions(rowStr(row, 'J01'), J01_OPTIONS, J01_EXTRA),
			spouseSurvivalStatus: normalizeCodeFromOptions(rowStr(row, 'J01_01'), J01_01_OPTIONS),
			numberOfChildren: rowStr(row, 'J01_02') || '',
			primaryCaregiver: normalizeCodeFromOptions(rowStr(row, 'J02'), J02_OPTIONS, J02_EXTRA),
			primaryCaregiverAge: rowStr(row, 'J02_01') || '',
			primaryCaregiverRelationship: normalizeCodeFromOptions(rowStr(row, 'J02_02'), J02_02_OPTIONS),
			otherRelationship: rowStr(row, 'J02_03'),
			primaryCaregiverEconomicStatus: normalizeCodeFromOptions(rowStr(row, 'J02_04'), J02_04_OPTIONS, J02_04_EXTRA),
			cohabitant: normalizeCodeFromOptions(rowStr(row, 'J03'), J03_OPTIONS, J03_EXTRA),
			housingType: normalizeCodeFromOptions(rowStr(row, 'J04'), J04_OPTIONS),
			housingTypeOther: rowStr(row, 'J04_01'),
			socialExchange: normalizeCodeFromOptions(rowStr(row, 'J05'), J05_OPTIONS),
			judgmentBasis: rowStr(row, 'J90'),
			inputComplete: rowStr(row, 'J99') === '1',
		},
		resourceUtilizationData: {
			religion: normalizeCodeFromOptions(rowStr(row, 'K01'), K01_OPTIONS, K01_EXTRA),
			religionOther: rowStr(row, 'K01_01'),
			primaryMedicalInstitution: rowStr(row, 'K02'),
			phoneNumber: rowStr(row, 'K02_01'),
			communityServices: Object.fromEntries(
				COMMUNITY_SERVICE_ITEMS.filter((it) => it.col !== 'K03_03').map((it) => [it.key, parseYn(getRowVal(row, it.col))])
			),
			housingImprovementProject: parseYn(getRowVal(row, 'K03_03')),
			other: rowStr(row, 'K03_04'),
			judgmentBasis: rowStr(row, 'K90'),
			inputComplete: rowStr(row, 'K99') === '1',
		},
		individualNeedsData: {
			medicationAdministrationRequest: parseYn(getRowVal(row, 'L01_01')),
			hospitalAccompaniment: parseYn(getRowVal(row, 'L01_02')),
			outingAccompaniment: parseYn(getRowVal(row, 'L01_03')),
			physicalActivitySupport: parseYn(getRowVal(row, 'L01_04')),
			cognitiveActivitySupport: parseYn(getRowVal(row, 'L01_05')),
			emotionalSupport: parseYn(getRowVal(row, 'L01_06')),
			rehabTraining: parseYn(getRowVal(row, 'L01_07')),
			oralCare: parseYn(getRowVal(row, 'L01_08')),
			nutritionCare: parseYn(getRowVal(row, 'L01_09')),
			familyCounseling: parseYn(getRowVal(row, 'L01_10')),
			notes: rowStr(row, 'L01'),
			guardianNotes: rowStr(row, 'L03'),
		},
		overallAssessmentData: { content: rowStr(row, 'L02') },
	};
}

function normalizeYmdFromRow(v: unknown): string {
	if (v == null) return '';
	const s = String(v).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return s;
}

export function emptySnapshot(beneficiaryName: string, creationDate: string): F51012UiSnapshot {
	const disease1: Record<string, boolean> = {};
	DISEASE1_UI_KEYS.forEach((k) => {
		disease1[k] = false;
	});
	const disease2: Record<string, boolean> = {};
	DISEASE2_UI_KEYS.forEach((k) => {
		disease2[k] = false;
	});
	const rehab: Record<string, boolean> = {};
	Object.keys(REHAB_UI_TO_COL).forEach((k) => {
		rehab[k] = false;
	});
	const nurse: Record<string, boolean> = {};
	Object.keys(NURSING_UI_TO_COL).forEach((k) => {
		nurse[k] = false;
	});
	const cog: Record<string, boolean> = {};
	COG_LABELS.forEach((l) => {
		cog[l] = false;
	});
	return {
		formData: {
			beneficiary: beneficiaryName,
			creationDate,
			creator: '',
			creatorEmpno: '',
			height: '0.0',
			weight: '0.0',
			judgmentBasis: '',
			physicalInputComplete: false,
		},
		activities: createEmptyActivities(),
		disease1Data: disease1,
		disease2Data: disease2,
		diseaseFormData: { pastMedicalHistory: '', currentDiagnosis: '', judgmentBasis: '', otherDiseaseNote: '' },
		rehabilitationData: rehab,
		rehabilitationJudgmentBasis: '',
		rehabilitationExtra: {
			contractureYn: '',
			contractureSite: '',
			paralysis: '',
			atrophyYn: '',
			atrophySite: '',
			gait: '',
			physicalFunction: '',
		},
		nursingData: nurse,
		nursingJudgmentBasis: '',
		cognitionData: cog,
		cognitionJudgmentBasis: '',
		communicationData: {
			listeningAbility: '',
			communication: '',
			pronunciationAbility: '',
			visionStatus: '',
			judgmentBasis: '',
			inputComplete: false,
		},
		nutritionData: {
			dentalCondition: '',
			eatingProblems: '',
			eatingStatus: '',
			toolUsage: '',
			excretionPattern: '',
			oralHealth: '',
			oralHealthOther: '',
			therapeuticDiet: '',
			therapeuticDietOther: '',
			nutritionStatus: '',
			nutritionStatusOther: '',
			judgmentBasis: '',
			inputComplete: false,
		},
		physicalExtra: {
			urineFunction: '',
			bowelFunction: '',
			urineMethod: '',
			bowelMethod: '',
		},
		familyEnvironmentData: {
			maritalStatus: '',
			primaryCaregiver: '',
			primaryCaregiverRelationship: '',
			cohabitant: '',
			numberOfChildren: '',
			primaryCaregiverAge: '',
			otherRelationship: '',
			spouseSurvivalStatus: '',
			primaryCaregiverEconomicStatus: '',
			housingType: '',
			housingTypeOther: '',
			socialExchange: '',
			judgmentBasis: '',
			inputComplete: false,
		},
		resourceUtilizationData: {
			religion: '',
			religionOther: '',
			primaryMedicalInstitution: '',
			phoneNumber: '',
			communityServices: Object.fromEntries(
				COMMUNITY_SERVICE_ITEMS.filter((it) => it.col !== 'K03_03').map((it) => [it.key, false])
			),
			housingImprovementProject: false,
			other: '',
			judgmentBasis: '',
			inputComplete: false,
		},
		individualNeedsData: {
			medicationAdministrationRequest: false,
			hospitalAccompaniment: false,
			outingAccompaniment: false,
			physicalActivitySupport: false,
			cognitiveActivitySupport: false,
			emotionalSupport: false,
			rehabTraining: false,
			oralCare: false,
			nutritionCare: false,
			familyCounseling: false,
			notes: '',
			guardianNotes: '',
		},
		overallAssessmentData: { content: '' },
	};
}

/** 화면 상태 → F51012 컬럼 객체 (ANCD, PNUM, RQDT 제외) */
export function buildF51012RowPayload(
	ui: F51012UiSnapshot,
	ancd: string | number,
	pnum: string | number,
	rqdtYmd: string
): Record<string, unknown> {
	const rqempRaw = String(ui.formData.creatorEmpno ?? '').trim();
	const rqempNum = parseInt(rqempRaw, 10);

	const row: Record<string, unknown> = {
		ANCD: ancd,
		PNUM: pnum,
		RQDT: rqdtYmd,
		RQEMP: Number.isFinite(rqempNum) ? rqempNum : null,
		HEIGHT: ui.formData.height === '' ? null : Number(ui.formData.height),
		WEIGHT: ui.formData.weight === '' ? null : Number(ui.formData.weight),
		C90: ui.formData.judgmentBasis || null,
		C99: ui.formData.physicalInputComplete ? '1' : '0',
	};

	PHYSICAL_ACTIVITY_ITEMS.forEach((it) => {
		const found = ui.activities.find((a) => a.key === it.key);
		row[it.key] = activityToDb(found?.value || '');
	});
	UNUSED_C_KEYS.forEach((ck) => {
		row[ck] = row[ck] ?? null;
	});
	row.C20 = ui.physicalExtra.urineFunction || null;
	row.C21 = ui.physicalExtra.bowelFunction || null;
	row.C22 = ui.physicalExtra.urineMethod || null;
	row.C23 = ui.physicalExtra.bowelMethod || null;

	DISEASE1_UI_KEYS.forEach((key, i) => {
		row[DISEASE1_COLS[i]] = yn(!!ui.disease1Data[key]);
	});

	DISEASE2_UI_KEYS.forEach((key, i) => {
		row[DISEASE2_COLS[i]] = yn(!!ui.disease2Data[key]);
	});

	row.D20 = ui.diseaseFormData.pastMedicalHistory || null;
	row.D21 = ui.diseaseFormData.currentDiagnosis || null;
	row.D90 = ui.diseaseFormData.judgmentBasis || null;
	row.D11_NOTE = ui.diseaseFormData.otherDiseaseNote || null;
	row.D10_02_01 = null;

	Object.keys(REHAB_UI_TO_COL).forEach((label) => {
		row[REHAB_UI_TO_COL[label]] = yn(!!ui.rehabilitationData[label]);
	});
	row.E13 = ui.rehabilitationExtra.contractureYn || null;
	row.E13_01 = ui.rehabilitationExtra.contractureSite || null;
	row.E14 = ui.rehabilitationExtra.paralysis || null;
	row.E15 = ui.rehabilitationExtra.atrophyYn || null;
	row.E15_01 = ui.rehabilitationExtra.atrophySite || null;
	row.E16 = ui.rehabilitationExtra.gait || null;
	row.E17 = ui.rehabilitationExtra.physicalFunction || null;
	row.E90 = ui.rehabilitationJudgmentBasis || null;

	Object.keys(NURSING_UI_TO_COL).forEach((label) => {
		row[NURSING_UI_TO_COL[label]] = yn(!!ui.nursingData[label]);
	});
	row.F90 = ui.nursingJudgmentBasis || null;

	COG_LABELS.forEach((label, i) => {
		const col = i < 9 ? `G0${i + 1}` : `G${i + 1}`;
		row[col] = yn(!!ui.cognitionData[label]);
	});
	row.G90 = ui.cognitionJudgmentBasis || null;

	row.H01 = normalizeHCode(ui.communicationData.listeningAbility, 5, H1_LABEL_TO_CODE) || null;
	row.H02 = normalizeHCode(ui.communicationData.communication, 4, H2_LABEL_TO_CODE) || null;
	row.H03 = normalizeHCode(ui.communicationData.pronunciationAbility, 4, H3_LABEL_TO_CODE) || null;
	row.H04 = ui.communicationData.visionStatus || null;
	row.H90 = ui.communicationData.judgmentBasis || null;
	row.H99 = ui.communicationData.inputComplete ? '1' : '0';

	row.I01 = normalizeICode(ui.nutritionData.dentalCondition, 4, I1_LABEL_TO_CODE) || null;
	row.I02 = normalizeICode(ui.nutritionData.eatingProblems, 6, I2_LABEL_TO_CODE) || null;
	row.I03 = normalizeICode(ui.nutritionData.eatingStatus, 5, I3_LABEL_TO_CODE) || null;
	row.I04 = normalizeICode(ui.nutritionData.toolUsage, 4, I4_LABEL_TO_CODE) || null;
	row.I05 = normalizeICode(ui.nutritionData.excretionPattern, 4, I5_LABEL_TO_CODE) || null;
	row.I06 = ui.nutritionData.oralHealth || null;
	row.I06_01 = ui.nutritionData.oralHealthOther || null;
	row.I07 = ui.nutritionData.therapeuticDiet || null;
	row.I07_01 = ui.nutritionData.therapeuticDietOther || null;
	row.I08 = ui.nutritionData.nutritionStatus || null;
	row.I08_01 = ui.nutritionData.nutritionStatusOther || null;
	row.I90 = ui.nutritionData.judgmentBasis || null;
	row.I99 = ui.nutritionData.inputComplete ? '1' : '0';

	row.J01 = normalizeCodeFromOptions(ui.familyEnvironmentData.maritalStatus, J01_OPTIONS, J01_EXTRA) || null;
	row.J01_01 = normalizeCodeFromOptions(ui.familyEnvironmentData.spouseSurvivalStatus, J01_01_OPTIONS) || null;
	const childrenN = parseInt(String(ui.familyEnvironmentData.numberOfChildren || ''), 10);
	row.J01_02 = Number.isFinite(childrenN) ? childrenN : null;
	row.J02 = normalizeCodeFromOptions(ui.familyEnvironmentData.primaryCaregiver, J02_OPTIONS, J02_EXTRA) || null;
	const ageN = parseInt(String(ui.familyEnvironmentData.primaryCaregiverAge || ''), 10);
	row.J02_01 = Number.isFinite(ageN) ? ageN : null;
	row.J02_02 = normalizeCodeFromOptions(ui.familyEnvironmentData.primaryCaregiverRelationship, J02_02_OPTIONS) || null;
	row.J02_03 = ui.familyEnvironmentData.otherRelationship || null;
	row.J02_04 = normalizeCodeFromOptions(ui.familyEnvironmentData.primaryCaregiverEconomicStatus, J02_04_OPTIONS, J02_04_EXTRA) || null;
	row.J03 = normalizeCodeFromOptions(ui.familyEnvironmentData.cohabitant, J03_OPTIONS, J03_EXTRA) || null;
	row.J04 = ui.familyEnvironmentData.housingType || null;
	row.J04_01 = ui.familyEnvironmentData.housingTypeOther || null;
	row.J05 = ui.familyEnvironmentData.socialExchange || null;
	row.J90 = ui.familyEnvironmentData.judgmentBasis || null;
	row.J99 = ui.familyEnvironmentData.inputComplete ? '1' : '0';

	row.K01 = normalizeCodeFromOptions(ui.resourceUtilizationData.religion, K01_OPTIONS, K01_EXTRA) || null;
	row.K01_01 = ui.resourceUtilizationData.religionOther || null;
	row.K02 = ui.resourceUtilizationData.primaryMedicalInstitution || null;
	row.K02_01 = ui.resourceUtilizationData.phoneNumber || null;
	for (const it of COMMUNITY_SERVICE_ITEMS) {
		if (it.col === 'K03_03') {
			row.K03_03 = yn(ui.resourceUtilizationData.housingImprovementProject);
		} else {
			row[it.col] = yn(!!ui.resourceUtilizationData.communityServices[it.key]);
		}
	}
	row.K03_04 = ui.resourceUtilizationData.other || null;
	row.K90 = ui.resourceUtilizationData.judgmentBasis || null;
	row.K99 = ui.resourceUtilizationData.inputComplete ? '1' : '0';

	row.L01 = ui.individualNeedsData.notes || null;
	row.L03 = ui.individualNeedsData.guardianNotes || null;
	for (const it of INDIVIDUAL_NEED_ITEMS) {
		row[it.col] = yn(!!(ui.individualNeedsData as Record<string, unknown>)[it.field]);
	}
	row.L02 = ui.overallAssessmentData.content || null;

	return row;
}

export function collectUiSnapshot(st: {
	formData: F51012UiSnapshot['formData'];
	activities: ActivityAssessment[];
	disease1Data: Record<string, boolean>;
	disease2Data: Record<string, boolean>;
	diseaseFormData: F51012UiSnapshot['diseaseFormData'];
	rehabilitationData: Record<string, boolean>;
	rehabilitationJudgmentBasis: string;
	rehabilitationExtra: F51012UiSnapshot['rehabilitationExtra'];
	nursingData: Record<string, boolean>;
	nursingJudgmentBasis: string;
	cognitionData: Record<string, boolean>;
	cognitionJudgmentBasis: string;
	communicationData: F51012UiSnapshot['communicationData'];
	nutritionData: F51012UiSnapshot['nutritionData'];
	physicalExtra: F51012UiSnapshot['physicalExtra'];
	familyEnvironmentData: F51012UiSnapshot['familyEnvironmentData'];
	resourceUtilizationData: F51012UiSnapshot['resourceUtilizationData'];
	individualNeedsData: F51012UiSnapshot['individualNeedsData'];
	overallAssessmentData: F51012UiSnapshot['overallAssessmentData'];
}): F51012UiSnapshot {
	return {
		formData: st.formData,
		activities: st.activities,
		disease1Data: st.disease1Data,
		disease2Data: st.disease2Data,
		diseaseFormData: st.diseaseFormData,
		rehabilitationData: st.rehabilitationData,
		rehabilitationJudgmentBasis: st.rehabilitationJudgmentBasis,
		rehabilitationExtra: st.rehabilitationExtra,
		nursingData: st.nursingData,
		nursingJudgmentBasis: st.nursingJudgmentBasis,
		cognitionData: st.cognitionData,
		cognitionJudgmentBasis: st.cognitionJudgmentBasis,
		communicationData: st.communicationData,
		nutritionData: st.nutritionData,
		physicalExtra: st.physicalExtra,
		familyEnvironmentData: st.familyEnvironmentData,
		resourceUtilizationData: st.resourceUtilizationData,
		individualNeedsData: st.individualNeedsData,
		overallAssessmentData: st.overallAssessmentData,
	};
}
