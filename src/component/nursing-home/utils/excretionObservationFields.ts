/**
 * @file 요양원 유틸 — excretionObservationFields.ts
 *
 * @description
 * 요양원 도메인 공통 유틸리티입니다.
 *
 * @module component/nursing-home/utils/excretionObservationFields
 */
/** F33021 관찰시간구분(VTM_GU) — 1시간 단위 슬롯 */
export const EXCRETION_TIME_SLOTS = [
	{ vtmGu: '05', label: '05:00 - 06:00' },
	{ vtmGu: '06', label: '06:00 - 07:00' },
	{ vtmGu: '07', label: '07:00 - 08:00' },
	{ vtmGu: '08', label: '08:00 - 09:00' },
	{ vtmGu: '09', label: '09:00 - 10:00' },
	{ vtmGu: '10', label: '10:00 - 11:00' },
	{ vtmGu: '11', label: '11:00 - 12:00' },
	{ vtmGu: '12', label: '12:00 - 13:00' },
	{ vtmGu: '13', label: '13:00 - 14:00' },
	{ vtmGu: '14', label: '14:00 - 15:00' },
	{ vtmGu: '15', label: '15:00 - 16:00' },
	{ vtmGu: '16', label: '16:00 - 17:00' },
	{ vtmGu: '17', label: '17:00 - 18:00' },
	{ vtmGu: '18', label: '18:00 - 19:00' },
	{ vtmGu: '19', label: '19:00 - 20:00' },
	{ vtmGu: '20', label: '20:00 - 21:00' },
	{ vtmGu: '21', label: '21:00 - 22:00' },
	{ vtmGu: '22', label: '22:00 - 23:00' },
	{ vtmGu: '23', label: '23:00 - 24:00' },
] as const;

/** F33021 ANNT_STAT_GU */
export const ANNT_STAT_OPTIONS = [
	{ code: '1', label: '일반' },
	{ code: '2', label: '기저귀착용' },
	{ code: '3', label: '장루(요루)' },
	{ code: '4', label: '도뇨관삽입' },
	{ code: '9', label: '기타' },
] as const;

export function vtmGuToLabel(vtmGu: string): string {
	const { start, end } = vtmGuToStartEnd(vtmGu);
	if (start && end) return `${start} - ${end}`;
	return String(vtmGu ?? '');
}

export function labelToVtmGu(label: string): string {
	const trimmed = String(label ?? '').trim();
	const slot = EXCRETION_TIME_SLOTS.find((s) => s.label === trimmed);
	if (slot) return slot.vtmGu;
	const hour = trimmed.slice(0, 2);
	if (/^\d{2}$/.test(hour)) return hour;
	return trimmed.slice(0, 2);
}

/** HH:mm / HHmm / Date / 24:00 등을 HH:mm 으로 정규화 */
export function normalizeTimeHm(v: unknown): string {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const iso = v.toISOString();
		if (/^(1970|1900)-01-01T/.test(iso)) return iso.slice(11, 16);
		const h = String(v.getHours()).padStart(2, '0');
		const m = String(v.getMinutes()).padStart(2, '0');
		return `${h}:${m}`;
	}
	const s = String(v).trim();
	if (/^\d{1,2}:\d{2}/.test(s)) {
		const [h, m] = s.split(':');
		return `${String(h).padStart(2, '0')}:${String(m).slice(0, 2)}`;
	}
	if (/^\d{3,4}$/.test(s)) {
		const p = s.padStart(4, '0');
		return `${p.slice(0, 2)}:${p.slice(2, 4)}`;
	}
	if (/^24:00$/.test(s) || s === '2400') return '24:00';
	const parsed = new Date(s);
	if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(s)) {
		const h = String(parsed.getHours()).padStart(2, '0');
		const m = String(parsed.getMinutes()).padStart(2, '0');
		return `${h}:${m}`;
	}
	return '';
}

export function vtmGuToStartEnd(vtmGu: string): { start: string; end: string } {
	const raw = String(vtmGu ?? '').trim();
	if (!raw) return { start: '', end: '' };
	const code = raw.padStart(2, '0').slice(-2);
	const slot = EXCRETION_TIME_SLOTS.find((s) => s.vtmGu === code);
	if (slot) {
		const [start, end] = slot.label.split(' - ');
		return { start: start || '', end: end || '' };
	}
	if (/^\d{2}$/.test(code)) {
		const hour = Number(code);
		const endHour = hour + 1;
		return {
			start: `${code}:00`,
			end: endHour >= 24 ? '24:00' : `${String(endHour).padStart(2, '0')}:00`,
		};
	}
	return { start: '', end: '' };
}

