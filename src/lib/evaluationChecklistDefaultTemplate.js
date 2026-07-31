/**
 * 평가 체크리스트 기본 표 형식 (이미지 기준)
 * EVALUATION_CHECKLISTS_TABLE 시드 / 화면 기본값 공용
 */

const MONTH_TEXTS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
const HALF_TEXTS = ["상반기", "하반기"];
const QUARTER_TEXTS = ["1분기", "2분기", "3분기", "4분기"];
const YEAR_TEXTS = ["연 1회"];

/** @typedef {{ TASK_ID: string, CATEGORY: string, FREQ_LABEL: string, MERGE_MODE: string, CONTENT: string, SORT_NO: number, CELL_TEXTS: string[] }} TemplateRow */

/** @type {TemplateRow[]} */
const EVALUATION_CHECKLIST_DEFAULT_TEMPLATE = [
	// 기관운영
	{ TASK_ID: "op-y1", CATEGORY: "기관운영", FREQ_LABEL: "연중", MERGE_MODE: "1", CONTENT: "운영규정 마련 및 정비 (지표 1번)", SORT_NO: 1, CELL_TEXTS: [...YEAR_TEXTS] },
	{ TASK_ID: "op-y2", CATEGORY: "기관운영", FREQ_LABEL: "연중", MERGE_MODE: "1", CONTENT: "급여제공지침 마련 및 정비 (지표 26번)", SORT_NO: 2, CELL_TEXTS: [...YEAR_TEXTS] },
	{ TASK_ID: "op-y3", CATEGORY: "기관운영", FREQ_LABEL: "연중", MERGE_MODE: "1", CONTENT: "사업계획 및 예산 수립 (지표 2번)", SORT_NO: 3, CELL_TEXTS: [...YEAR_TEXTS] },
	{ TASK_ID: "op-y4", CATEGORY: "기관운영", FREQ_LABEL: "연중", MERGE_MODE: "1", CONTENT: "사업계획 평가 (지표 2번)", SORT_NO: 4, CELL_TEXTS: [...YEAR_TEXTS] },
	{ TASK_ID: "op-y5", CATEGORY: "기관운영", FREQ_LABEL: "연중", MERGE_MODE: "1", CONTENT: "프로그램 계획 수립 (지표 38번)", SORT_NO: 5, CELL_TEXTS: [...YEAR_TEXTS] },
	{ TASK_ID: "op-h1", CATEGORY: "기관운영", FREQ_LABEL: "반기", MERGE_MODE: "2", CONTENT: "보호자 간담회 (지표 27번)", SORT_NO: 6, CELL_TEXTS: [...HALF_TEXTS] },
	{ TASK_ID: "op-h2", CATEGORY: "기관운영", FREQ_LABEL: "반기", MERGE_MODE: "2", CONTENT: "프로그램 의견수렴 (지표 38번)", SORT_NO: 7, CELL_TEXTS: [...HALF_TEXTS] },
	{ TASK_ID: "op-q1", CATEGORY: "기관운영", FREQ_LABEL: "분기", MERGE_MODE: "4", CONTENT: "실/내외 소독 (살균, 살충, 살서) (지표 15번)", SORT_NO: 8, CELL_TEXTS: [...QUARTER_TEXTS] },
	{ TASK_ID: "op-q2", CATEGORY: "기관운영", FREQ_LABEL: "분기", MERGE_MODE: "4", CONTENT: "의약품 관리 (지표 35번)", SORT_NO: 9, CELL_TEXTS: [...QUARTER_TEXTS] },
	{ TASK_ID: "op-m1", CATEGORY: "기관운영", FREQ_LABEL: "매월", MERGE_MODE: "12", CONTENT: "소화 및 경보 설비 점검 (지표 22번)", SORT_NO: 10, CELL_TEXTS: [...MONTH_TEXTS] },
	{ TASK_ID: "op-m2", CATEGORY: "기관운영", FREQ_LABEL: "매월", MERGE_MODE: "12", CONTENT: "기관소식제공 (지표 27번)", SORT_NO: 11, CELL_TEXTS: [...MONTH_TEXTS] },
	{ TASK_ID: "op-w1", CATEGORY: "기관운영", FREQ_LABEL: "매주", MERGE_MODE: "12", CONTENT: "자원봉사활동 (지표 3번)", SORT_NO: 12, CELL_TEXTS: Array.from({ length: 12 }, () => "일 1회") },
	{ TASK_ID: "op-w2", CATEGORY: "기관운영", FREQ_LABEL: "매주", MERGE_MODE: "12", CONTENT: "주방 및 집기 소독 (지표 14번)", SORT_NO: 13, CELL_TEXTS: [...MONTH_TEXTS] },

	// 수급자
	{ TASK_ID: "rc-y1", CATEGORY: "수급자", FREQ_LABEL: "연중", MERGE_MODE: "1", CONTENT: "욕구평가 (지표 30번)", SORT_NO: 14, CELL_TEXTS: [...YEAR_TEXTS] },
	{ TASK_ID: "rc-y2", CATEGORY: "수급자", FREQ_LABEL: "연중", MERGE_MODE: "1", CONTENT: "위험도 평가 (지표 30번)", SORT_NO: 15, CELL_TEXTS: [...YEAR_TEXTS] },
	{ TASK_ID: "rc-y3", CATEGORY: "수급자", FREQ_LABEL: "연중", MERGE_MODE: "1", CONTENT: "급여계획 작성 (지표 31번)", SORT_NO: 16, CELL_TEXTS: [...YEAR_TEXTS] },
	{ TASK_ID: "rc-y4", CATEGORY: "수급자", FREQ_LABEL: "연중", MERGE_MODE: "1", CONTENT: "급여제공결과 평가 (지표 44번)", SORT_NO: 17, CELL_TEXTS: [...YEAR_TEXTS] },
	{ TASK_ID: "rc-h1", CATEGORY: "수급자", FREQ_LABEL: "반기", MERGE_MODE: "2", CONTENT: "재난상황 대응훈련 (지표 23번)", SORT_NO: 18, CELL_TEXTS: [...HALF_TEXTS] },
	{ TASK_ID: "rc-q1", CATEGORY: "수급자", FREQ_LABEL: "분기", MERGE_MODE: "4", CONTENT: "수급자(보호자) 상담 (지표 25번)", SORT_NO: 19, CELL_TEXTS: [...QUARTER_TEXTS] },
	{ TASK_ID: "rc-q2", CATEGORY: "수급자", FREQ_LABEL: "분기", MERGE_MODE: "4", CONTENT: "사례관리 회의 (지표 43번)", SORT_NO: 20, CELL_TEXTS: [...QUARTER_TEXTS] },
	{ TASK_ID: "rc-m1", CATEGORY: "수급자", FREQ_LABEL: "매월", MERGE_MODE: "12", CONTENT: "급여제공기록지 제공 (지표 44번)", SORT_NO: 21, CELL_TEXTS: [...MONTH_TEXTS] },
	{ TASK_ID: "rc-m2", CATEGORY: "수급자", FREQ_LABEL: "매월", MERGE_MODE: "12", CONTENT: "상태변화 기록 (지표 44번)", SORT_NO: 22, CELL_TEXTS: [...MONTH_TEXTS] },

	// 직원
	{ TASK_ID: "st-y1", CATEGORY: "직원", FREQ_LABEL: "연중", MERGE_MODE: "1", CONTENT: "운영규정, 급여제공지침 교육 (지표 1번, 26번)", SORT_NO: 23, CELL_TEXTS: [...YEAR_TEXTS] },
	{
		TASK_ID: "st-y2",
		CATEGORY: "직원",
		FREQ_LABEL: "연중",
		MERGE_MODE: "1",
		CONTENT: "직원 건강검진 (지표 7번)",
		SORT_NO: 24,
		CELL_TEXTS: ["연 1회 (연 내에 모두 받을 수 있도록 하여야 함)"],
	},
	{ TASK_ID: "st-h1", CATEGORY: "직원", FREQ_LABEL: "반기", MERGE_MODE: "2", CONTENT: "소화 및 경보설비 교육 (지표 22번)", SORT_NO: 25, CELL_TEXTS: [...HALF_TEXTS] },
	{ TASK_ID: "st-h2", CATEGORY: "직원", FREQ_LABEL: "반기", MERGE_MODE: "2", CONTENT: "재난상황 대응훈련 (지표 23번)", SORT_NO: 26, CELL_TEXTS: [...HALF_TEXTS] },
	{ TASK_ID: "st-q1", CATEGORY: "직원", FREQ_LABEL: "분기", MERGE_MODE: "4", CONTENT: "복지(포상) 등 제공 (지표 10번)", SORT_NO: 27, CELL_TEXTS: [...QUARTER_TEXTS] },
];

module.exports = {
	EVALUATION_CHECKLIST_DEFAULT_TEMPLATE,
};
