/**
 * @file 일 수급자급여실적 (F14020 식사·외출·외박·급여50%)
 *
 * @description
 * 요양원 수급자의 일별 식사/간식 상태, 외출·외박(IO_TM_INFO), 급여50%(PAY_COM_GU)를
 * 조회·수정·전체추가·외박복귀·인쇄하는 화면입니다.
 *
 * @remarks
 * - 페이지 엔트리: `src/app/nursingHome/daily-beneficiary-performance/page.tsx`
 * - API: `GET/POST/DELETE /api/f14020` (세션 ANCD 게이트)
 * - 외출대장 동기화: 서버 `outingF14020Sync` (저장 시 OUTING_INFO 반영)
 * - IO_TM_INFO 형식:
 *   - 외출: `HH:mm~HH:mm`
 *   - 외박 출발: `HH:mm`
 *   - 외박중(중간일): `ON:YYYY-MM-DD|HH:mm`
 *   - 외박 복귀: `R:HH:mm`
 * - GYN: `'0'` 외출, `'1'` 입원(원내), `'2'` 외박
 * - PAY_COM_GU: `'1'`=급여 50%, `'0'`=100%
 *
 * @see MemberInfoUtils — 입·퇴소 12시간 급여50% 규칙 (서버 syncAdmitDischargePay와 공유)
 */
"use client";
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTabRefresh } from '../../hooks/useTabRefresh';

/**
 * 식사종류(PH_MEAL_KIND / ST_KIND) 코드 → 표시명
 * 1 일반식, 2 일반식(콩밥), 3 일반식(저염식), 4 다진식, 5 죽, 6 유동식(미음), 7 경관식
 */
const MEAL_KIND_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: '1', label: '일반식' },
	{ value: '2', label: '일반식(콩밥)' },
	{ value: '3', label: '일반식(저염식)' },
	{ value: '4', label: '다진식' },
	{ value: '5', label: '죽' },
	{ value: '6', label: '유동식(미음)' },
	{ value: '7', label: '경관식' },
];

const MEAL_KIND_LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
	MEAL_KIND_OPTIONS.map((o) => [o.value, o.label])
);

/** 식사종류 코드를 표시 문구로 변환합니다. */
function mealKindLabel(code: string | null | undefined): string {
	const key = String(code ?? '').trim();
	return MEAL_KIND_LABEL_BY_CODE[key] || '';
}

/**
 * 화면 그리드 1행에 대응하는 F14020 실적 모델.
 * API 응답을 {@link mapApiItemToPerformance}로 변환해 사용합니다.
 */
interface PerformanceData {
	/** 화면용 임시 행 ID (DB PK 아님) */
	id: number;
	/** 표시용 연번 */
	serialNo: number;
	/** 수급자명 (F10010.P_NM) */
	name: string;
	/** 생년월일 표시 문자열 */
	birthDate: string;
	/** 기관코드 */
	ancd?: string;
	/** 수급자번호 */
	pnum?: string;
	/** 서비스일자 YYYY-MM-DD (SVDT) */
	svdt?: string;
	/** 입소일 P_SDT */
	admitDate?: string;
	/** 입소시각 P_SDT_TM HH:mm */
	admitTime?: string;
	/** 퇴소일 P_EDT */
	dischargeDate?: string;
	/** 퇴소시각 P_EDT_TM HH:mm */
	dischargeTime?: string;
	/** 식사장소 ST_PLAC */
	mealLocation: string;
	/** 식사종류 PH_MEAL_KIND/ST_KIND: 1~7 ({@link MEAL_KIND_OPTIONS}) */
	mealType: string;
	/** GYN: '0'=외출, '1'=입원, '2'=외박 */
	gyn: string;
	/** 외출/외박 시작 시각 (IO_TM_INFO에서 파싱) */
	gynStartTime: string;
	/** 외출 종료 시각 (외박은 보통 빈 값) */
	gynEndTime: string;
	/** 외박 복귀 시각 (IO_TM_INFO = R:HH:mm) */
	returnTime: string;
	/** PAY_COM_GU: '1'=급여50%적용, '0'=100% */
	payComGu: string;
	/** 외박중(출발일 이후~복귀 전) 여부 */
	overnightOngoing?: boolean;
	/** 외박 출발일 (ON: 파싱) */
	overnightLeaveDate?: string;
	/** 외박 출발시각 */
	overnightLeaveTime?: string;
	/** 조/중/석식 MOST, LCST, DNST: '1'=양호, '2'=이상 */
	mealStatus: { breakfast: string; lunch: string; dinner: string };
	/** 특이사항 ST_ETC */
	specialNotes: string;
	/** 오전/오후/저녁 간식 MGST, AGST, DGST: '1'=양호, '2'=이상 */
	snackStatus: { morning: string; afternoon: string; evening: string };
}

/**
 * 외박 복귀 모달용 대기 목록 항목.
 * `/api/f14020?action=overnightPending` 응답을 UI 선택 상태로 확장한 형태입니다.
 */
interface OvernightPendingItem {
	ANCD?: string | number;
	PNUM: string | number;
	P_NM?: string;
	P_BRDT?: string;
	PREV_SVDT?: string;
	PREV_IO_TM_INFO?: string;
	/** 사용자가 입력한 복귀 시각 HH:mm */
	returnTime: string;
	/** 복귀 처리 대상 체크 */
	selected: boolean;
}

/**
 * 시각을 `HH:mm`(5자)로 정규화합니다.
 * @param t - `H:mm` 또는 `HH:mm`
 * @returns 정규화된 시각, 파싱 실패 시 빈 문자열
 */
function padTime5(t: string): string {
	const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
	if (!m) return '';
	return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
}

/**
 * F14020.IO_TM_INFO 문자열을 UI용 시각/외박중 플래그로 파싱합니다.
 *
 * 지원 형식: `ON:날짜|시각`, `R:시각`, `시작~종료`, 단일 `HH:mm`(외박 출발).
 *
 * @param info - DB IO_TM_INFO 값
 * @returns start/end/returnTime 및 외박중이면 overnightOngoing·overnightLeaveDate
 */
function parseIoTmInfo(info: string | null | undefined): {
	start: string;
	end: string;
	returnTime: string;
	overnightOngoing?: boolean;
	overnightLeaveDate?: string;
} {
	const s = String(info || '').trim();
	// 외박중(중간일): ON:YYYY-MM-DD|HH:mm (깨진 날짜 문자열도 보정)
	const ongoingStrict = /^ON:(\d{4}-\d{2}-\d{2})\|(\d{1,2}:\d{2})$/i.exec(s);
	if (ongoingStrict) {
		return {
			start: padTime5(ongoingStrict[2]),
			end: '',
			returnTime: '',
			overnightOngoing: true,
			overnightLeaveDate: ongoingStrict[1],
		};
	}
	const ongoingLoose = /^ON:(.+)\|(\d{1,2}:\d{2})$/i.exec(s);
	if (ongoingLoose) {
		const leaveDate = toYmd(ongoingLoose[1]);
		const leaveTime = padTime5(ongoingLoose[2]);
		if (leaveDate && leaveTime) {
			return {
				start: leaveTime,
				end: '',
				returnTime: '',
				overnightOngoing: true,
				overnightLeaveDate: leaveDate,
			};
		}
	}
	const ret = /^R[:：]?\s*(\d{1,2}:\d{2})$/i.exec(s) || /^복귀\s*[:：]?\s*(\d{1,2}:\d{2})$/.exec(s);
	if (ret) return { start: '', end: '', returnTime: padTime5(ret[1]) };
	const range = /^(\d{1,2}:\d{2})\s*[~\-–]\s*(\d{1,2}:\d{2})$/.exec(s);
	if (range) return { start: padTime5(range[1]), end: padTime5(range[2]), returnTime: '' };
	// 외박: 나간 시각만 저장된 경우 (예: "08:00", "08:00:00", "08:00~")
	const single = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*[~\-–]?\s*$/.exec(s);
	if (single) return { start: padTime5(`${single[1]}:${single[2]}`), end: '', returnTime: '' };
	return { start: '', end: '', returnTime: '' };
}

/**
 * UI 입력을 F14020.IO_TM_INFO 저장 형식으로 직렬화합니다.
 * 복귀 시각이 있으면 `R:HH:mm`을 우선합니다. 외박(gyn=2)은 시작 시각만 저장합니다.
 *
 * @param gyn - GYN 코드
 * @param start - 시작 HH:mm
 * @param end - 종료 HH:mm (외출)
 * @param returnTime - 복귀 HH:mm (있으면 R: 형식)
 */
function formatIoTmInfo(gyn: string, start: string, end: string, returnTime?: string): string {
	const ret = padTime5(returnTime || '');
	if (ret) return `R:${ret}`;
	const a = padTime5(start);
	const b = padTime5(end);
	if (!a && !b) return '';
	if (gyn === '2') return a; // 외박: 나간 시각만
	if (!a || !b) return a || b;
	return `${a}~${b}`;
}

/**
 * 외박중(중간일) IO_TM_INFO를 `ON:YYYY-MM-DD|HH:mm` 형식으로 만듭니다.
 * @param leaveDate - 외박 출발일
 * @param leaveTime - 외박 출발 시각
 */
function formatOvernightOngoingIoTmInfo(leaveDate: string, leaveTime: string): string {
	const d = toYmd(leaveDate);
	const t = padTime5(leaveTime);
	if (!d || !t) return '';
	return `ON:${d}|${t}`;
}

/**
 * 외출·외박 기준 PAY_COM_GU를 계산합니다.
 *
 * - 외출(0): 항상 100%(`'0'`)
 * - 외박(2): 항상 50%(`'1'`)
 * - 복귀일(returnTime + gyn 1/빈값): 100%(`'0'`)
 * - 그 외(입원 등): `'0'`
 *
 * @remarks
 * 입·퇴소 12시간 규칙(서버 `calcAdmitPayComGu` / `calcDischargePayComGu`)은 반영하지 않습니다.
 * DB에 이미 있는 입·퇴소 50%를 이 함수로 덮어쓰지 않도록 주의하세요.
 *
 * @param gyn - GYN 코드
 * @param _start - 미사용(호환용)
 * @param _end - 미사용(호환용)
 * @param returnTime - 복귀 시각이 있으면 복귀일 규칙 적용
 * @returns `'0'` | `'1'`
 */
function calcPayComGu(gyn: string, _start?: string, _end?: string, returnTime?: string): string {
	if (returnTime && (gyn === '1' || gyn === '')) return '0';
	if (gyn === '0') return '0';
	if (gyn === '2') return '1';
	return '0';
}

/** GYN 코드를 한글 라벨로 변환합니다. */
function gynLabel(gyn: string): string {
	if (gyn === '1') return '입원';
	if (gyn === '0') return '외출';
	if (gyn === '2') return '외박';
	return '';
}

/**
 * 날짜 값을 `YYYY-MM-DD`로 정규화합니다.
 * Date / `YYYYMMDD` / ISO 문자열을 허용합니다.
 */