export function timeToVtmGu(time: string): string {
	const hm = normalizeTimeHm(time);
	if (/^\d{2}:\d{2}$/.test(hm)) return hm.slice(0, 2);
	return '';
}

export function toHtmlTimeValue(time: string): string {
	const hm = normalizeTimeHm(time);
	if (hm === '24:00') return '23:59';
	return /^\d{2}:\d{2}$/.test(hm) ? hm : '';
}

export function formatTimeRangeLabel(start: string, end: string): string {
	const s = normalizeTimeHm(start);
	const e = normalizeTimeHm(end);
	if (s && e) return `${s} - ${e}`;
	if (s) return s;
	if (e) return e;
	return '';
}

export function resolveObservationTimes(row: {
	VTM_GU?: unknown;
	VTM_ST?: unknown;
	VTM_EN?: unknown;
}): { start: string; end: string; label: string } {
	const fromGu = vtmGuToStartEnd(String(row?.VTM_GU ?? ''));
	const start = normalizeTimeHm(row?.VTM_ST) || fromGu.start;
	const end = normalizeTimeHm(row?.VTM_EN) || fromGu.end;
	const label = formatTimeRangeLabel(start, end) || vtmGuToLabel(String(row?.VTM_GU ?? '')) || '-';
	return { start, end, label };
}

export function anntStatToLabel(code: string): string {
	const c = String(code ?? '').trim();
	return ANNT_STAT_OPTIONS.find((o) => o.code === c)?.label ?? c;
}

export function isCheckedFlag(v: unknown): boolean {
	const s = String(v ?? '').trim();
	return s === '1' || s.toUpperCase() === 'Y';
}

export function toCheckFlag(checked: boolean): '0' | '1' {
	return checked ? '1' : '0';
}

/** F33020 소변/대변 양 구분 — 1소량 2보통 3대량 */
export const EXCRETION_AMT_OPTIONS = [
	{ code: '1', label: '소량', short: '소' },
	{ code: '2', label: '보통', short: '보' },
	{ code: '3', label: '대량', short: '대' },
] as const;

export type ExcretionAmtCode = '' | '1' | '2' | '3';

export function normalizeAmtGu(v: unknown): ExcretionAmtCode {
	const s = String(v ?? '').trim();
	if (s === '1' || s === '2' || s === '3') return s;
	return '';
}

export function amtGuToLabel(v: unknown, empty = ''): string {
	const c = normalizeAmtGu(v);
	return EXCRETION_AMT_OPTIONS.find((o) => o.code === c)?.label ?? empty;
}

export function diaperUseToFlag(value: string): '0' | '1' {
	const v = String(value ?? '').trim();
	if (v === '1' || v === '있음') return '1';
	return '0';
}

export function flagToDiaperUse(v: unknown): string {
	return isCheckedFlag(v) ? '있음' : '없음';
}

export interface F33021Row {
	ANCD?: string | number;
	PNUM?: string | number;
	VDT?: string;
	VTM_GU?: string;
	VTM_ST?: string;
	VTM_EN?: string;
	ANNT_STAT_GU?: string;
	ANNT_STAT_DESC?: string;
	PSS_NPPY_VAL_GU?: string;
	PSS_CTHT_VAL?: string;
	INTK_VAL?: string;
	PSS_GU?: string;
	DNG_GU?: string;
	PSS_AMT_GU?: string;
	DNG_AMT_GU?: string;
	NPPY_CNG_GU?: string;
	NPPY_CNG_TM?: string;
	INEMPNO?: string | number | null;
	INEMPNM?: string | null;
	[key: string]: unknown;
}

export interface ExcretionFormData {
	beneficiary: string;
	observationDate: string;
	beneficiaryStatus: string;
	statusOther: string;
	observationTime: string;
	originalVtmGu: string;
	diaperUse: string;
	stomaCatheter: string;
	intakeAmount: string;
	urineAmt: ExcretionAmtCode;
	stoolAmt: ExcretionAmtCode;
	diaperChange: boolean;
	diaperChangeTime: string;
	observer: string;
}

export function rowObservationTime(row: F33021Row): string {
	return normalizeTimeHm(row.VTM_ST) || vtmGuToHm(String(row.VTM_GU ?? ''));
}

function vtmGuToHm(vtmGu: string): string {
	const gu = String(vtmGu ?? '').trim();
	if (/^\d{1,2}$/.test(gu)) return `${gu.padStart(2, '0')}:00`;
	return '';
}

