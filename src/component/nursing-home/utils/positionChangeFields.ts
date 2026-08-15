/**
 * @file 요양원 유틸 — positionChangeFields.ts
 *
 * @description
 * 요양원 도메인 공통 유틸리티입니다.
 *
 * @module component/nursing-home/utils/positionChangeFields
 */
import { formatDateYmd, normalizeTimeHm, vtmGuToStartEnd } from './excretionObservationFields';

/** F33040 CHNG_POSI */
export const CHNG_POSI_OPTIONS = [
	{ code: '1', label: '좌측위' },
	{ code: '2', label: '양와위' },
	{ code: '3', label: '우측위' },
	{ code: '4', label: '목위' },
	{ code: '5', label: '침대에 앉기' },
	{ code: '6', label: '휠체어' },
] as const;

const LEGACY_POSI_TO_CODE: Record<string, string> = {
	좌측위: '1',
	양와위: '2',
	앙와위: '2',
	배위: '2',
	우측위: '3',
	목위: '4',
	복위: '4',
	'침대에 앉기': '5',
	휠체어: '6',
	좌측경사위: '4',
	우측경사위: '4',
	기타: '4',
};

export function chngGuToLabel(chngGu: string): string {
	const { start } = vtmGuToStartEnd(chngGu);
	return start || String(chngGu ?? '');
}

export function chngPosiToLabel(code: string): string {
	const c = String(code ?? '').trim();
	return CHNG_POSI_OPTIONS.find((o) => o.code === c)?.label ?? String(code ?? '');
}

export function labelToChngPosi(label: string): string {
	const trimmed = String(label ?? '').trim();
	const opt = CHNG_POSI_OPTIONS.find((o) => o.label === trimmed);
	if (opt) return opt.code;
	return LEGACY_POSI_TO_CODE[trimmed] ?? '4';
}

export function resolveChangeTimeHm(row: Pick<F33040Row, 'CHNG_TM' | 'CHNG_GU'>): string {
	const tm = normalizeTimeHm(row.CHNG_TM);
	if (tm) return tm;
	return chngGuToLabel(String(row.CHNG_GU ?? ''));
}

export interface F33040Row {
	ANCD?: string | number;
	PNUM?: string | number;
	CHNG_DT?: string;
	VDT?: string;
	CHNG_GU?: string;
	CHNG_TM?: string;
	CHNG_POSI?: string;
	CHNG_ETC?: string;
	CHNG_EMPNO?: string | number | null;
	CHNG_EMPNM?: string | null;
	CHNG_NIGHT_EMPNO?: string | number | null;
	CHNG_NIGHT_EMPNM?: string | null;
	[key: string]: unknown;
}

export interface PositionChangeFormData {
	beneficiary: string;
	changeDate: string;
	changeTime: string;
	changedPosture: string;
	remarks: string;
	changer: string;
	changerEmpno: string;
	nightChanger: string;
	nightChangerEmpno: string;
	originalChngGu: string;
	originalChngTm: string;
}

export function rowToPositionChangeForm(row: F33040Row, beneficiaryName = ''): PositionChangeFormData {
	const changeDate = formatDateYmd(row.CHNG_DT ?? row.VDT);
	const changeTime = resolveChangeTimeHm(row);
	return {
		beneficiary: beneficiaryName,
		changeDate,
		changeTime,
		changedPosture: String(row.CHNG_POSI ?? '1').trim() || '1',
		remarks: String(row.CHNG_ETC ?? ''),
		changer: String(row.CHNG_EMPNM ?? ''),
		changerEmpno: row.CHNG_EMPNO != null && String(row.CHNG_EMPNO).trim() !== '' ? String(row.CHNG_EMPNO) : '',
		nightChanger: String(row.CHNG_NIGHT_EMPNM ?? ''),
		nightChangerEmpno:
			row.CHNG_NIGHT_EMPNO != null && String(row.CHNG_NIGHT_EMPNO).trim() !== ''
				? String(row.CHNG_NIGHT_EMPNO)
				: '',
		originalChngGu: String(row.CHNG_GU ?? ''),
		originalChngTm: normalizeTimeHm(row.CHNG_TM) || changeTime,
	};
}

export function positionChangeFormToPayload(form: PositionChangeFormData, pnum: string) {
	const posi = String(form.changedPosture ?? '').trim();
	const changeTime = normalizeTimeHm(form.changeTime);
	return {
		PNUM: pnum,
		CHNG_DT: form.changeDate,
		VDT: form.changeDate,
		CHNG_TM: changeTime,
		CHNG_GU: changeTime.slice(0, 2),
		CHNG_POSI: /^\d$/.test(posi) ? posi : labelToChngPosi(posi),
		CHNG_ETC: form.remarks || '',
		CHNG_EMPNO: form.changerEmpno || null,
		CHNG_EMPNM: form.changer || null,
		CHNG_NIGHT_EMPNO: form.nightChangerEmpno || null,
		CHNG_NIGHT_EMPNM: form.nightChanger || null,
		originalChngTm: form.originalChngTm || '',
		originalChngGu: form.originalChngGu || '',
	};
}

export function createEmptyPositionChangeForm(
	beneficiaryName = '',
	changer = '',
	changerEmpno = ''
): PositionChangeFormData {
	const today = new Date();
	const y = today.getFullYear();
	const m = String(today.getMonth() + 1).padStart(2, '0');
	const d = String(today.getDate()).padStart(2, '0');
	const hh = String(today.getHours()).padStart(2, '0');
	const mm = String(today.getMinutes()).padStart(2, '0');
	return {
		beneficiary: beneficiaryName,
		changeDate: `${y}-${m}-${d}`,
		changeTime: `${hh}:${mm}`,
		changedPosture: '1',
		remarks: '',
		changer,
		changerEmpno,
		nightChanger: '',
		nightChangerEmpno: '',
		originalChngGu: '',
		originalChngTm: '',
	};
}

export { formatDateYmd };