function toYmd(v: unknown): string {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const y = v.getFullYear();
		const m = String(v.getMonth() + 1).padStart(2, '0');
		const d = String(v.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(v).trim();
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	const parsed = Date.parse(s);
	if (!Number.isNaN(parsed)) {
		const dt = new Date(parsed);
		const y = dt.getFullYear();
		const m = String(dt.getMonth() + 1).padStart(2, '0');
		const d = String(dt.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return '';
}

/**
 * 시각 값을 `HH:mm`으로 정규화합니다.
 * Date / `HHmm` / 시각이 포함된 문자열을 허용합니다.
 */
function toHm(v: unknown): string {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`;
	}
	const s = String(v).trim();
	const colon = s.match(/^(\d{1,2}):(\d{2})/);
	if (colon) return padTime5(`${colon[1]}:${colon[2]}`);
	if (/^\d{4}$/.test(s)) return padTime5(`${s.slice(0, 2)}:${s.slice(2)}`);
	const embedded = s.match(/[T\s](\d{1,2}):(\d{2})/);
	if (embedded) return padTime5(`${embedded[1]}:${embedded[2]}`);
	return '';
}

/**
 * 조회일이 해당 수급자의 입소일/퇴소일인지 판별합니다.
 * @returns isAdmitDay / isDischargeDay / isAdmitOrDischargeDay
 */
function getAdmitDischargeFlags(row: PerformanceData, dateYmd: string) {
	const day = toYmd(dateYmd);
	const isAdmitDay = !!day && !!row.admitDate && row.admitDate === day;
	const isDischargeDay = !!day && !!row.dischargeDate && row.dischargeDate === day;
	return { isAdmitDay, isDischargeDay, isAdmitOrDischargeDay: isAdmitDay || isDischargeDay };
}

/** 외박중 표시 문구 (`외박중 YYYY-MM-DD HH:mm`). */
function formatOvernightOngoingLabel(leaveDate?: string, leaveTime?: string): string {
	const d = toYmd(leaveDate || '');
	const t = padTime5(leaveTime || '');
	if (d && t) return `외박중 ${d} ${t}`;
	if (d) return `외박중 ${d}`;
	if (t) return `외박중 ${t}`;
	return '외박중';
}

/**
 * 그리드/인쇄용 외출·입퇴소 표시 문자열을 만듭니다.
 * 입·퇴소일 → 외박중 → 복귀 → GYN 라벨 순으로 우선합니다.
 */
function gynDisplayText(row: PerformanceData, dateYmd?: string): string {
	const day = toYmd(dateYmd || row.svdt || '');
	const { isAdmitDay, isDischargeDay } = getAdmitDischargeFlags(row, day);
	const parts: string[] = [];
	if (isAdmitDay) parts.push(row.admitTime ? `금일 입소 ${row.admitTime}` : '금일 입소');
	if (isDischargeDay) parts.push(row.dischargeTime ? `금일 퇴소 ${row.dischargeTime}` : '금일 퇴소');
	if (parts.length) return parts.join(' / ');
	if (row.overnightOngoing) return formatOvernightOngoingLabel(row.overnightLeaveDate, row.overnightLeaveTime);
	if (row.returnTime) return `복귀 ${row.returnTime}`;
	return gynLabel(row.gyn);
}

/**
 * `/api/f14020` 목록 행을 {@link PerformanceData}로 매핑합니다.
 *
 * @param item - F14020(+수급자명) API 레코드
 * @param index - 0-based 인덱스 (화면 id/serialNo 생성)
 *
 * @remarks
 * PAY_COM_GU는 DB 값 대신 {@link calcPayComGu}로 재계산합니다.
 * 입·퇴소 12시간 50% DB 값이 화면/재저장 시 무시될 수 있습니다.
 */
function mapApiItemToPerformance(item: any, index: number): PerformanceData {
	const times = parseIoTmInfo(item.IO_TM_INFO);
	const gyn = String(item.GYN ?? '0').trim();
	// 외출/외박/복귀는 신규칙으로 표시 (기존 DB 12시간 규칙 잔존값 무시)
	const payComGu = calcPayComGu(gyn, times.start, times.end, times.returnTime);
	const overnightOngoing = !!times.overnightOngoing && gyn === '2';
	return {
		id: index + 1,
		serialNo: Number(item.MENUM) || index + 1,
		name: item.P_NM || '',
		birthDate: '',
		ancd: item.ANCD || '',
		pnum: item.PNUM || '',
		svdt: toYmd(item.SVDT),
		admitDate: toYmd(item.P_SDT),
		admitTime: toHm(item.P_SDT_TM),
		dischargeDate: toYmd(item.P_EDT),
		dischargeTime: toHm(item.P_EDT_TM),
		mealLocation: item.ST_PLAC || '',
		mealType: String(item.PH_MEAL_KIND || item.ST_KIND || '1').trim() || '1',
		gyn,
		gynStartTime: times.start,
		gynEndTime: times.end,
		returnTime: times.returnTime,
		payComGu,
		overnightOngoing,
		overnightLeaveDate: overnightOngoing ? times.overnightLeaveDate || '' : '',
		overnightLeaveTime: overnightOngoing ? times.start || '' : '',
		mealStatus: {
			breakfast: item.MOST || '1',
			lunch: item.LCST || '1',
			dinner: item.DNST || '1'
		},
		specialNotes: item.ST_ETC || '',
		snackStatus: {
			morning: item.MGST || '1',
			afternoon: item.AGST || '1',
			evening: item.DGST || '1'
		}
	};
}

/**
 * 행 저장용 POST body 조각을 만듭니다 (`/api/f14020` MERGE 입력).
 * 외박중이면 gyn=2, payComGu=1, IO=`ON:...` 으로 고정합니다.
 *
 * @param r - 편집 중인 실적 행
 * @returns pnum, 식사/간식, gyn, payComGu, ioTmInfo 등
 */
function buildMealSavePayload(r: PerformanceData) {
	const mealKind = String(r.mealType || '1').trim() || '1';
	if (r.overnightOngoing) {
		return {
			pnum: r.pnum,
			mealLocation: r.mealLocation,
			mealType: mealKind,
			ST_KIND: mealKind,
			PH_MEAL_KIND: mealKind,
			gyn: '2',
			mealStatus: r.mealStatus,
			snackStatus: r.snackStatus,
			specialNotes: r.specialNotes,
			payComGu: '1',
			ioTmInfo: formatOvernightOngoingIoTmInfo(
				r.overnightLeaveDate || '',
				r.overnightLeaveTime || r.gynStartTime || ''
			),
		};
	}
	const isOuting = r.gyn === '0' || r.gyn === '2';
	const endTime = r.gyn === '2' ? '' : r.gynEndTime;
	const payComGu = calcPayComGu(r.gyn, r.gynStartTime, endTime, r.returnTime);
	const ioTmInfo = r.returnTime
		? formatIoTmInfo(r.gyn, '', '', r.returnTime)
		: isOuting
			? formatIoTmInfo(r.gyn, r.gynStartTime, endTime)
			: '';
	return {
		pnum: r.pnum,
		mealLocation: r.mealLocation,
		mealType: mealKind,
		ST_KIND: mealKind,
		PH_MEAL_KIND: mealKind,
		gyn: r.gyn,
		mealStatus: r.mealStatus,
		snackStatus: r.snackStatus,
		specialNotes: r.specialNotes,
		payComGu,
		ioTmInfo
	};
}

/**
 * 일 수급자급여실적 메인 화면.
 *
 * @description
 * - 일자 선택 후 수급자별 식사·외출·급여50% 그리드 편집
 * - 전체추가(generate), 외박복귀(returnFromOvernight), 인쇄
 * - 탭 재활성 시 {@link useTabRefresh}로 목록 재조회
 *
 * @remarks
 * 기본 일자는 `toISOString()`(UTC)을 사용합니다. KST 새벽에는 전날이 될 수 있습니다.
 */
export default function DailyBeneficiaryPerformance() {
	const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
	const [selectedMember, setSelectedMember] = useState<number | null>(null);
	const [nextId, setNextId] = useState(1);
	const [editingRowId, setEditingRowId] = useState<number | null>(null);
	const [editingBackup, setEditingBackup] = useState<PerformanceData | null>(null);
	const [searchResults, setSearchResults] = useState<{ [key: number | string]: any[] }>({});
	const [showSearchResults, setShowSearchResults] = useState<{ [key: number | string]: boolean }>({});
	const searchInputRefs = useRef<{ [key: number | string]: HTMLInputElement | null }>({});
	/** 행 수급자명 검색 드롭다운 위치 (table sticky/overflow 클립 방지용 Portal) */
	const [rowSearchDropdownLayout, setRowSearchDropdownLayout] = useState<{
		rowId: number;
		top: number;
		left: number;
		width: number;
	} | null>(null);
	const [loading, setLoading] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;
	const printWindowRef = useRef<Window | null>(null);
	
	// 수급자별 출력 모달 상태
	const [showMemberPrintModal, setShowMemberPrintModal] = useState(false);
	const [selectedMemberForPrint, setSelectedMemberForPrint] = useState<any>(null);
	const [memberSearchTerm, setMemberSearchTerm] = useState('');
	const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
	const [showMemberSearchResults, setShowMemberSearchResults] = useState(false);
	const memberSearchInputRef = useRef<HTMLInputElement | null>(null);
	const memberPrintModalBodyRef = useRef<HTMLDivElement | null>(null);
	const [memberSearchDropdownLayout, setMemberSearchDropdownLayout] = useState<{
		top: number;
		left: number;
		width: number;
	} | null>(null);
	const printSearchRequestIdRef = useRef(0);
	const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
	const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
	const [memberPrintData, setMemberPrintData] = useState<PerformanceData[]>([]);
	const [loadingMemberData, setLoadingMemberData] = useState(false);
	const [printingMonthly, setPrintingMonthly] = useState(false);
	const [bulkAdding, setBulkAdding] = useState(false);
	const [showOvernightReturnModal, setShowOvernightReturnModal] = useState(false);
	const [overnightPendingList, setOvernightPendingList] = useState<OvernightPendingItem[]>([]);
	const [loadingOvernightPending, setLoadingOvernightPending] = useState(false);
	const [savingOvernightReturn, setSavingOvernightReturn] = useState(false);

	// 날짜 변경 함수
	const handleDateChange = (days: number) => {
		const date = new Date(selectedDate);
		date.setDate(date.getDate() + days);
		setSelectedDate(date.toISOString().split('T')[0]);
	};

	// 통합 데이터: 수급자 정보 + 실적 정보
	const [combinedData, setCombinedData] = useState<PerformanceData[]>([]);

	// F14020 데이터 조회 함수
	const fetchPerformanceData = async (
		svdt: string,
		opts?: { preservePnum?: string | null }
	) => {
		setLoading(true);
		try {
			// 날짜 형식 확인 및 정규화 (yyyy-mm-dd 형식 보장)
			let normalizedDate = svdt;
			if (svdt && !svdt.includes('-') && svdt.length === 8) {
				// YYYYMMDD 형식인 경우 yyyy-mm-dd로 변환
				normalizedDate = `${svdt.substring(0, 4)}-${svdt.substring(4, 6)}-${svdt.substring(6, 8)}`;
			}
			
			// yyyy-mm-dd 형식 검증
			if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
				console.error('날짜 형식 오류:', normalizedDate);
				setLoading(false);
				return;
			}
			
			const url = `/api/f14020?svdt=${encodeURIComponent(normalizedDate)}`;
			const response = await fetch(url);
			const result = await response.json();
			
			if (result.success && Array.isArray(result.data)) {
				// F14020 데이터를 combinedData 형식으로 변환
				let transformedData: PerformanceData[] = result.data.map((item: any, index: number) => {
					const row = mapApiItemToPerformance(item, index);
					return { ...row, birthDate: formatDate(item.P_BRDT) };
				});

				// 수급자명 가나다순(오름차순) 정렬 후 연번 재부여
				transformedData = transformedData
					.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
					.map((row, idx) => ({ ...row, id: idx + 1, serialNo: idx + 1 }));
				
				setCombinedData(transformedData);
				setNextId(transformedData.length > 0 ? Math.max(...transformedData.map(d => d.id)) + 1 : 1);
				setEditingRowId(null);
				setEditingBackup(null);
				// 탭 재조회 시 선택 수급자 유지 (id는 재부여되므로 pnum 기준)
				if (opts?.preservePnum != null && opts.preservePnum !== '') {
					const match = transformedData.find(
						(r) => String(r.pnum ?? '').trim() === String(opts.preservePnum).trim()
					);
					setSelectedMember(match ? match.id : null);
				}
			} else {
				setCombinedData([]);
				setNextId(1);
				setEditingRowId(null);
				setEditingBackup(null);
				if (opts?.preservePnum != null) setSelectedMember(null);
			}
		} catch (err) {
			console.error('실적 데이터 조회 오류:', err);
			setCombinedData([]);
			setNextId(1);
			setEditingRowId(null);
			setEditingBackup(null);
			if (opts?.preservePnum != null) setSelectedMember(null);
		} finally {
			setLoading(false);
		}
	};

	// 초기 로드 및 날짜 변경 시 데이터 조회
	useEffect(() => {
		setCurrentPage(1); // 날짜 변경 시 페이지를 1로 초기화
		fetchPerformanceData(selectedDate);
	}, [selectedDate]);

	// 탭 재활성화: 선택 날짜·수급자는 유지하고 F14020(간식상태 등)만 재조회
	useTabRefresh(() => {
		const prevPnum =
			selectedMember != null
				? combinedData.find((r) => r.id === selectedMember)?.pnum
				: null;
		void fetchPerformanceData(selectedDate, {
			preservePnum: prevPnum != null ? String(prevPnum) : null
		});
	});

	// 새로고침 시 경고 얼럿
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			// 수정 중인 행이 있는 경우 경고
			if (editingRowId !== null) {
				e.preventDefault();
				e.returnValue = '작성한 내용은 저장되지 않습니다.';
				return '작성한 내용은 저장되지 않습니다.';
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	}, [editingRowId]);

	// 행 삭제: DB(F14020) 삭제 후 화면 반영 (미저장 신규 행은 로컬만 제거)
	const handleDeleteRow = async (id: number) => {
		if (!confirm('정말 삭제하시겠습니까?')) return;

		const row = combinedData.find((r) => r.id === id);
		if (!row) return;

		const removeLocal = () => {
			setCombinedData((prev) => prev.filter((r) => r.id !== id));
			if (editingRowId === id) {
				setEditingRowId(null);
				setEditingBackup(null);
			}
			if (selectedMember === id) setSelectedMember(null);
		};

		const pnum = String(row.pnum ?? '').trim();
		// 수급자 미선택 신규 행 → DB에 없으므로 화면만 제거
		if (!pnum) {
			removeLocal();
			return;
		}

		const svdt = String(row.svdt || selectedDate || '').trim();
		if (!svdt) {
			alert('삭제할 일자가 없습니다.');
			return;
		}

		try {
			const res = await fetch(
				`/api/f14020?pnum=${encodeURIComponent(pnum)}&svdt=${encodeURIComponent(svdt)}`,
				{ method: 'DELETE' }
			);
			const json = await res.json();
			if (!json?.success) {
				alert(`삭제 실패: ${json?.error || '알 수 없는 오류'}`);
				return;
			}
			removeLocal();
		} catch (e) {
			console.error('삭제 오류:', e);
			alert('삭제 중 오류가 발생했습니다.');
		}
	};

	// 수정 취소: 진입 시점 값으로 복원
	const handleCancelEdit = (id: number) => {
		if (editingBackup && editingBackup.id === id) {
			setCombinedData((prev) => prev.map((r) => (r.id === id ? editingBackup : r)));
		}
		setEditingRowId(null);
		setEditingBackup(null);
		setShowSearchResults((prev) => ({ ...prev, [id]: false }));
		setSearchResults((prev) => ({ ...prev, [id]: [] }));
	};

	// 수정 모드 토글 (+ 저장 시 F14020 업서트)
	const handleEditClick = async (id: number) => {
		if (editingRowId === id) {
			const row = combinedData.find((r) => r.id === id);
			if (!row) {
				setEditingRowId(null);
				setEditingBackup(null);
				return;
			}
			if (!row.pnum) {
				alert('수급자를 선택해주세요.');
				return;
			}
			if (row.gyn === '0' && (!row.gynStartTime || !row.gynEndTime)) {
				alert('외출 시 시작·종료 시간을 입력해주세요.');
				return;
			}
			if (row.gyn === '2' && !row.gynStartTime) {
				alert('외박 시 나간 시간을 입력해주세요.');
				return;
			}
			const payload = buildMealSavePayload(row);
			try {
				const saveRes = await fetch('/api/f14020', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ svdt: selectedDate, rows: [payload] })
				});
				const saveJson = await saveRes.json();
				if (!saveJson?.success) {
					alert(`저장 실패: ${saveJson?.error || '알 수 없는 오류'}`);
					return;
				}
				setCombinedData((prev) =>
					prev.map((r) =>
						r.id === id
							? {
									...r,
									payComGu: payload.payComGu,
									gynStartTime: row.gyn === '0' || row.gyn === '2' ? r.gynStartTime : '',
									gynEndTime: row.gyn === '0' ? r.gynEndTime : '',
									returnTime: row.returnTime || ''
								}
							: r
					)
				);
				setEditingRowId(null);
				setEditingBackup(null);
				alert('저장되었습니다');
			} catch (e) {
				console.error('저장 오류:', e);
				alert('저장 중 오류가 발생했습니다.');
			}
		} else {
			const row = combinedData.find((r) => r.id === id);
			if (row) {
				setEditingBackup(JSON.parse(JSON.stringify(row)) as PerformanceData);
			} else {
				setEditingBackup(null);
			}
			setEditingRowId(id);
		}
	};

	// 페이지네이션 계산
	const totalPages = Math.ceil(combinedData.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const currentData = combinedData.slice(startIndex, endIndex);

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	// 행 추가 함수
	const handleAddRow = () => {
		const newRow: PerformanceData = {
			id: nextId,
			serialNo: 1, // 새 행은 항상 1번
			name: '',
			birthDate: '',
			mealLocation: '',
			mealType: '1',
			gyn: '1', // 기본값: 입원
			gynStartTime: '',
			gynEndTime: '',
			returnTime: '',
			payComGu: '0',
			mealStatus: { breakfast: '1', lunch: '1', dinner: '1' }, // 기본값: 양호
			specialNotes: '',
			snackStatus: { morning: '1', afternoon: '1', evening: '1' } // 기본값: 양호
		};

		// 기존 데이터들의 연번을 하나씩 증가 (한 칸씩 뒤로 밀기)
		const updatedData = combinedData.map(row => ({
			...row,
			serialNo: Number(row.serialNo) + 1
		}));

		setCombinedData([newRow, ...updatedData]); // 맨 위에 추가
		setNextId(prev => prev + 1);
		setEditingRowId(newRow.id); // 새로 추가된 행을 수정 모드로 설정
		setEditingBackup(JSON.parse(JSON.stringify(newRow)) as PerformanceData);
		setCurrentPage(1); // 첫 페이지로 이동
	};

	const applyGynChange = (rowId: number, nextGyn: string) => {
		setCombinedData((prev) =>
			prev.map((r) => {
				if (r.id !== rowId) return r;
				const gyn = nextGyn;
				const gynStartTime = gyn === '0' || gyn === '2' ? r.gynStartTime : '';
				const gynEndTime = gyn === '0' ? r.gynEndTime : '';
				const returnTime = '';
				return {
					...r,
					gyn,
					gynStartTime,
					gynEndTime,
					returnTime,
					payComGu: calcPayComGu(gyn, gynStartTime, gynEndTime, returnTime)
				};
			})
		);
	};

	const applyGynTimeChange = (rowId: number, field: 'gynStartTime' | 'gynEndTime', value: string) => {
		setCombinedData((prev) =>
			prev.map((r) => {
				if (r.id !== rowId) return r;
				const next = { ...r, [field]: value };
				return {
					...next,
					payComGu: calcPayComGu(next.gyn, next.gynStartTime, next.gynEndTime, next.returnTime)
				};
			})
		);
	};

	const formatOvernightAlertNames = (list: any[]) => {
		const names = (list || [])
			.map((x) => String(x.P_NM || '').trim())
			.filter(Boolean);
		if (names.length === 0) return '';
		if (names.length <= 10) return names.join(', ');
		return `${names.slice(0, 10).join(', ')} 외 ${names.length - 10}명`;
	};

	// 전체추가: Usp_P14020으로 해당일자 출석부(및 약물/목욕) 일괄 생성
	const handleBulkAddAdmittedMembers = async () => {
		if (bulkAdding) return;
		setBulkAdding(true);
		try {
			const saveRes = await fetch('/api/f14020', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'generate',
					svdt: selectedDate
				})
			});
			const saveJson = await saveRes.json();
			if (!saveJson?.success) {
				alert(`전체추가 실패: ${saveJson?.error || '알 수 없는 오류'}`);
				return;
			}

			await fetchPerformanceData(selectedDate);

			const pending = Array.isArray(saveJson.overnightPending) ? saveJson.overnightPending : [];
			if (pending.length > 0) {
				alert(
					`전체추가 완료\n\n외박 중인 수급자 ${pending.length}명 (복귀 처리 필요):\n${formatOvernightAlertNames(pending)}`
				);
			} else {
				alert('전체추가 완료 (이미 있는 자료는 유지하고 없는 수급자만 추가)');
			}
		} catch (e) {
			console.error('전체추가 오류:', e);
			alert('전체추가 중 오류가 발생했습니다.');
		} finally {
			setBulkAdding(false);
		}
	};

	const handleOpenOvernightReturnModal = async () => {
		setShowOvernightReturnModal(true);
		setLoadingOvernightPending(true);
		setOvernightPendingList([]);
		try {
			const res = await fetch(
				`/api/f14020?svdt=${encodeURIComponent(selectedDate)}&overnightPending=1`
			);
			const json = await res.json();
			if (!json?.success || !Array.isArray(json.data)) {
				alert(json?.error || '외박 수급자 목록을 조회할 수 없습니다.');
				return;
			}
			setOvernightPendingList(
				json.data.map((row: any) => ({
					ANCD: row.ANCD,
					PNUM: row.PNUM,
					P_NM: row.P_NM || '',
					P_BRDT: row.P_BRDT || '',
					PREV_SVDT: row.PREV_SVDT,
					PREV_IO_TM_INFO: row.PREV_IO_TM_INFO || '',
					returnTime: '',
					selected: false
				}))
			);
		} catch (e) {
			console.error('외박 대기 목록 조회 오류:', e);
			alert('외박 수급자 목록 조회 중 오류가 발생했습니다.');
		} finally {
			setLoadingOvernightPending(false);
		}
	};

	const handleCloseOvernightReturnModal = () => {
		if (savingOvernightReturn) return;
		setShowOvernightReturnModal(false);
		setOvernightPendingList([]);
	};

	const handleSaveOvernightReturn = async () => {
		const targets = overnightPendingList.filter((x) => x.selected);
		if (targets.length === 0) {
			alert('복귀 처리할 수급자를 선택해주세요.');
			return;
		}
		const missing = targets.filter((x) => !x.returnTime);
		if (missing.length > 0) {
			alert(`복귀 시간을 입력해주세요: ${missing.map((x) => x.P_NM || x.PNUM).join(', ')}`);
			return;
		}

		setSavingOvernightReturn(true);
		try {
			const res = await fetch('/api/f14020', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'returnFromOvernight',
					svdt: selectedDate,
					rows: targets.map((x) => ({
						pnum: x.PNUM,
						returnTime: x.returnTime
					}))
				})
			});
			const json = await res.json();
			if (!json?.success) {
				alert(`복귀 처리 실패: ${json?.error || '알 수 없는 오류'}`);
				return;
			}
			const okCount = Number(json.count || 0);
			await fetchPerformanceData(selectedDate);
			setShowOvernightReturnModal(false);
			setOvernightPendingList([]);
			alert(`외박 복귀 처리 완료 (${okCount}명)`);
		} catch (e) {
			console.error('외박 복귀 저장 오류:', e);
			alert('외박 복귀 처리 중 오류가 발생했습니다.');
		} finally {
			setSavingOvernightReturn(false);
		}
	};

	// 수급자 검색 함수
	const handleSearchMember = async (rowId: number, searchValue: string) => {
		if (!searchValue || searchValue.trim().length < 1) {
			setSearchResults(prev => ({ ...prev, [rowId]: [] }));
			setShowSearchResults(prev => ({ ...prev, [rowId]: false }));
			return;
		}

		try {
			const response = await fetch(`/api/f10010/search?q=${encodeURIComponent(searchValue.trim())}`);
			if (!response.ok) {
				throw new Error('검색 요청 실패');
			}
			const data = await response.json();
			
			if (data.success && data.data) {
				setSearchResults(prev => ({ ...prev, [rowId]: data.data }));
				setShowSearchResults(prev => ({ ...prev, [rowId]: data.data.length > 0 }));
			} else {
				setSearchResults(prev => ({ ...prev, [rowId]: [] }));
				setShowSearchResults(prev => ({ ...prev, [rowId]: false }));
			}
		} catch (error) {
			console.error('수급자 검색 오류:', error);
			setSearchResults(prev => ({ ...prev, [rowId]: [] }));
			setShowSearchResults(prev => ({ ...prev, [rowId]: false }));
		}
	};

	// 날짜 형식 변환 함수 (yyyy-mm-dd)
	const formatDate = (dateStr: string | null | undefined): string => {
		if (!dateStr) return '';
		
		// 이미 yyyy-mm-dd 형식이면 그대로 반환
		if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
			return dateStr;
		}
		
		// 날짜 객체로 변환 시도
		try {
			const date = new Date(dateStr);
			if (!isNaN(date.getTime())) {
				const year = date.getFullYear();
				const month = String(date.getMonth() + 1).padStart(2, '0');
				const day = String(date.getDate()).padStart(2, '0');
				return `${year}-${month}-${day}`;
			}
		} catch (e) {
			console.error('날짜 변환 오류:', e);
		}
		
		// 변환 실패 시 원본 반환
		return dateStr;
	};

	// API SVDT → yyyy-mm-dd (월 출력 시 일자별 그룹용)
	const normalizeSvdtToYmd = (svdt: unknown): string => {
		if (svdt == null || svdt === '') return '';
		const s = String(svdt).trim();
		if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
		const digits = s.replace(/\D/g, '');
		if (digits.length >= 8) {
			return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
		}
		return formatDate(s);
	};

	const PERFORMANCE_PRINT_STYLES = `
					@page {
						size: A4;
						margin: 10mm;
					}
					body {
						font-family: 'Malgun Gothic', sans-serif;
						font-size: 11pt;
						margin: 0;
						padding: 0;
					}
					.print-section {
						page-break-after: always;
					}
					.print-section:last-of-type {
						page-break-after: auto;
					}
					.header {
						display: grid;
						grid-template-columns: minmax(0, 1fr) minmax(0, 2.2fr) minmax(0, 1fr);
						align-items: start;
						column-gap: 12px;
						margin-bottom: 15px;
					}
					.date-info {
						font-size: 11pt;
						justify-self: start;
						text-align: left;
					}
					.title {
						font-size: 18pt;
						font-weight: bold;
						text-align: center;
						justify-self: center;
						width: 100%;
					}
					.header-sign {
						justify-self: end;
					}
					.signature-table {
						border: 1px solid #000;
						border-collapse: collapse;
						width: 150px;
						font-size: 10pt;
					}
					.signature-table th,
					.signature-table td {
						border: 1px solid #000;
						padding: 5px;
						text-align: center;
						height: 30px;
					}
					.main-table {
						width: 100%;
						border-collapse: collapse;
						border: 1px solid #000;
						font-size: 10pt;
						margin-top: 10px;
					}
					.main-table th,
					.main-table td {
						border: 1px solid #000;
						padding: 4px;
						text-align: center;
					}
					.main-table th {
						background-color: #f0f0f0;
						font-weight: bold;
					}
					.check-mark {
						text-align: center;
						font-size: 14pt;
					}
					.footer {
						display: flex;
						justify-content: space-between;
						margin-top: 20px;
						font-size: 10pt;
					}
					@media print {
						body {
							margin: 0;
							padding: 0;
						}
					}
	`;

	const buildPerformanceTableRowsHtml = (rows: PerformanceData[]) => {
		if (rows.length === 0) {
			return '<tr><td colspan="10" style="text-align:center">해당 일자 데이터 없음</td></tr>';
		}
		return rows
			.map((row) => {
				const gynText = gynDisplayText(row, row.svdt || selectedDate);
				const breakfast = row.mealStatus.breakfast === '1' ? '○' : '';
				const lunch = row.mealStatus.lunch === '1' ? '○' : '';
				const dinner = row.mealStatus.dinner === '1' ? '○' : '';
				const morningSnack = row.snackStatus.morning === '1' ? '○' : '';
				const afternoonSnack = row.snackStatus.afternoon === '1' ? '○' : '';
				const eveningSnack = row.snackStatus.evening === '1' ? '○' : '';
				const mealTypeText = mealKindLabel(row.mealType);

				return `
								<tr>
									<td>${row.name || ''}</td>
									<td>${row.birthDate || ''}</td>
									<td>${gynText}</td>
									<td class="check-mark">${breakfast}</td>
									<td class="check-mark">${lunch}</td>
									<td class="check-mark">${dinner}</td>
									<td class="check-mark">${morningSnack}</td>
									<td class="check-mark">${afternoonSnack}</td>
									<td class="check-mark">${eveningSnack}</td>
									<td>${mealTypeText}</td>
								</tr>
							`;
			})
			.join('');
	};

	const buildPerformancePrintSectionHtml = (formattedDate: string, rows: PerformanceData[]) => {
		return `
			<div class="print-section">
				<div class="header">
					<div class="date-info">일자: ${formattedDate}</div>
					<div class="title">수급자급여실적</div>
					<div class="header-sign">
					<table class="signature-table">
						<tr>
							<th>담당</th>
							<th>검토</th>
							<th>결재</th>
						</tr>
						<tr>
							<td></td>
							<td></td>
							<td></td>
						</tr>
					</table>
					</div>
				</div>
				<table class="main-table">
					<thead>
						<tr>
							<th>수급자명</th>
							<th>생일</th>
							<th>입원/외출/외박</th>
							<th>아침</th>
							<th>점심</th>
							<th>저녁</th>
							<th>오전간식</th>
							<th>오후간식</th>
							<th>저녁간식</th>
							<th>식이</th>
						</tr>
					</thead>
					<tbody>
						${buildPerformanceTableRowsHtml(rows)}
					</tbody>
				</table>
				<div class="footer">
					<div>R14020</div>
					<div>페이지: 1</div>
				</div>
			</div>
		`;
	};

	// 일자별 출력 함수
	const handlePrintDaily = () => {
		// 데이터가 없는 경우 알림 표시
		if (!combinedData || combinedData.length === 0) {
			alert('출력할 데이터가 없습니다.');
			return;
		}

		// 날짜 포맷팅 (요일 포함)
		const date = new Date(selectedDate + 'T12:00:00');
		const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
		const dayName = days[date.getDay()];
		const formattedDate = `${selectedDate} ${dayName}`;

		const printContent = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>수급자급여실적</title>
				<style>${PERFORMANCE_PRINT_STYLES}</style>
			</head>
			<body>
				${buildPerformancePrintSectionHtml(formattedDate, combinedData)}
			</body>
			</html>
		`;

		// 새 창 열기
		const printWindow = window.open('', '_blank');
		if (printWindow) {
			printWindow.document.write(printContent);
			printWindow.document.close();
			
			// 출력 대화상자 열기
			setTimeout(() => {
				printWindow.print();
			}, 250);
		}
	};

	// 월식사상태 출력: 선택된 날짜가 속한 달의 전체 일자 조회 후 일자별 출력 폼과 동일하게 출력
	const handlePrintMonthly = async () => {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
			alert('날짜를 먼저 선택해주세요.');
			return;
		}

		const [yStr, mStr] = selectedDate.split('-');
		const y = Number(yStr);
		const m = Number(mStr);
		const monthStart = `${yStr}-${mStr}-01`;
		const lastDay = new Date(y, m, 0).getDate();
		const monthEnd = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`;

		setPrintingMonthly(true);
		try {
			const url = `/api/f14020?startDate=${encodeURIComponent(monthStart)}&endDate=${encodeURIComponent(monthEnd)}`;
			const response = await fetch(url);
			const result = await response.json();

			if (!result.success || !Array.isArray(result.data)) {
				alert('데이터를 조회할 수 없습니다.');
				return;
			}

			if (result.data.length === 0) {
				alert('해당 월에 출력할 데이터가 없습니다.');
				return;
			}

			const byDate = new Map<string, PerformanceData[]>();
			result.data.forEach((item: any, index: number) => {
				const d = normalizeSvdtToYmd(item.SVDT);
				if (!d) return;
				const row: PerformanceData = {
					...mapApiItemToPerformance(item, index),
					birthDate: formatDate(item.P_BRDT)
				};
				if (!byDate.has(d)) byDate.set(d, []);
				byDate.get(d)!.push(row);
			});

			const weekdayLabels = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
			const sectionsHtml: string[] = [];
			for (let d = 1; d <= lastDay; d++) {
				const dateStr = `${yStr}-${mStr}-${String(d).padStart(2, '0')}`;
				const dateObj = new Date(y, m - 1, d);
				const dayName = weekdayLabels[dateObj.getDay()];
				const formatted = `${dateStr} ${dayName}`;
				const rows = byDate.get(dateStr) ?? [];
				sectionsHtml.push(buildPerformancePrintSectionHtml(formatted, rows));
			}

			const printContent = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>수급자급여실적 (${yStr}년 ${mStr}월)</title>
				<style>${PERFORMANCE_PRINT_STYLES}</style>
			</head>
			<body>
				${sectionsHtml.join('')}
			</body>
			</html>
		`;

			const printWindow = window.open('', '_blank');
			if (printWindow) {
				printWindow.document.write(printContent);
				printWindow.document.close();
				setTimeout(() => {
					printWindow.print();
				}, 250);
			}
		} catch (e) {
			console.error('월 식사상태 출력 조회 오류:', e);
			alert('월 데이터 조회 중 오류가 발생했습니다.');
		} finally {
			setPrintingMonthly(false);
		}
	};

	// 수급자별 출력 모달 열기
	const handleOpenMemberPrintModal = () => {
		setShowMemberPrintModal(true);
		setSelectedMemberForPrint(null);
		setMemberSearchTerm('');
		setMemberSearchResults([]);
		setShowMemberSearchResults(false);
		setMemberSearchDropdownLayout(null);
		setStartDate(new Date().toISOString().split('T')[0]);
		setEndDate(new Date().toISOString().split('T')[0]);
	};

	// 수급자별 출력 모달 닫기
	const handleCloseMemberPrintModal = () => {
		setShowMemberPrintModal(false);
		setSelectedMemberForPrint(null);
		setMemberSearchTerm('');
		setMemberSearchResults([]);
		setShowMemberSearchResults(false);
		setMemberSearchDropdownLayout(null);
		setMemberPrintData([]);
	};

	// 수급자 검색 (모달용) — overflow에 잘리지 않도록 Portal + 레이스 방지
	const handleSearchMemberForPrint = async (searchValue: string) => {
		if (!searchValue || searchValue.trim().length < 1) {
			printSearchRequestIdRef.current += 1;
			setMemberSearchResults([]);
			setShowMemberSearchResults(false);
			return;
		}

		const requestId = ++printSearchRequestIdRef.current;

		try {
			const response = await fetch(`/api/f10010/search?q=${encodeURIComponent(searchValue.trim())}`);
			if (!response.ok) {
				throw new Error('검색 요청 실패');
			}
			const data = await response.json();

			if (requestId !== printSearchRequestIdRef.current) {
				return;
			}

			if (data.success && Array.isArray(data.data)) {
				setMemberSearchResults(data.data);
				setShowMemberSearchResults(data.data.length > 0);
			} else {
				setMemberSearchResults([]);
				setShowMemberSearchResults(false);
			}
		} catch (error) {
			console.error('수급자 검색 오류:', error);
			if (requestId !== printSearchRequestIdRef.current) {
				return;
			}
			setMemberSearchResults([]);
			setShowMemberSearchResults(false);
		}
	};

	// 모달 수급자 검색 드롭다운 위치 (overflow 클립 방지: body Portal + fixed)
	useLayoutEffect(() => {
		if (!showMemberSearchResults || memberSearchResults.length === 0) {
			setMemberSearchDropdownLayout(null);
			return;
		}

		const updateLayout = () => {
			const el = memberSearchInputRef.current;
			if (!el) {
				setMemberSearchDropdownLayout(null);
				return;
			}
			const r = el.getBoundingClientRect();
			setMemberSearchDropdownLayout({
				top: r.bottom,
				left: r.left,
				width: r.width
			});
		};

		updateLayout();

		const onScrollOrResize = () => updateLayout();
		window.addEventListener('scroll', onScrollOrResize, true);
		window.addEventListener('resize', onScrollOrResize);
		const scrollParent = memberPrintModalBodyRef.current;
		if (scrollParent) {
			scrollParent.addEventListener('scroll', onScrollOrResize);
		}

		return () => {
			window.removeEventListener('scroll', onScrollOrResize, true);
			window.removeEventListener('resize', onScrollOrResize);
			if (scrollParent) {
				scrollParent.removeEventListener('scroll', onScrollOrResize);
			}
		};
	}, [showMemberSearchResults, memberSearchResults]);

	// 행 수급자명 검색 드롭다운 위치 (sticky 셀·가로스크롤에 가려지지 않도록 body Portal)
	useLayoutEffect(() => {
		const openRowId = Object.keys(showSearchResults)
			.map(Number)
			.find((id) => showSearchResults[id] && (searchResults[id]?.length ?? 0) > 0);

		if (openRowId == null || !Number.isFinite(openRowId)) {
			setRowSearchDropdownLayout(null);
			return;
		}

		const updateLayout = () => {
			const el = searchInputRefs.current[openRowId];
			if (!el) {
				setRowSearchDropdownLayout(null);
				return;
			}
			const r = el.getBoundingClientRect();
			setRowSearchDropdownLayout({
				rowId: openRowId,
				top: r.bottom + 2,
				left: r.left,
				width: Math.max(r.width, 200)
			});
		};

		updateLayout();
		const onScrollOrResize = () => updateLayout();
		window.addEventListener('scroll', onScrollOrResize, true);
		window.addEventListener('resize', onScrollOrResize);
		return () => {
			window.removeEventListener('scroll', onScrollOrResize, true);
			window.removeEventListener('resize', onScrollOrResize);
		};
	}, [showSearchResults, searchResults]);

	// 수급자 선택 (모달용)
	const handleSelectMemberForPrint = (member: any) => {
		setSelectedMemberForPrint(member);
		setMemberSearchTerm(member.P_NM || '');
		setShowMemberSearchResults(false);
		setMemberSearchResults([]);
	};

	// 수급자별 데이터 조회
	const handleLoadMemberData = async () => {
		if (!selectedMemberForPrint || !startDate || !endDate) {
			alert('수급자와 기간을 선택해주세요.');
			return;
		}

		if (startDate > endDate) {
			alert('시작일이 종료일보다 늦을 수 없습니다.');
			return;
		}

		setLoadingMemberData(true);
		try {
			// 한 번의 API 호출로 기간 내 모든 데이터 조회 (ANCD와 PNUM 모두 전달)
			const url = `/api/f14020?pnum=${encodeURIComponent(selectedMemberForPrint.PNUM)}&ancd=${encodeURIComponent(selectedMemberForPrint.ANCD || '')}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
			const response = await fetch(url);
			const result = await response.json();
			
			if (result.success && Array.isArray(result.data)) {
				// 데이터 변환
				let transformedData: PerformanceData[] = result.data.map((item: any, index: number) => ({
					...mapApiItemToPerformance(item, index),
					birthDate: formatDate(item.P_BRDT)
				}));

				// 출력 데이터도 수급자명 가나다순 정렬
				transformedData = transformedData.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
				
				setMemberPrintData(transformedData);
			} else {
				setMemberPrintData([]);
				alert('데이터를 조회할 수 없습니다.');
			}
		} catch (err) {
			console.error('수급자별 데이터 조회 오류:', err);
			alert('데이터 조회 중 오류가 발생했습니다.');
			setMemberPrintData([]);
		} finally {
			setLoadingMemberData(false);
		}
	};

	// 수급자별 출력
	const handlePrintMember = () => {
		if (memberPrintData.length === 0) {
			alert('출력할 데이터가 없습니다. 먼저 데이터를 조회해주세요.');
			return;
		}

		// 기간 정보
		const start = new Date(startDate);
		const end = new Date(endDate);
		const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
		const startDayName = days[start.getDay()];
		const endDayName = days[end.getDay()];
		const periodText = startDate === endDate 
			? `${startDate} ${startDayName}`
			: `${startDate} ${startDayName} ~ ${endDate} ${endDayName}`;

		// 출력용 HTML 생성
		const printContent = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="UTF-8">
				<title>수급자급여실적</title>
				<style>
					@page {
						size: A4;
						margin: 10mm;
					}
					body {
						font-family: 'Malgun Gothic', sans-serif;
						font-size: 11pt;
						margin: 0;
						padding: 0;
					}
					.header {
						display: grid;
						grid-template-columns: minmax(0, 1fr) minmax(0, 2.2fr) minmax(0, 1fr);
						align-items: start;
						column-gap: 12px;
						margin-bottom: 15px;
					}
					.date-info {
						font-size: 11pt;
						justify-self: start;
						text-align: left;
					}
					.title {
						font-size: 18pt;
						font-weight: bold;
						text-align: center;
						justify-self: center;
						width: 100%;
					}
					.header-sign {
						justify-self: end;
					}
					.signature-table {
						border: 1px solid #000;
						border-collapse: collapse;
						width: 150px;
						font-size: 10pt;
					}
					.signature-table th,
					.signature-table td {
						border: 1px solid #000;
						padding: 5px;
						text-align: center;
						height: 30px;
					}
					.main-table {
						width: 100%;
						border-collapse: collapse;
						border: 1px solid #000;
						font-size: 10pt;
						margin-top: 10px;
					}
					.main-table th,
					.main-table td {
						border: 1px solid #000;
						padding: 4px;
						text-align: center;
					}
					.main-table th {
						background-color: #f0f0f0;
						font-weight: bold;
					}
					.check-mark {
						text-align: center;
						font-size: 14pt;
					}
					.footer {
						display: flex;
						justify-content: space-between;
						margin-top: 20px;
						font-size: 10pt;
					}
					@media print {
						body {
							margin: 0;
							padding: 0;
						}
					}
				</style>
			</head>
			<body>
				<div class="header">
					<div class="date-info">일자: ${periodText}</div>
					<div class="title">수급자급여실적</div>
					<div class="header-sign">
					<table class="signature-table">
						<tr>
							<th>담당</th>
							<th>검토</th>
							<th>결재</th>
						</tr>
						<tr>
							<td></td>
							<td></td>
							<td></td>
						</tr>
					</table>
					</div>
				</div>
				<table class="main-table">
					<thead>
						<tr>
							<th>수급자명</th>
							<th>생일</th>
							<th>입원/외출/외박</th>
							<th>아</th>
							<th>정</th>
							<th>저</th>
							<th>오전간</th>
							<th>오후간</th>
							<th>저녁간</th>
							<th>식이</th>
						</tr>
					</thead>
					<tbody>
						${memberPrintData.map(row => {
							const gynText = gynDisplayText(row, row.svdt);
							const breakfast = row.mealStatus.breakfast === '1' ? '○' : '';
							const lunch = row.mealStatus.lunch === '1' ? '○' : '';
							const dinner = row.mealStatus.dinner === '1' ? '○' : '';
							const morningSnack = row.snackStatus.morning === '1' ? '○' : '';
							const afternoonSnack = row.snackStatus.afternoon === '1' ? '○' : '';
							const eveningSnack = row.snackStatus.evening === '1' ? '○' : '';
							const mealTypeText = mealKindLabel(row.mealType);

							return `
								<tr>
									<td>${row.name || ''}</td>
									<td>${row.birthDate || ''}</td>
									<td>${gynText}</td>
									<td class="check-mark">${breakfast}</td>
									<td class="check-mark">${lunch}</td>
									<td class="check-mark">${dinner}</td>
									<td class="check-mark">${morningSnack}</td>
									<td class="check-mark">${afternoonSnack}</td>
									<td class="check-mark">${eveningSnack}</td>
									<td>${mealTypeText}</td>
								</tr>
							`;
						}).join('')}
					</tbody>
				</table>
				<div class="footer">
					<div>R14020</div>
					<div>페이지: 1</div>
				</div>
			</body>
			</html>
		`;

		// 새 창 열기
		const printWindow = window.open('', '_blank');
		if (printWindow) {
			printWindow.document.write(printContent);
			printWindow.document.close();
			
			// 출력 대화상자 열기
			setTimeout(() => {
				printWindow.print();
			}, 250);
		}
	};

	// 수급자 선택 함수
	const handleSelectMember = (rowId: number, member: any) => {
		setCombinedData(prev => prev.map(row => {
			if (row.id === rowId) {
				return {
					...row,
					name: member.P_NM || '',
					birthDate: formatDate(member.P_BRDT),
					ancd: member.ANCD || '',
					pnum: member.PNUM || '',
					svdt: row.svdt || selectedDate,
					admitDate: toYmd(member.P_SDT),
					admitTime: toHm(member.P_SDT_TM),
					dischargeDate: toYmd(member.P_EDT),
					dischargeTime: toHm(member.P_EDT_TM),
				};
			}
			return row;
		}));
		setShowSearchResults(prev => ({ ...prev, [rowId]: false }));
		setSearchResults(prev => ({ ...prev, [rowId]: [] }));
	};

	return (
		<div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden bg-white text-black">
			<div className="mx-auto w-full max-w-full min-w-0 p-3 sm:p-4">
				{/* 상단: 날짜 네비게이션 */}
				<div className="mb-4 flex flex-col gap-3 border-b border-blue-200 pb-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
					{/* 날짜 네비게이션 */}
					<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 lg:flex-1">
						<button 
							onClick={() => handleDateChange(-1)}
							className="flex items-center gap-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-blue-100 hover:bg-blue-200 text-blue-900"
						>
							<span>◀</span>
							{/* <span>이전일</span> */}
						</button>
						<div className="flex items-center gap-2">
							<input
								type="date"
								value={selectedDate}
								onChange={(e) => setSelectedDate(e.target.value)}
								className="px-3 py-1.5 text-sm border border-blue-300 rounded bg-white text-blue-900"
							/>
						</div>
						<button 
							onClick={() => handleDateChange(1)}
							className="flex items-center gap-1 px-3 py-1.5 text-sm border border-blue-300 rounded bg-blue-100 hover:bg-blue-200 text-blue-900"
						>
							{/* <span>다음일</span> */}
							<span>▶</span>
						</button>
					</div>
					{/* 오른쪽 상단 버튼 */}
					<div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
						<button
							type="button"
							onClick={handleBulkAddAdmittedMembers}
							disabled={bulkAdding}
							className="px-4 py-1.5 text-sm border border-green-500 rounded bg-green-200 hover:bg-green-300 text-green-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{bulkAdding ? '전체추가 중...' : '전체추가'}
						</button>
						<button
							type="button"
							onClick={handleOpenOvernightReturnModal}
							disabled={loading || bulkAdding || savingOvernightReturn || combinedData.length === 0}
							className="px-4 py-1.5 text-sm border border-amber-500 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							외박 수급자 복귀 처리
						</button>
						<button
							type="button"
							onClick={handlePrintDaily}
							disabled={loading || combinedData.length === 0}
							className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							일자별 출력
						</button>
						<button
							type="button"
							onClick={handleOpenMemberPrintModal}
							disabled={loading || combinedData.length === 0}
							className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							수급자별 출력
						</button>
						<button
							type="button"
							onClick={handlePrintMonthly}
							disabled={loading || printingMonthly || combinedData.length === 0}
							className="px-4 py-1.5 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{printingMonthly ? '조회 중...' : '월식사상태 출력'}
						</button>
					</div>
				</div>

				{/* 통합 테이블: 수급자 목록 + 실적 등록 — 표 영역만 가로 스크롤 */}
				<div className="w-full max-w-full min-w-0 border border-blue-300 rounded-lg bg-white shadow-sm">
					<div className="bg-blue-100 border-b border-blue-300 px-4 py-2">
						<h2 className="text-lg font-semibold text-blue-900">일 수급자급여실적 등록</h2>
					</div>
					<div className="block w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain">
						<table className="text-sm min-w-[1400px] w-max max-w-none">
							<thead className="bg-blue-50 border-b border-blue-200 sticky top-0">
								<tr>
									<th className="sticky left-0 z-20 bg-blue-50 text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">연번</th>
									<th className="sticky left-10 z-20 bg-blue-50 text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 w-32">수급자명(생년월일)</th>
									<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 w-32">식사장소</th>
									<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 w-40">식사종류</th>
									<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 min-w-[320px]">입원/외출/외박</th>
									<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">식사상태</th>
									<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200">간식상태</th>
									<th className="text-center px-3 py-2 text-blue-900 font-semibold border-r border-blue-200 w-80">특이사항</th>
									<th className="text-center px-3 py-2 text-blue-900 font-semibold">작업</th>
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr>
										<td colSpan={9} className="text-center px-3 py-4 text-blue-900/60">
											로딩 중...
										</td>
									</tr>
								) : currentData.length === 0 ? (
									<tr>
										<td colSpan={9} className="text-center px-3 py-4 text-blue-900/60">
											데이터가 없습니다
										</td>
									</tr>
								) : (
									currentData.map((row) => {
									const { isAdmitDay, isDischargeDay, isAdmitOrDischargeDay } =
										getAdmitDischargeFlags(row, selectedDate);
									const isOvernightOngoing = !!row.overnightOngoing;
									return (
									<tr 
										key={row.id} 
										className={`border-b border-blue-50 ${
											isAdmitOrDischargeDay
												? 'bg-yellow-100 hover:bg-yellow-200'
												: isOvernightOngoing
													? 'bg-green-100 hover:bg-green-200'
													: selectedMember === row.id
														? 'bg-blue-100 hover:bg-blue-50'
														: 'hover:bg-blue-50'
										}`}
										onClick={() => setSelectedMember(row.id)}
									>
										{/* 연번 */}
										<td className="sticky left-0 z-10 bg-white text-center px-3 py-3 border-r border-blue-100">{row.serialNo}</td>
										{/* 수급자명(생년월일) */}
										<td className="sticky left-10 z-10 bg-white text-center px-3 py-3 border-r border-blue-100 relative w-32">
											<div className="flex flex-col">
												<input
													ref={(el) => {
														if (el) {
															searchInputRefs.current[row.id] = el;
														} else {
															delete searchInputRefs.current[row.id];
														}
													}}
													type="text"
													value={row.name || ''}
													placeholder="수급자명 검색"
													onChange={(e) => {
														const newData = combinedData.map(r => 
															r.id === row.id ? { ...r, name: e.target.value } : r
														);
														setCombinedData(newData);
														// 타이핑할 때마다 검색 실행 (수정 모드일 때만)
														if (editingRowId === row.id) {
															if (e.target.value.trim().length > 0) {
																handleSearchMember(row.id, e.target.value);
															} else {
																setSearchResults(prev => ({ ...prev, [row.id]: [] }));
																setShowSearchResults(prev => ({ ...prev, [row.id]: false }));
															}
														}
													}}
													disabled={editingRowId !== row.id}
													onClick={(e) => e.stopPropagation()}
													onFocus={() => {
														if (editingRowId === row.id && row.name && row.name.trim().length > 0) {
															handleSearchMember(row.id, row.name);
														}
													}}
													onBlur={() => {
														// 포커스를 잃을 때 약간의 지연 후 드롭다운 닫기
														setTimeout(() => {
															setShowSearchResults(prev => ({ ...prev, [row.id]: false }));
														}, 200);
													}}
													className={`w-full px-2 py-1 border border-blue-300 rounded ${
														editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
													}`}
												/>
												{row.birthDate && (
													<span className="text-xs text-gray-500 mt-1">({row.birthDate})</span>
												)}
											</div>
										</td>
										{/* 식사장소 */}
										<td className="text-center px-3 py-3 border-r border-blue-100 w-32">
											<input 
												type="text" 
												value={row.mealLocation}
												placeholder="식사장소 입력"
												onChange={(e) => {
													const newData = combinedData.map(r => 
														r.id === row.id ? { ...r, mealLocation: e.target.value } : r
													);
													setCombinedData(newData);
												}}
												disabled={editingRowId !== row.id}
												onClick={(e) => e.stopPropagation()}
												className={`w-full px-2 py-1 border border-blue-300 rounded ${
													editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
												}`}
											/>
										</td>
										{/* 식사종류 (PH_MEAL_KIND) */}
										<td className="text-center px-3 py-3 border-r border-blue-100 w-40">
											<select 
												value={row.mealType}
												onChange={(e) => {
													const newData = combinedData.map(r => 
														r.id === row.id ? { ...r, mealType: e.target.value } : r
													);
													setCombinedData(newData);
												}}
												disabled={editingRowId !== row.id}
												onClick={(e) => e.stopPropagation()}
												className={`w-full px-2 py-1 border border-blue-300 rounded ${
													editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
												}`}
											>
												{MEAL_KIND_OPTIONS.map((opt) => (
													<option key={opt.value} value={opt.value}>
														{opt.value}. {opt.label}
													</option>
												))}
											</select>
										</td>
										{/* 입원/외출/외박 (GYN) — 입·퇴소/외박중은 문구만 표시 */}
										<td className="text-center px-3 py-3 border-r border-blue-100 min-w-[320px]">
											<div className="flex flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
												{isAdmitOrDischargeDay ? (
													<>
														{isAdmitDay && (
															<div className="flex items-center gap-2 whitespace-nowrap">
																<span className="text-sm font-semibold text-amber-900">금일 입소</span>
																{row.admitTime ? (
																	<span className="text-sm text-amber-900 tabular-nums">{row.admitTime}</span>
																) : null}
															</div>
														)}
														{isDischargeDay && (
															<div className="flex items-center gap-2 whitespace-nowrap">
																<span className="text-sm font-semibold text-amber-900">금일 퇴소</span>
																{row.dischargeTime ? (
																	<span className="text-sm text-amber-900 tabular-nums">{row.dischargeTime}</span>
																) : null}
															</div>
														)}
													</>
												) : isOvernightOngoing ? (
													<div className="flex flex-col items-center gap-0.5">
														<span className="text-sm font-semibold text-green-900">
															{formatOvernightOngoingLabel(row.overnightLeaveDate, row.overnightLeaveTime)}
														</span>
													</div>
												) : (
													<>
														<div className="flex justify-center gap-1 flex-wrap">
															<label className={`flex items-center justify-center gap-1 ${editingRowId === row.id ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
																<input
																	type="checkbox"
																	checked={row.gyn === '0'}
																	onChange={(e) => applyGynChange(row.id, e.target.checked ? '0' : '')}
																	disabled={editingRowId !== row.id}
																	className={`${editingRowId === row.id ? "cursor-pointer" : "cursor-not-allowed"} ${editingRowId !== row.id && row.gyn === '0' ? "disabled-checked-blue" : ""}`}
																/>
																<span className="text-xs">외출</span>
															</label>
															<label className={`flex items-center justify-center gap-1 ${editingRowId === row.id ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
																<input
																	type="checkbox"
																	checked={row.gyn === '1'}
																	onChange={(e) => applyGynChange(row.id, e.target.checked ? '1' : '')}
																	disabled={editingRowId !== row.id}
																	className={`${editingRowId === row.id ? "cursor-pointer" : "cursor-not-allowed"} ${editingRowId !== row.id && row.gyn === '1' ? "disabled-checked-blue" : ""}`}
																/>
																<span className="text-xs">입원</span>
															</label>
															<label className={`flex items-center justify-center gap-1 ${editingRowId === row.id ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
																<input
																	type="checkbox"
																	checked={row.gyn === '2'}
																	onChange={(e) => applyGynChange(row.id, e.target.checked ? '2' : '')}
																	disabled={editingRowId !== row.id}
																	className={`${editingRowId === row.id ? "cursor-pointer" : "cursor-not-allowed"} ${editingRowId !== row.id && row.gyn === '2' ? "disabled-checked-blue" : ""}`}
																/>
																<span className="text-xs">외박</span>
															</label>
														</div>
														{row.gyn === '0' && (
															<div className="flex flex-col items-center gap-0.5">
																<div className="flex items-center gap-1 whitespace-nowrap">
																	<input
																		type="time"
																		value={row.gynStartTime || ''}
																		onChange={(e) => applyGynTimeChange(row.id, 'gynStartTime', e.target.value)}
																		disabled={editingRowId !== row.id}
																		className={`min-w-[9rem] w-[9rem] px-1 py-0.5 text-xs border border-blue-300 rounded ${
																			editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
																		}`}
																	/>
																	<span className="text-xs text-blue-900/70 shrink-0">~</span>
																	<input
																		type="time"
																		value={row.gynEndTime || ''}
																		onChange={(e) => applyGynTimeChange(row.id, 'gynEndTime', e.target.value)}
																		disabled={editingRowId !== row.id}
																		className={`min-w-[9rem] w-[9rem] px-1 py-0.5 text-xs border border-blue-300 rounded ${
																			editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
																		}`}
																	/>
																</div>
															</div>
														)}
														{row.gyn === '2' && (
															<div className="flex items-center gap-1 whitespace-nowrap">
																<span className="text-xs text-blue-900/70 shrink-0">나감</span>
																<input
																	type="time"
																	value={row.gynStartTime || ''}
																	onChange={(e) => applyGynTimeChange(row.id, 'gynStartTime', e.target.value)}
																	disabled={editingRowId !== row.id}
																	className={`min-w-[9rem] w-[9rem] px-1 py-0.5 text-xs border border-blue-300 rounded ${
																		editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
																	}`}
																/>
															</div>
														)}
														{row.gyn === '1' && row.returnTime && (
															<div className="flex items-center gap-1 whitespace-nowrap">
																<span className="text-xs text-blue-900/70 shrink-0">복귀</span>
																<span className="text-xs text-blue-900 font-medium">{row.returnTime}</span>
															</div>
														)}
													</>
												)}
												{row.payComGu === '1' && (
													<span className="text-xs font-semibold text-red-600">급여50%적용</span>
												)}
											</div>
										</td>
										{/* 식사상태 */}
										<td className="text-center px-3 py-3 border-r border-blue-100">
											<div className="flex justify-center gap-3" onClick={(e) => e.stopPropagation()}>
												<label className={`flex items-center gap-1 ${editingRowId === row.id ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
													<input 
														type="checkbox" 
														checked={row.mealStatus.breakfast === '1'}
														onChange={(e) => {
															const newData = combinedData.map(r => 
																r.id === row.id ? { ...r, mealStatus: { ...r.mealStatus, breakfast: e.target.checked ? '1' : '2' } } : r
															);
															setCombinedData(newData);
														}}
														disabled={editingRowId !== row.id}
														className={`${editingRowId === row.id ? "cursor-pointer" : "cursor-not-allowed"} ${editingRowId !== row.id && row.mealStatus.breakfast === '1' ? "disabled-checked-blue" : ""}`}
													/>
													<span className="text-xs">조</span>
												</label>
												<label className={`flex items-center gap-1 ${editingRowId === row.id ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
													<input 
														type="checkbox" 
														checked={row.mealStatus.lunch === '1'}
														onChange={(e) => {
															const newData = combinedData.map(r => 
																r.id === row.id ? { ...r, mealStatus: { ...r.mealStatus, lunch: e.target.checked ? '1' : '2' } } : r
															);
															setCombinedData(newData);
														}}
														disabled={editingRowId !== row.id}
														className={`${editingRowId === row.id ? "cursor-pointer" : "cursor-not-allowed"} ${editingRowId !== row.id && row.mealStatus.lunch === '1' ? "disabled-checked-blue" : ""}`}
													/>
													<span className="text-xs">중</span>
												</label>
												<label className={`flex items-center gap-1 ${editingRowId === row.id ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
													<input 
														type="checkbox" 
														checked={row.mealStatus.dinner === '1'}
														onChange={(e) => {
															const newData = combinedData.map(r => 
																r.id === row.id ? { ...r, mealStatus: { ...r.mealStatus, dinner: e.target.checked ? '1' : '2' } } : r
															);
															setCombinedData(newData);
														}}
														disabled={editingRowId !== row.id}
														className={`${editingRowId === row.id ? "cursor-pointer" : "cursor-not-allowed"} ${editingRowId !== row.id && row.mealStatus.dinner === '1' ? "disabled-checked-blue" : ""}`}
													/>
													<span className="text-xs">석</span>
												</label>
											</div>
										</td>
										{/* 간식상태 */}
										<td className="text-center px-3 py-3 border-r border-blue-100">
											<div className="flex justify-center gap-3" onClick={(e) => e.stopPropagation()}>
												<label className={`flex items-center gap-1 ${editingRowId === row.id ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
													<input 
														type="checkbox" 
														checked={row.snackStatus.morning === '1'}
														onChange={(e) => {
															const newData = combinedData.map(r => 
																r.id === row.id ? { ...r, snackStatus: { ...r.snackStatus, morning: e.target.checked ? '1' : '2' } } : r
															);
															setCombinedData(newData);
														}}
														disabled={editingRowId !== row.id}
														className={`${editingRowId === row.id ? "cursor-pointer" : "cursor-not-allowed"} ${editingRowId !== row.id && row.snackStatus.morning === '1' ? "disabled-checked-blue" : ""}`}
													/>
													<span className="text-xs">오전</span>
												</label>
												<label className={`flex items-center gap-1 ${editingRowId === row.id ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
													<input 
														type="checkbox" 
														checked={row.snackStatus.afternoon === '1'}
														onChange={(e) => {
															const newData = combinedData.map(r => 
																r.id === row.id ? { ...r, snackStatus: { ...r.snackStatus, afternoon: e.target.checked ? '1' : '2' } } : r
															);
															setCombinedData(newData);
														}}
														disabled={editingRowId !== row.id}
														className={`${editingRowId === row.id ? "cursor-pointer" : "cursor-not-allowed"} ${editingRowId !== row.id && row.snackStatus.afternoon === '1' ? "disabled-checked-blue" : ""}`}
													/>
													<span className="text-xs">오후</span>
												</label>
												<label className={`flex items-center gap-1 ${editingRowId === row.id ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
													<input 
														type="checkbox" 
														checked={row.snackStatus.evening === '1'}
														onChange={(e) => {
															const newData = combinedData.map(r => 
																r.id === row.id ? { ...r, snackStatus: { ...r.snackStatus, evening: e.target.checked ? '1' : '2' } } : r
															);
															setCombinedData(newData);
														}}
														disabled={editingRowId !== row.id}
														className={`${editingRowId === row.id ? "cursor-pointer" : "cursor-not-allowed"} ${editingRowId !== row.id && row.snackStatus.evening === '1' ? "disabled-checked-blue" : ""}`}
													/>
													<span className="text-xs">저녁</span>
												</label>
											</div>
										</td>
										<td className="text-center px-3 py-3 border-r border-blue-100 w-80">
											<input 
												type="text" 
												value={row.specialNotes}
												placeholder="특이사항 입력"
												onChange={(e) => {
													const newData = combinedData.map(r => 
														r.id === row.id ? { ...r, specialNotes: e.target.value } : r
													);
													setCombinedData(newData);
												}}
												disabled={editingRowId !== row.id}
												onClick={(e) => e.stopPropagation()}
												className={`w-full px-2 py-1 border border-blue-300 rounded ${
													editingRowId === row.id ? 'bg-white' : 'bg-gray-100 cursor-not-allowed'
												}`}
											/>
										</td>
										<td className="text-center px-3 py-3">
											<div className="flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
												<button
													onClick={() => handleEditClick(row.id)}
													className={`px-3 py-1 text-xs border rounded font-medium ${
														editingRowId === row.id
															? 'border-green-400 bg-green-200 hover:bg-green-300 text-green-900'
															: 'border-blue-400 bg-blue-200 hover:bg-blue-300 text-blue-900'
													}`}
												>
													{editingRowId === row.id ? '저장' : '수정'}
												</button>
												{editingRowId === row.id ? (
													<button
														type="button"
														onClick={() => handleCancelEdit(row.id)}
														className="px-3 py-1 text-xs border border-gray-400 rounded bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium"
													>
														취소
													</button>
												) : (
													<button
														type="button"
														onClick={() => handleDeleteRow(row.id)}
														className="px-3 py-1 text-xs border border-red-400 rounded bg-red-200 hover:bg-red-300 text-red-900 font-medium"
													>
														삭제
													</button>
												)}
											</div>
										</td>
									</tr>
									);
									})
								)}
							</tbody>
						</table>
					</div>
					{/* 페이지네이션 */}
					{totalPages > 1 && (
						<div className="p-3 border-t border-blue-200 bg-white">
							<div className="flex items-center justify-center gap-1">
								<button
									onClick={() => handlePageChange(1)}
									disabled={currentPage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&lt;&lt;
								</button>
								<button
									onClick={() => handlePageChange(currentPage - 1)}
									disabled={currentPage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&lt;
								</button>
								
								{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
									const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
									return (
										<button
											key={pageNum}
											onClick={() => handlePageChange(pageNum)}
											className={`px-2 py-1 text-xs border rounded ${
												currentPage === pageNum
													? 'bg-blue-500 text-white border-blue-500'
													: 'border-blue-300 hover:bg-blue-50'
											}`}
										>
											{pageNum}
										</button>
									);
								})}
								
								<button
									onClick={() => handlePageChange(currentPage + 1)}
									disabled={currentPage === totalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&gt;
								</button>
								<button
									onClick={() => handlePageChange(totalPages)}
									disabled={currentPage === totalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
								>
									&gt;&gt;
								</button>
							</div>
						</div>
					)}
				</div>

				{/* 하단 추가 버튼 */}
				<div className="flex justify-center mt-4">
					<button
						onClick={handleAddRow}
						className="px-6 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium"
					>
						추가
					</button>
				</div>
			</div>

			{/* 수급자별 출력 모달 */}
			{showMemberPrintModal && (
				<div 
					className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
					onClick={handleCloseMemberPrintModal}
				>
					<div 
						ref={memberPrintModalBodyRef}
						className="bg-white rounded-lg border border-blue-400 w-[600px] max-w-[90vw] max-h-[90vh] overflow-y-auto shadow-xl"
						onClick={(e) => e.stopPropagation()}
					>
						{/* 모달 헤더 */}
						<div className="bg-blue-200 border-b border-blue-400 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
							<h3 className="text-lg font-semibold text-blue-900">수급자별 출력</h3>
							<button
								onClick={handleCloseMemberPrintModal}
								className="text-blue-900 hover:text-blue-700 text-xl font-bold"
							>
								×
							</button>
						</div>

						{/* 모달 내용 */}
						<div className="p-4 space-y-4">
							{/* 수급자 검색 */}
							<div className="space-y-2">
								<label className="block text-sm font-medium text-blue-900">수급자 검색</label>
								<div className="relative">
									<input
										ref={memberSearchInputRef}
										type="text"
										value={memberSearchTerm}
										onChange={(e) => {
											setMemberSearchTerm(e.target.value);
											handleSearchMemberForPrint(e.target.value);
										}}
										onFocus={() => {
											if (memberSearchTerm && memberSearchTerm.trim().length > 0) {
												handleSearchMemberForPrint(memberSearchTerm);
											}
										}}
										onBlur={() => {
											setTimeout(() => {
												setShowMemberSearchResults(false);
											}, 200);
										}}
										placeholder="수급자명 검색"
										className="w-full px-3 py-2 border border-blue-300 rounded text-blue-900"
									/>
									{typeof document !== 'undefined' &&
										showMemberSearchResults &&
										memberSearchResults.length > 0 &&
										memberSearchDropdownLayout &&
										createPortal(
											<div
												className="fixed z-[10000] bg-white border border-blue-300 rounded shadow-lg max-h-60 overflow-y-auto text-black"
												style={{
													top: memberSearchDropdownLayout.top,
													left: memberSearchDropdownLayout.left,
													width: Math.max(memberSearchDropdownLayout.width, 200)
												}}
											>
												{memberSearchResults.map((member: any, idx: number) => (
													<div
														key={idx}
														onMouseDown={(e) => {
															e.preventDefault();
															handleSelectMemberForPrint(member);
														}}
														className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-blue-100 last:border-b-0 text-black"
													>
														<div className="font-medium text-black">{member.P_NM}</div>
														<div className="text-xs text-black">
															{member.P_BRDT && `(${formatDate(member.P_BRDT)})`}
														</div>
													</div>
												))}
											</div>,
											document.body
										)}
								</div>
								{selectedMemberForPrint && (
									<div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm">
										<span className="font-medium">선택된 수급자: </span>
										{selectedMemberForPrint.P_NM} ({formatDate(selectedMemberForPrint.P_BRDT)})
									</div>
								)}
							</div>

							{/* 기간 설정 */}
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<label className="block text-sm font-medium text-blue-900">시작일</label>
									<input
										type="date"
										value={startDate}
										onChange={(e) => setStartDate(e.target.value)}
										className="w-full px-3 py-2 border border-blue-300 rounded text-blue-900"
									/>
								</div>
								<div className="space-y-2">
									<label className="block text-sm font-medium text-blue-900">종료일</label>
									<input
										type="date"
										value={endDate}
										onChange={(e) => setEndDate(e.target.value)}
										className="w-full px-3 py-2 border border-blue-300 rounded text-blue-900"
									/>
								</div>
							</div>

							{/* 데이터 조회 및 출력 버튼 */}
							<div className="flex gap-2 pt-2">
								<button
									onClick={handleLoadMemberData}
									disabled={!selectedMemberForPrint || loadingMemberData}
									className="flex-1 px-4 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{loadingMemberData ? '조회 중...' : '데이터 조회'}
								</button>
								<button
									onClick={handlePrintMember}
									disabled={memberPrintData.length === 0}
									className="flex-1 px-4 py-2 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									출력
								</button>
							</div>

							{/* 조회된 데이터 개수 표시 */}
							{memberPrintData.length > 0 && (
								<div className="px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-900">
									조회된 데이터: {memberPrintData.length}건
								</div>
							)}
						</div>
					</div>
				</div>
			)}
			{showOvernightReturnModal && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
					onClick={handleCloseOvernightReturnModal}
				>
					<div
						className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 bg-blue-50 px-4 py-3">
							<h3 className="text-lg font-semibold text-blue-900">외박 수급자 복귀 처리</h3>
							<button
								type="button"
								onClick={handleCloseOvernightReturnModal}
								disabled={savingOvernightReturn}
								className="text-blue-900/70 hover:text-blue-900 text-xl leading-none px-2"
							>
								×
							</button>
						</div>
						<div className="p-4 overflow-y-auto flex-1">
							<p className="text-sm font-medium text-blue-900 mb-1">
								복귀하는 수급자를 선택하고 복귀 시간을 입력하세요
							</p>
							<p className="text-sm text-blue-900/80 mb-3">
								선택일({selectedDate}) 기준, 가장 최근 실적이 외박이고 아직 복귀 처리되지 않은 수급자입니다.
							</p>
							{loadingOvernightPending ? (
								<div className="text-center py-8 text-blue-900/60">조회 중...</div>
							) : overnightPendingList.length === 0 ? (
								<div className="text-center py-8 text-blue-900/60">외박 중인 수급자가 없습니다.</div>
							) : (
								<table className="w-full text-sm border border-blue-200">
									<thead className="bg-blue-50">
										<tr>
											<th className="px-2 py-2 border-r border-blue-200 w-12">선택</th>
											<th className="px-2 py-2 border-r border-blue-200">수급자명</th>
											<th className="px-2 py-2 border-r border-blue-200">생년월일</th>
											<th className="px-2 py-2 border-r border-blue-200">외박 일시</th>
											<th className="px-2 py-2">복귀 시간</th>
										</tr>
									</thead>
									<tbody>
										{overnightPendingList.map((item, idx) => {
											const leaveParsed = parseIoTmInfo(item.PREV_IO_TM_INFO);
											const leaveTime = leaveParsed.start || String(item.PREV_IO_TM_INFO || '').trim();
											const leaveDate = formatDate(item.PREV_SVDT);
											const leaveDateTime =
												leaveDate && leaveTime
													? `${leaveDate} ${leaveTime}`
													: leaveDate || leaveTime || '-';
											return (
												<tr key={`${item.PNUM}-${idx}`} className="border-t border-blue-100">
													<td className="px-2 py-2 text-center border-r border-blue-100">
														<input
															type="checkbox"
															checked={item.selected}
															onChange={(e) => {
																const checked = e.target.checked;
																setOvernightPendingList((prev) =>
																	prev.map((row, i) =>
																		i === idx ? { ...row, selected: checked } : row
																	)
																);
															}}
															disabled={savingOvernightReturn}
														/>
													</td>
													<td className="px-2 py-2 text-center border-r border-blue-100 text-blue-900">
														{item.P_NM || '-'}
													</td>
													<td className="px-2 py-2 text-center border-r border-blue-100 text-blue-900">
														{formatDate(item.P_BRDT) || '-'}
													</td>
													<td className="px-2 py-2 text-center border-r border-blue-100 text-blue-900 whitespace-nowrap">
														{leaveDateTime}
													</td>
													<td className="px-2 py-2 text-center">
														<input
															type="time"
															value={item.returnTime}
															onChange={(e) => {
																const value = e.target.value;
																setOvernightPendingList((prev) =>
																	prev.map((row, i) =>
																		i === idx ? { ...row, returnTime: value } : row
																	)
																);
															}}
															disabled={savingOvernightReturn || !item.selected}
															className="min-w-[9rem] w-[9rem] px-1 py-1 text-xs border border-blue-300 rounded bg-white disabled:bg-gray-100"
														/>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							)}
						</div>
						<div className="flex justify-end gap-2 border-t border-blue-200 px-4 py-3 bg-white">
							<button
								type="button"
								onClick={handleCloseOvernightReturnModal}
								disabled={savingOvernightReturn}
								className="px-4 py-1.5 text-sm border border-blue-300 rounded bg-white hover:bg-blue-50 text-blue-900"
							>
								취소
							</button>
							<button
								type="button"
								onClick={handleSaveOvernightReturn}
								disabled={savingOvernightReturn || loadingOvernightPending || overnightPendingList.length === 0}
								className="px-4 py-1.5 text-sm border border-amber-500 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium disabled:opacity-50"
							>
								{savingOvernightReturn ? '저장 중...' : '복귀 저장'}
							</button>
						</div>
					</div>
				</div>
			)}
			{bulkAdding && (
				<div
					className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
					role="status"
					aria-live="polite"
					aria-busy="true"
				>
					<div className="flex flex-col items-center gap-4 rounded-lg border border-blue-300 bg-white px-10 py-8 shadow-xl">
						<div
							className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
							aria-hidden="true"
						/>
						<p className="text-sm font-semibold text-blue-900">전체추가 진행 중...</p>
						<p className="text-xs text-blue-900/60">완료될 때까지 잠시만 기다려 주세요</p>
					</div>
				</div>
			)}
			{/* 행 수급자명 검색 드롭다운 — body Portal로 표/sticky 셀에 가려지지 않음 */}
			{typeof document !== 'undefined' &&
				rowSearchDropdownLayout &&
				showSearchResults[rowSearchDropdownLayout.rowId] &&
				(searchResults[rowSearchDropdownLayout.rowId]?.length ?? 0) > 0 &&
				createPortal(
					<div
						className="fixed z-[10000] bg-white border border-blue-300 rounded shadow-lg max-h-60 overflow-y-auto text-black"
						style={{
							top: rowSearchDropdownLayout.top,
							left: rowSearchDropdownLayout.left,
							width: rowSearchDropdownLayout.width
						}}
					>
						{searchResults[rowSearchDropdownLayout.rowId].map((member: any, memberIdx: number) => (
							<div
								key={memberIdx}
								onMouseDown={(e) => {
									e.preventDefault();
									e.stopPropagation();
									handleSelectMember(rowSearchDropdownLayout.rowId, member);
								}}
								className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-blue-100 last:border-b-0 text-black"
							>
								<div className="font-medium text-black">{member.P_NM}</div>
								<div className="text-xs text-black">
									{member.P_BRDT && `(${formatDate(member.P_BRDT)})`}
								</div>
							</div>
						))}
					</div>,
					document.body
				)}
		</div>
	);
}