export function rowToExcretionForm(row: F33021Row, beneficiaryName = ''): ExcretionFormData {
	const urineAmt = normalizeAmtGu(row.PSS_AMT_GU) || (isCheckedFlag(row.PSS_GU) ? '2' : '');
	const stoolAmt = normalizeAmtGu(row.DNG_AMT_GU) || (isCheckedFlag(row.DNG_GU) ? '2' : '');
	const diaperChange = isCheckedFlag(row.NPPY_CNG_GU);
	return {
		beneficiary: beneficiaryName,
		observationDate: formatDateYmd(row.VDT),
		beneficiaryStatus: String(row.ANNT_STAT_GU ?? '1').trim() || '1',
		statusOther: String(row.ANNT_STAT_DESC ?? ''),
		observationTime: rowObservationTime(row),
		originalVtmGu: String(row.VTM_GU ?? '').trim(),
		diaperUse: flagToDiaperUse(row.PSS_NPPY_VAL_GU),
		stomaCatheter: String(row.PSS_CTHT_VAL ?? ''),
		intakeAmount: String(row.INTK_VAL ?? ''),
		urineAmt,
		stoolAmt,
		diaperChange,
		diaperChangeTime: diaperChange ? normalizeTimeHm(row.NPPY_CNG_TM) : '',
		observer: String(row.INEMPNM ?? ''),
	};
}

export function excretionFormToPayload(form: ExcretionFormData, pnum: string) {
	const observationTime = normalizeTimeHm(form.observationTime);
	const vtmGu = timeToVtmGu(observationTime) || labelToVtmGu(form.observationTime);
	const diaperChangeTime = form.diaperChange ? normalizeTimeHm(form.diaperChangeTime) : '';
	return {
		PNUM: pnum,
		VDT: form.observationDate,
		VTM_GU: vtmGu,
		MATCH_VTM_GU: form.originalVtmGu || vtmGu,
		VTM_ST: observationTime,
		VTM_EN: observationTime,
		ANNT_STAT_GU: form.beneficiaryStatus || '1',
		ANNT_STAT_DESC: form.statusOther || '',
		PSS_NPPY_VAL_GU: diaperUseToFlag(form.diaperUse),
		PSS_CTHT_VAL: form.stomaCatheter || '',
		INTK_VAL: form.intakeAmount || '',
		PSS_GU: toCheckFlag(!!form.urineAmt),
		DNG_GU: toCheckFlag(!!form.stoolAmt),
		PSS_AMT_GU: form.urineAmt || '0',
		DNG_AMT_GU: form.stoolAmt || '0',
		NPPY_CNG_GU: toCheckFlag(form.diaperChange),
		NPPY_CNG_TM: diaperChangeTime,
		INEMPNM: form.observer || null,
		INEMPNO: null,
	};
}

export function formatDateYmd(dateStr: unknown): string {
	if (dateStr == null || dateStr === '') return '';
	if (dateStr instanceof Date && !Number.isNaN(dateStr.getTime())) {
		const y = dateStr.getFullYear();
		const m = String(dateStr.getMonth() + 1).padStart(2, '0');
		const d = String(dateStr.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	let s = String(dateStr).trim();
	// ISO만 분리 (Thu/Tue/Sat 요일의 T와 혼동 방지)
	if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
		return s.slice(0, 10);
	}
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	if (/^\d{2}\.\d{2}\.\d{2}$/.test(s)) {
		const [yy, mm, dd] = s.split('.');
		const year = Number(yy) >= 70 ? `19${yy}` : `20${yy}`;
		return `${year}-${mm}-${dd}`;
	}
	// "Fri Mar 13 2020 09:00:00 GMT..." 형식
	const eng = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})\b/i.exec(s);
	if (eng) {
		const monthMap: Record<string, string> = {
			jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
			jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
		};
		const mm = monthMap[eng[1].toLowerCase()];
		const dd = String(Number(eng[2])).padStart(2, '0');
		if (mm) return `${eng[3]}-${mm}-${dd}`;
	}
	const parsed = new Date(s);
	if (!Number.isNaN(parsed.getTime())) {
		const y = parsed.getFullYear();
		const m = String(parsed.getMonth() + 1).padStart(2, '0');
		const d = String(parsed.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return '';
}

/** 화면 표시용 YY.MM.DD */
export function formatDateYyMmDd(dateStr: unknown): string {
	const ymd = formatDateYmd(dateStr);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
	return `${ymd.slice(2, 4)}.${ymd.slice(5, 7)}.${ymd.slice(8, 10)}`;
}

export function createEmptyExcretionForm(beneficiaryName = '', observer = ''): ExcretionFormData {
	return {
		beneficiary: beneficiaryName,
		observationDate: '',
		beneficiaryStatus: '1',
		statusOther: '',
		observationTime: '',
		originalVtmGu: '',
		diaperUse: '없음',
		stomaCatheter: '',
		intakeAmount: '',
		urineAmt: '',
		stoolAmt: '',
		diaperChange: false,
		diaperChangeTime: '',
		observer,
	};
}
