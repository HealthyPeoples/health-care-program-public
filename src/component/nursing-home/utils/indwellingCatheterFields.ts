/**
 * @file 요양원 유틸 — indwellingCatheterFields.ts
 *
 * @description
 * 요양원 도메인 공통 유틸리티입니다.
 *
 * @module component/nursing-home/utils/indwellingCatheterFields
 */
import {
	formatDateYmd,
	isCheckedFlag,
	normalizeTimeHm,
	toCheckFlag,
	toHtmlTimeValue,
	vtmGuToStartEnd,
} from './excretionObservationFields';

/** F33050 소변백 위치(BAG_POS) — 침대/난간/옆/아래 */
export const URINE_BAG_POSITIONS = [
	{ code: '1', label: '침대' },
	{ code: '2', label: '난간' },
	{ code: '3', label: '옆' },
	{ code: '4', label: '아래' },
] as const;

const BAG_POS_LABEL_TO_CODE: Record<string, string> = {
	침대: '1',
	난간: '2',
	옆: '3',
	아래: '4',
	소변주머니: '1',
};

export function bagPosToLabel(code: string): string {
	const c = String(code ?? '').trim();
	if (!c) return '';
	return URINE_BAG_POSITIONS.find((o) => o.code === c)?.label ?? (BAG_POS_LABEL_TO_CODE[c] ? c : c);
}

export function labelToBagPos(label: string): string {
	const trimmed = String(label ?? '').trim();
	if (!trimmed) return '';
	if (URINE_BAG_POSITIONS.some((o) => o.code === trimmed)) return trimmed;
	return BAG_POS_LABEL_TO_CODE[trimmed] ?? trimmed;
}

export function nowTimeHm(): string {
	const d = new Date();
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function resolveManagementTime(row: Pick<F33050Row, 'MG_TM' | 'VTM_GU'>): string {
	const tm = normalizeTimeHm(row.MG_TM);
	if (tm) return tm;
	return vtmGuToStartEnd(String(row.VTM_GU ?? '')).start;
}

export interface F33050Row {
	ANCD?: string | number;
	PNUM?: string | number;
	VDT?: string;
	VTM_GU?: string;
	MG_TM?: string;
	PSS_VAL?: string | number | null;
	CH_01?: string;
	CH_02?: string;
	CH_03?: string;
	BAG_POS?: string;
	ETC?: string;
	INEMPNO?: string | number | null;
	INEMPNM?: string | null;
	[key: string]: unknown;
}

export interface CatheterFormData {
	beneficiary: string;
	managementDate: string;
	managementTime: string;
	catheter: boolean;
	bagPosition: string;
	disinfection: boolean;
	remarks: string;
	observer: string;
	originalVtmGu: string;
}

export function rowToCatheterForm(row: F33050Row, beneficiaryName = ''): CatheterFormData {
	return {
		beneficiary: beneficiaryName,
		managementDate: formatDateYmd(row.VDT),
		managementTime: toHtmlTimeValue(resolveManagementTime(row)),
		catheter: isCheckedFlag(row.CH_01),
		bagPosition: labelToBagPos(String(row.BAG_POS ?? '')),
		disinfection: isCheckedFlag(row.CH_03),
		remarks: String(row.ETC ?? ''),
		observer: String(row.INEMPNM ?? ''),
		originalVtmGu: String(row.VTM_GU ?? '').trim(),
	};
}

export function catheterFormToPayload(form: CatheterFormData, pnum: string) {
	const mgTm = normalizeTimeHm(form.managementTime);
	const bagPos = labelToBagPos(form.bagPosition);
	return {
		PNUM: pnum,
		VDT: form.managementDate,
		VTM_GU: String(form.originalVtmGu ?? '').trim() || undefined,
		MG_TM: mgTm,
		CH_01: toCheckFlag(form.catheter),
		CH_02: toCheckFlag(Boolean(bagPos)),
		CH_03: toCheckFlag(form.disinfection),
		BAG_POS: bagPos,
		ETC: form.remarks || '',
		INEMPNM: form.observer || null,
	};
}

export function createEmptyCatheterForm(beneficiaryName = '', observer = ''): CatheterFormData {
	const today = new Date();
	const y = today.getFullYear();
	const m = String(today.getMonth() + 1).padStart(2, '0');
	const d = String(today.getDate()).padStart(2, '0');
	return {
		beneficiary: beneficiaryName,
		managementDate: `${y}-${m}-${d}`,
		managementTime: nowTimeHm(),
		catheter: true,
		bagPosition: '',
		disinfection: false,
		remarks: '',
		observer,
		originalVtmGu: '',
	};
}

export { formatDateYmd, formatDateYyMmDd, isCheckedFlag, toHtmlTimeValue } from './excretionObservationFields';
