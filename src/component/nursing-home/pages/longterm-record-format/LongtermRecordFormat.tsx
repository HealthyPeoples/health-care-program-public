"use client";

/**
 * @file 장기요양기록양식 — UI 부분 컴포넌트 (LongtermRecordFormat.tsx)
 *
 * @description
 * 요양원 장기요양기록양식 기능의 UI 부분 컴포넌트입니다. 폴더: component/nursing-home/pages/longterm-record-format
 *
 * @module component/nursing-home/pages/longterm-record-format/LongtermRecordFormat
 */
import { useEffect, useMemo, useState } from 'react';
import { MemberListPanel } from '../../components/MemberListPanel';
import { useTabRefresh } from '../../hooks/useTabRefresh';
import { formatCareGradeLabel } from '../../utils/careGrade';
import { resolveBathMethodFromRow } from '../../utils/physicalActivityFields';
import {
	applyNursingBaselineToAllDays,
	applyNursingFieldsToDay,
	formatVitalSignsFromRow
} from '../../utils/nursingFields';
import { formatDateYmd, fetchF14020Range } from '../../utils/f14020Daily';
import { mapF14070ToFormState, type F14070Beneficiary } from './mapF14070';

interface MemberData {
	[key: string]: any;
}

function toYmd(d: Date) {
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekMonday(base: Date) {
	const d = new Date(base);
	d.setHours(0, 0, 0, 0);
	const day = d.getDay(); // 0=일 … 6=토
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	return d;
}

const empty7 = () => ['', '', '', '', '', '', ''];
const empty7Bool = () => [false, false, false, false, false, false, false];

const MEAL_KIND_TO_LABEL: Record<string, string> = {
	'1': '일반식',
	'2': '죽',
	'3': '유동식(미음)',
	'4': '유동식(미음)',
	'5': '일반식',
	'6': '일반식',
	'7': '죽'
};
const MEAL_VAL_TO_LABEL: Record<string, string> = {
	'1': '1',
	'2': '1/2이상',
	'3': '1/2미만'
};

const ynToFlag = (v: unknown): '1' | '0' => {
	const s = String(v ?? '').trim().toLowerCase();
	if (s === '1' || s === 'y' || s === 'true') return '1';
	return '0';
};

const ynChecked = (v: unknown) => ynToFlag(v) === '1';

const toStatusLabel = (v: unknown): '와상' | '준와상' | '자립' => {
	const s = String(v ?? '').trim();
	if (s === '1' || s === '와상') return '와상';
	if (s === '3' || s === '자립') return '자립';
	return '준와상';
};

const resolveDenturesChecked = (dnt: unknown, dntDsc: unknown) => {
	const type = String(dntDsc ?? '').trim();
	return ynChecked(dnt) || type === '1' || type === '2';
};

const mealKindLabel = (row: any) => {
	const label = String(row?.PH_MEAL_KIND_NM ?? '').trim();
	if (label) return label.replace('유동식', '유동식(미음)');
	const code = String(row?.PH_MEAL_KIND ?? '').trim();
	return MEAL_KIND_TO_LABEL[code] ?? '';
};

const mealIntakeLabel = (row: any) => {
	const label = String(row?.PH_MEAL_VAL_NM ?? '').trim();
	if (label) return label;
	const code = String(row?.PH_MEAL_VAL ?? '').trim();
	return MEAL_VAL_TO_LABEL[code] ?? '';
};

const formatVitalSigns = formatVitalSignsFromRow;

const hasFieldValue = (v: unknown) => v != null && String(v).trim() !== '';

const mergeRowsByLatestField = (rows: any[]): any | null => {
	const sorted = [...rows]
		.filter(Boolean)
		.sort((a, b) => new Date(String(b?.INDT ?? 0)).getTime() - new Date(String(a?.INDT ?? 0)).getTime());
	if (sorted.length === 0) return null;

	const merged: Record<string, any> = { ...sorted[0] };
	const keys = new Set<string>();
	sorted.forEach((row) => Object.keys(row).forEach((k) => keys.add(k)));

	keys.forEach((key) => {
		if (key === 'INDT' || key === 'PNUM' || key === 'ANCD' || key === 'rn') return;
		for (const row of sorted) {
			if (hasFieldValue(row[key])) {
				merged[key] = row[key];
				return;
			}
		}
	});

	return merged;
};

const createEmptyDailyRecords = () => ({
	grooming: empty7Bool(),
	bathTime: empty7(),
	bathMethod: empty7(),
	mealType: empty7(),
	mealIntake: empty7(),
	positionChange: empty7Bool(),
	toiletUsage: empty7(),
	movementAssistance: empty7Bool(),
	walk: empty7Bool(),
	outing: empty7Bool(),
	physicalActivityNotes: empty7(),
	physicalActivityPreparer: empty7(),
	cognitiveSupport: empty7Bool(),
	communicationSupport: empty7Bool(),
	cognitiveNotes: empty7(),
	cognitivePreparer: empty7(),
	vitalSigns: empty7(),
	healthManagement: empty7Bool(),
	healthTime: empty7(),
	nursingManagement: empty7Bool(),
	nursingTime: empty7(),
	emergencyService: empty7Bool(),
	healthNotes: empty7(),
	healthPreparer: empty7(),
	trainingProgram: empty7Bool(),
	physicalFunctionTraining: empty7Bool(),
	cognitiveTraining: empty7Bool(),
	physicalTherapy: empty7Bool(),
	trainingNotes: empty7(),
	trainingPreparer: empty7(),
	admissionDischargeTime: empty7()
});

type DailyRecords = ReturnType<typeof createEmptyDailyRecords>;

const dayIndexInWeek = (indt: unknown, weekStart: Date) => {
	if (!indt) return -1;
	const d = new Date(String(indt));
	if (Number.isNaN(d.getTime())) return -1;
	d.setHours(0, 0, 0, 0);
	const start = new Date(weekStart);
	start.setHours(0, 0, 0, 0);
	const diff = Math.round((d.getTime() - start.getTime()) / 86400000);
	return diff >= 0 && diff < 7 ? diff : -1;
};

const mapPhysicalActivityFromRow = (row: any, idx: number, records: DailyRecords, merge = false) => {
	const setField = (has: boolean, apply: () => void) => {
		if (!merge || has) apply();
	};

	setField(hasFieldValue(row?.PH_HEAD_HELP), () => {
		records.grooming[idx] = ynChecked(row?.PH_HEAD_HELP);
	});
	setField(hasFieldValue(row?.PH_BATH_TM) || hasFieldValue(row?.BATH_SPV_TM), () => {
		records.bathTime[idx] = String(row?.PH_BATH_TM ?? row?.BATH_SPV_TM ?? '').trim();
	});
	setField(hasFieldValue(row?.PH_MEAL_KIND) || hasFieldValue(row?.PH_MEAL_KIND_NM), () => {
		records.mealType[idx] = mealKindLabel(row);
	});
	setField(hasFieldValue(row?.PH_MEAL_VAL) || hasFieldValue(row?.PH_MEAL_VAL_NM), () => {
		records.mealIntake[idx] = mealIntakeLabel(row);
	});
	setField(hasFieldValue(row?.PH_CHANG_HELP), () => {
		records.positionChange[idx] = ynChecked(row?.PH_CHANG_HELP);
	});
	setField(hasFieldValue(row?.PH_TOL_CNT), () => {
		records.toiletUsage[idx] = String(row?.PH_TOL_CNT ?? '').trim();
	});
	setField(hasFieldValue(row?.PH_MOVE_HELP), () => {
		records.movementAssistance[idx] = ynChecked(row?.PH_MOVE_HELP);
	});
	setField(hasFieldValue(row?.PH_WORK_HELP), () => {
		records.walk[idx] = ynChecked(row?.PH_WORK_HELP);
	});
	setField(hasFieldValue(row?.PH_OUT_HELP), () => {
		records.outing[idx] = ynChecked(row?.PH_OUT_HELP);
	});
	setField(hasFieldValue(row?.PH_VIEW), () => {
		records.physicalActivityNotes[idx] = String(row?.PH_VIEW ?? '').trim();
	});
	setField(hasFieldValue(row?.PH_WRITE_NAME) || hasFieldValue(row?.INEMPNM), () => {
		records.physicalActivityPreparer[idx] = String(row?.PH_WRITE_NAME ?? row?.INEMPNM ?? '').trim();
	});
};

const mapCognitiveFromRow = (row: any, idx: number, records: DailyRecords) => {
	records.cognitiveSupport[idx] = ynChecked(row?.RG_AID_HELP);
	records.communicationSupport[idx] = ynChecked(row?.RG_TALK_HELP);
	records.cognitiveNotes[idx] = String(row?.RG_VIEW ?? '').trim();
	records.cognitivePreparer[idx] = String(row?.RG_WRITE_NAME ?? '').trim();
};

const mapNursingFromRow = (row: any, idx: number, records: DailyRecords, merge = false) => {
	applyNursingFieldsToDay(row, idx, records, merge);
};

const mapTrainingFromRow = (row: any, idx: number, records: DailyRecords) => {
	records.trainingProgram[idx] = ynChecked(row?.FN_COGN_HELP);
	records.physicalFunctionTraining[idx] = ynChecked(row?.FN_MOVE_HELP);
	records.cognitiveTraining[idx] = ynChecked(row?.FN_MIND_TRAIN ?? row?.FN_MIND_HELP);
	records.physicalTherapy[idx] = ynChecked(row?.FN_PHY_HELP);
	records.trainingNotes[idx] = String(row?.FN_VIEW ?? '').trim();
	records.trainingPreparer[idx] = String(row?.FN_WRITE_NAME ?? '').trim();
};

/** 서식 날짜 표기: "7 / 13" */
const formatSheetDate = (date: Date) => `${date.getMonth() + 1} / ${date.getDate()}`;

const startOfDay = (d: Date) => {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
};

const weekDayAt = (monday: Date, index: number) => {
	const date = new Date(monday);
	date.setHours(0, 0, 0, 0);
	date.setDate(monday.getDate() + index);
	return date;
};

/** 월~일 7칸 중 기준일과 같은 연·월인 요일만 true */
const sameMonthDayFlags = (monday: Date, baseDate: Date) => {
	const month = baseDate.getMonth();
	const year = baseDate.getFullYear();
	return Array.from({ length: 7 }, (_, i) => {
		const d = weekDayAt(monday, i);
		return d.getMonth() === month && d.getFullYear() === year;
	});
};

/** 같은 달 날짜만 "M / D", 다른 달은 공란 */
const weekDatesForBaseMonth = (monday: Date, baseDate: Date) => {
	const flags = sameMonthDayFlags(monday, baseDate);
	return flags.map((ok, i) => (ok ? formatSheetDate(weekDayAt(monday, i)) : ''));
};

const maskDailyRecordsForSameMonth = (daily: DailyRecords, flags: boolean[]): DailyRecords => {
	const empty = createEmptyDailyRecords();
	const next: DailyRecords = { ...empty };
	(Object.keys(empty) as (keyof DailyRecords)[]).forEach((key) => {
		const src = daily[key];
		const blank = empty[key];
		(next as unknown as Record<string, unknown[]>)[key] = (src as unknown[]).map((v, i) =>
			flags[i] ? v : (blank as unknown[])[i]
		);
	});
	return next;
};

const applyBaselineToAllDays = (baselineRow: any, records: DailyRecords) => {
	for (let i = 0; i < 7; i++) {
		mapPhysicalActivityFromRow(baselineRow, i, records);
		mapCognitiveFromRow(baselineRow, i, records);
		mapNursingFromRow(baselineRow, i, records);
		mapTrainingFromRow(baselineRow, i, records);
	}
};

const applyBathMethodToAllDays = (row: any, records: DailyRecords) => {
	const bathCode = resolveBathMethodFromRow(row);
	for (let i = 0; i < 7; i++) {
		records.bathMethod[i] = bathCode;
	}
};

const buildDailyRecords = (baselineRow: any | null, rangeRows: any[], weekStart: Date) => {
	const records = createEmptyDailyRecords();
	const mergedBaseline = mergeRowsByLatestField([baselineRow, ...rangeRows].filter(Boolean));
	if (mergedBaseline) applyBaselineToAllDays(mergedBaseline, records);

	if (baselineRow) applyBathMethodToAllDays(baselineRow, records);
	if (baselineRow) applyNursingBaselineToAllDays(baselineRow, records);

	const byDay = new Map<number, any>();
	rangeRows.forEach((row) => {
		const idx = dayIndexInWeek(row?.INDT, weekStart);
		if (idx < 0) return;
		const existing = byDay.get(idx);
		if (!existing || new Date(String(row.INDT)) > new Date(String(existing.INDT))) {
			byDay.set(idx, row);
		}
	});
	byDay.forEach((row, idx) => {
		mapPhysicalActivityFromRow(row, idx, records, true);
		mapCognitiveFromRow(row, idx, records);
		mapNursingFromRow(row, idx, records, true);
		mapTrainingFromRow(row, idx, records);
		const bathCode = resolveBathMethodFromRow(row);
		if (bathCode) records.bathMethod[idx] = bathCode;
	});
	return records;
};

const rowSvdt = (row: any) => formatDateYmd(row?.SVDT ?? row?.INDT);

const hasSavedBeneficiaryStatus = (row: any) => {
	const st = String(row?.ST_SP_ST ?? '').trim();
	return st === '1' || st === '2' || st === '3' || st === '와상' || st === '준와상' || st === '자립';
};

const latestBySvdt = (rows: any[]) =>
	[...rows].sort((a, b) => rowSvdt(b).localeCompare(rowSvdt(a)))[0] ?? null;

/** 기준일 행 우선, 없으면 해당 주(같은 달) → 주 전체 → 기준일 이전 최신 */
const pickBeneficiaryStatusRow = (
	rows: any[],
	preferredYmd: string,
	flags: boolean[],
	monday: Date
) => {
	const withStatus = rows.filter(hasSavedBeneficiaryStatus);
	if (withStatus.length === 0) return null;

	const exact = withStatus.find((r) => rowSvdt(r) === preferredYmd);
	if (exact) return exact;

	const inVisibleWeek = withStatus.filter((r) => {
		const idx = dayIndexInWeek(rowSvdt(r), monday);
		return idx >= 0 && flags[idx];
	});
	if (inVisibleWeek.length) return latestBySvdt(inVisibleWeek);

	const inWeek = withStatus.filter((r) => dayIndexInWeek(rowSvdt(r), monday) >= 0);
	if (inWeek.length) return latestBySvdt(inWeek);

	const onOrBefore = withStatus.filter((r) => {
		const ymd = rowSvdt(r);
		return ymd && ymd <= preferredYmd;
	});
	if (onOrBefore.length) return latestBySvdt(onOrBefore);

	return latestBySvdt(withStatus);
};

const mapBeneficiaryFromF14020 = (row: any): F14070Beneficiary | null => {
	if (!row || !hasSavedBeneficiaryStatus(row)) return null;
	return {
		status: toStatusLabel(row?.ST_SP_ST),
		dementia: ynChecked(row?.ST_SCK_ALZ),
		stroke: ynChecked(row?.ST_SCK_APO),
		hypertension: ynChecked(row?.ST_SCK_HBL),
		diabetes: ynChecked(row?.ST_SCK_GLY),
		arthritis: ynChecked(row?.ST_SCK_ARTH),
		otherDisease: ynChecked(row?.ST_SCK_GITA),
		otherDiseaseText: String(row?.ST_SCK_GITA_DSC ?? '').trim(),
		tracheostomy: ynChecked(row?.ST_MNG_BRN),
		dentures: resolveDenturesChecked(row?.ST_MNG_DNT, row?.ST_MNG_DNT_DSC),
		nasogastricTube: ynChecked(row?.ST_MNG_LTUB),
		urinaryCatheter: ynChecked(row?.ST_MNG_FIX_TUB),
		cystostomy: ynChecked(row?.ST_MNG_CYS),
		urostomy: ynChecked(row?.ST_MNG_URB),
		colostomy: ynChecked(row?.ST_MNG_TOP),
		diaper: ynChecked(row?.ST_MNG_DAP),
		pressureSore: ynChecked(row?.ST_MNG_BAD),
		pressureSoreArea: String(row?.ST_MNG_BAD_DSC ?? '').trim(),
		pressureSorePrevention: ynChecked(row?.ST_MNG_BCHK),
		pressureSorePreventionTool: String(row?.ST_MNG_BCHK_DSC ?? '').trim(),
		roomNo: String(row?.ROOM_NO ?? '').trim()
	};
};

export default function LongtermRecordFormat() {
	const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
	const selectedPnum = useMemo(() => String(selectedMember?.PNUM ?? '').trim(), [selectedMember]);

	const [year, setYear] = useState(new Date().getFullYear().toString());
	const [weekDates, setWeekDates] = useState<string[]>([]);
	const [baseDate, setBaseDate] = useState<Date>(() => startOfDay(new Date()));
	const weekStart = useMemo(() => startOfWeekMonday(baseDate), [baseDate]);
	const [loading, setLoading] = useState(false);

	const [headerInfo, setHeaderInfo] = useState({
		name: '',
		birthDate: '',
		gradeLabel: '',
		certNo: '',
		institutionName: '너싱홈 해원',
		institutionCode: '14161000067',
		roomNo: ''
	});

	const [status, setStatus] = useState<'와상' | '준와상' | '자립'>('준와상');
	const [dementia, setDementia] = useState(false);
	const [stroke, setStroke] = useState(false);
	const [hypertension, setHypertension] = useState(false);
	const [diabetes, setDiabetes] = useState(false);
	const [arthritis, setArthritis] = useState(false);
	const [otherDisease, setOtherDisease] = useState(false);
	const [otherDiseaseText, setOtherDiseaseText] = useState('');
	const [tracheostomy, setTracheostomy] = useState(false);
	const [dentures, setDentures] = useState(false);
	const [nasogastricTube, setNasogastricTube] = useState(false);
	const [urinaryCatheter, setUrinaryCatheter] = useState(false);
	const [cystostomy, setCystostomy] = useState(false);
	const [urostomy, setUrostomy] = useState(false);
	const [colostomy, setColostomy] = useState(false);
	const [diaper, setDiaper] = useState(false);
	const [pressureSore, setPressureSore] = useState(false);
	const [pressureSoreArea, setPressureSoreArea] = useState('');
	const [pressureSorePrevention, setPressureSorePrevention] = useState(false);
	const [pressureSorePreventionTool, setPressureSorePreventionTool] = useState('');
	const [roomNo, setRoomNo] = useState('');

	const [dailyRecords, setDailyRecords] = useState(createEmptyDailyRecords);
	const [printEmpty, setPrintEmpty] = useState(false);

	const applyWeekHeader = (monday: Date, monthAnchor: Date) => {
		setWeekDates(weekDatesForBaseMonth(monday, monthAnchor));
		setYear(String(monthAnchor.getFullYear()));
	};

	const applyBeneficiaryState = (state: {
		status: '와상' | '준와상' | '자립';
		dementia: boolean;
		stroke: boolean;
		hypertension: boolean;
		diabetes: boolean;
		arthritis: boolean;
		otherDisease: boolean;
		otherDiseaseText: string;
		tracheostomy: boolean;
		dentures: boolean;
		nasogastricTube: boolean;
		urinaryCatheter: boolean;
		cystostomy: boolean;
		urostomy: boolean;
		colostomy: boolean;
		diaper: boolean;
		pressureSore: boolean;
		pressureSoreArea: string;
		pressureSorePrevention: boolean;
		pressureSorePreventionTool: string;
		roomNo: string;
	}) => {
		setStatus(state.status);
		setDementia(state.dementia);
		setStroke(state.stroke);
		setHypertension(state.hypertension);
		setDiabetes(state.diabetes);
		setArthritis(state.arthritis);
		setOtherDisease(state.otherDisease);
		setOtherDiseaseText(state.otherDiseaseText);
		setTracheostomy(state.tracheostomy);
		setDentures(state.dentures);
		setNasogastricTube(state.nasogastricTube);
		setUrinaryCatheter(state.urinaryCatheter);
		setCystostomy(state.cystostomy);
		setUrostomy(state.urostomy);
		setColostomy(state.colostomy);
		setDiaper(state.diaper);
		setPressureSore(state.pressureSore);
		setPressureSoreArea(state.pressureSoreArea);
		setPressureSorePrevention(state.pressureSorePrevention);
		setPressureSorePreventionTool(state.pressureSorePreventionTool);
		setRoomNo(state.roomNo);
	};

	const resetBeneficiaryDefaults = () => {
		setStatus('준와상');
		setDementia(false);
		setStroke(false);
		setHypertension(false);
		setDiabetes(false);
		setArthritis(false);
		setOtherDisease(false);
		setOtherDiseaseText('');
		setTracheostomy(false);
		setDentures(false);
		setNasogastricTube(false);
		setUrinaryCatheter(false);
		setCystostomy(false);
		setUrostomy(false);
		setColostomy(false);
		setDiaper(false);
		setPressureSore(false);
		setPressureSoreArea('');
		setPressureSorePrevention(false);
		setPressureSorePreventionTool('');
		setRoomNo('');
		setHeaderInfo({
			name: '',
			birthDate: '',
			gradeLabel: '',
			certNo: '',
			institutionName: '너싱홈 해원',
			institutionCode: '14161000067',
			roomNo: ''
		});
	};

	/** 조회: Usp_P14070로 F14070 갱신 후, 해당 수급자 F14070 행으로 화면/출력 데이터 구성 */
	const loadRecordData = async (pnum: string, start: Date, monthAnchor: Date = start) => {
		if (!pnum) {
			resetBeneficiaryDefaults();
			setDailyRecords(createEmptyDailyRecords());
			return;
		}
		setLoading(true);
		resetBeneficiaryDefaults();
		setDailyRecords(createEmptyDailyRecords());
		try {
			const monday = startOfWeekMonday(start);
			const flags = sameMonthDayFlags(monday, monthAnchor);
			const frDt = toYmd(monday);

			const genRes = await fetch('/api/f14070', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ frDt })
			});
			const genJson = await genRes.json().catch(() => ({}));
			if (!genJson?.success) {
				alert(genJson?.error || 'F14070(Usp_P14070) 생성에 실패했습니다.');
				return;
			}

			const getRes = await fetch(`/api/f14070?pnum=${encodeURIComponent(pnum)}`);
			const getJson = await getRes.json().catch(() => ({}));
			if (!getJson?.success) {
				alert(getJson?.error || 'F14070 조회에 실패했습니다.');
				return;
			}

			const row =
				Array.isArray(getJson.data) && getJson.data.length > 0 ? getJson.data[0] : null;
			if (!row) {
				alert('선택한 수급자의 F14070 데이터가 없습니다. 기준일을 확인해 주세요.');
				return;
			}

			const mapped = mapF14070ToFormState(row);
			applyWeekHeader(monday, monthAnchor);

			let beneficiary = mapped.beneficiary;
			const ancd = String(selectedMember?.ANCD ?? '').trim();
			if (ancd) {
				try {
					const lookback = new Date(monday);
					lookback.setDate(lookback.getDate() - 90);
					const sunday = weekDayAt(monday, 6);
					const f14020Rows = await fetchF14020Range(
						ancd,
						pnum,
						toYmd(lookback),
						toYmd(sunday)
					);
					const statusRow = pickBeneficiaryStatusRow(
						f14020Rows,
						toYmd(monthAnchor),
						flags,
						monday
					);
					const overlay = mapBeneficiaryFromF14020(statusRow);
					if (overlay) {
						beneficiary = {
							...overlay,
							roomNo: overlay.roomNo || mapped.beneficiary.roomNo
						};
					}
				} catch (e) {
					console.error('F14020 수급자상태 조회 오류:', e);
				}
			}

			setHeaderInfo({
				name: mapped.header.name || String(selectedMember?.P_NM ?? '').trim(),
				birthDate:
					mapped.header.birthDate ||
					(selectedMember?.P_BRDT ? String(selectedMember.P_BRDT).substring(0, 10) : ''),
				gradeLabel:
					mapped.header.gradeLabel || formatCareGradeLabel(selectedMember?.P_GRD, ''),
				certNo:
					mapped.header.certNo ||
					String(selectedMember?.P_CERTNO ?? selectedMember?.P_YYNO ?? '').trim(),
				institutionName: mapped.header.institutionName,
				institutionCode: mapped.header.institutionCode,
				roomNo: beneficiary.roomNo || mapped.header.roomNo
			});
			applyBeneficiaryState(beneficiary);
			setDailyRecords(maskDailyRecordsForSameMonth(mapped.daily, flags));
		} catch (e) {
			console.error('F14070 조회/생성 오류:', e);
			alert('기록양식 정보를 불러오는 중 오류가 발생했습니다.');
		} finally {
			setLoading(false);
		}
	};

	const ltFormCss = `
		.lt-sheet.lt-form {
			font-family: "Malgun Gothic", "맑은 고딕", Dotum, "돋움", sans-serif;
			font-size: 8pt;
			color: #000;
			line-height: 1.28;
		}
		.lt-sheet.lt-form table { width: 100%; border-collapse: collapse; border-spacing: 0; table-layout: fixed; }
		.lt-sheet.lt-form td, .lt-sheet.lt-form th {
			border: 1px solid #000;
			padding: 4px 2px;
			vertical-align: middle;
			font-weight: normal;
			color: #000;
			box-sizing: border-box;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
		.lt-sheet.lt-form .lt-info { border: 2px solid #000; }
		.lt-sheet.lt-form .lt-info td { border: 1px solid #000; }
		.lt-sheet.lt-form .lt-status { border: 2px solid #000; margin-top: 3px; }
		.lt-sheet.lt-form .lt-status td { border: 1px solid #000; }
		.lt-sheet.lt-form .rec { border: 2px solid #000; margin-top: 3px; }
		.lt-sheet.lt-form .rec td, .lt-sheet.lt-form .rec th { border: 1px solid #000; }
		.lt-sheet.lt-form .lt-right { text-align: right; }
		.lt-sheet.lt-form .lt-center { text-align: center; }
		.lt-sheet.lt-form .lt-left { text-align: left; }
		.lt-sheet.lt-form .lt-bold { font-weight: 700; }
		.lt-sheet.lt-form .lt-head-top {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			gap: 8px;
			margin-bottom: 1px;
		}
		.lt-sheet.lt-form .lt-title {
			font-size: 15pt;
			font-weight: 800;
			text-align: center;
			margin: 2px 0 6px 0;
			letter-spacing: -0.02em;
		}
		.lt-sheet.lt-form .lt-law {
			font-size: 8pt;
			margin: 0;
			flex: 1;
		}
		.lt-sheet.lt-form .lt-front {
			font-size: 8pt;
			text-align: right;
			margin: 0;
			white-space: nowrap;
		}
		.lt-sheet.lt-form .lbl { font-weight: 700; text-align: center; font-size: 8pt; }
		.lt-sheet.lt-form .tight { padding: 2px 3px; }
		.lt-sheet.lt-form .val-bold { font-weight: 700; }
		.lt-sheet.lt-form .cb {
			display: inline-block;
			width: 10px;
			height: 10px;
			border: 1px solid #000;
			vertical-align: middle;
			margin-right: 2px;
			box-sizing: border-box;
			position: relative;
			background: #fff;
		}
		.lt-sheet.lt-form .cb.checked { background: #fff; }
		.lt-sheet.lt-form .cb.checked::after {
			content: "√";
			position: absolute;
			left: 50%;
			top: 42%;
			transform: translate(-50%, -50%);
			font-size: 11px;
			font-weight: 700;
			line-height: 1;
			color: #000;
		}
		.lt-sheet.lt-form .cb-group { display: inline-block; margin-right: 8px; white-space: nowrap; }
		.lt-sheet.lt-form .split-top { display: flex; align-items: center; min-height: 26px; }
		.lt-sheet.lt-form .split-left { flex: 0 0 38%; padding-right: 4px; border-right: 1px solid #000; margin-right: 4px; }
		.lt-sheet.lt-form .split-right { flex: 1; }
		.lt-sheet.lt-form .rec .cat {
			width: 20px;
			writing-mode: vertical-rl;
			text-orientation: mixed;
			vertical-align: middle;
			text-align: center;
			font-weight: 700;
			font-size: 8.5pt;
			line-height: 1.25;
			letter-spacing: 0.12em;
			padding: 4px 1px;
		}
		.lt-sheet.lt-form .rec .cat .cat-label { display: inline-block; }
		.lt-sheet.lt-form .rec .grp { width: 28px; text-align: center; font-weight: 700; font-size: 8pt; vertical-align: middle; }
		.lt-sheet.lt-form .rec .sub { font-size: 7.5pt; text-align: left; line-height: 1.22; padding: 4px 2px 4px 3px; }
		.lt-sheet.lt-form .rec .day { font-size: 8pt; text-align: center; font-weight: 700; }
		.lt-sheet.lt-form .rec .hdr { font-size: 8pt; font-weight: 700; padding: 5px 1px; }
		.lt-sheet.lt-form .rec .tiny { font-size: 7pt; line-height: 1.22; }
		.lt-sheet.lt-form .rec .optcol { display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
		.lt-sheet.lt-form .rec .sig { font-size: 7.5pt; text-align: center; line-height: 1.28; padding: 4px 1px; }
		.lt-sheet.lt-form .rec .sig-r { font-size: 7.5pt; text-align: center; line-height: 1.28; padding: 4px 1px; }
		.lt-sheet.lt-form .rec .time-cell { font-size: 7pt; white-space: nowrap; }
		.lt-sheet.lt-form .lt-footer { margin-top: 3px; font-size: 7.5pt; text-align: right; }
	`;

	/** 화면과 동일하게 보이도록 같은 문서에서 인쇄 (별도 창은 Tailwind 미적용·스타일 불일치 발생) */
	const ltPrintLayoutCss = `
		@media print {
			@page {
				size: A4 portrait;
				margin: 7mm 8mm;
			}
			html, body {
				background: #fff !important;
				-webkit-print-color-adjust: exact !important;
				print-color-adjust: exact !important;
			}
			.lt-no-print {
				display: none !important;
			}
			.lt-longterm-root {
				min-height: 0 !important;
			}
			.lt-longterm-page {
				max-width: none !important;
				padding: 0 !important;
				margin: 0 !important;
			}
			.lt-longterm-card {
				border: none !important;
				box-shadow: none !important;
				border-radius: 0 !important;
				background: #fff !important;
			}
			.lt-longterm-sheet-wrap {
				padding: 0 !important;
				overflow: visible !important;
			}
			.lt-sheet.lt-form {
				max-width: 210mm !important;
				width: 100% !important;
				margin-left: auto !important;
				margin-right: auto !important;
				font-size: 7.5pt !important;
			}
			.lt-sheet.lt-form .lt-title {
				font-size: 14pt !important;
				margin: 1px 0 4px 0 !important;
			}
			.lt-sheet.lt-form td,
			.lt-sheet.lt-form th {
				padding: 3.5px 1.5px !important;
			}
			.lt-sheet.lt-form .rec .hdr {
				padding: 4px 1px !important;
			}
			.lt-sheet.lt-form .rec .sig,
			.lt-sheet.lt-form .rec .sig-r {
				padding: 4px 1px !important;
			}
			.lt-sheet.lt-form .cb,
			.lt-sheet.lt-form .cb.checked {
				-webkit-print-color-adjust: exact !important;
				print-color-adjust: exact !important;
			}
			.lt-sheet.lt-form .cb.checked::after {
				-webkit-print-color-adjust: exact !important;
				print-color-adjust: exact !important;
			}
		}
	`;

	const handlePrint = () => {
		if (typeof window === 'undefined') return;
		setPrintEmpty(false);
		requestAnimationFrame(() => {
			window.print();
		});
	};

	const handlePrintEmpty = () => {
		if (typeof window === 'undefined') return;
		setPrintEmpty(true);
	};

	useEffect(() => {
		if (!printEmpty) return;
		const finish = () => setPrintEmpty(false);
		window.addEventListener('afterprint', finish);
		const frame = window.requestAnimationFrame(() => {
			window.print();
		});
		const fallback = window.setTimeout(finish, 60_000);
		return () => {
			window.cancelAnimationFrame(frame);
			window.clearTimeout(fallback);
			window.removeEventListener('afterprint', finish);
		};
	}, [printEmpty]);

	useEffect(() => {
		applyWeekHeader(weekStart, baseDate);
	}, [weekStart, baseDate]);

	useEffect(() => {
		void loadRecordData(selectedPnum, weekStart, baseDate);
	}, [selectedPnum, weekStart, baseDate]); // eslint-disable-line react-hooks/exhaustive-deps

	useTabRefresh(() => {
		if (!selectedPnum) return;
		void loadRecordData(selectedPnum, weekStart, baseDate);
	});

	const sheetDaily = printEmpty ? createEmptyDailyRecords() : dailyRecords;
	const sheetWeekDates = printEmpty ? empty7() : (weekDates.length ? weekDates : empty7());
	const sheetYear = printEmpty ? '' : year;
	const sheetStatus = printEmpty ? '' : status;
	const sheetDementia = !printEmpty && dementia;
	const sheetStroke = !printEmpty && stroke;
	const sheetHypertension = !printEmpty && hypertension;
	const sheetDiabetes = !printEmpty && diabetes;
	const sheetArthritis = !printEmpty && arthritis;
	const sheetOtherDisease = !printEmpty && otherDisease;
	const sheetOtherDiseaseText = printEmpty ? '' : otherDiseaseText;
	const sheetTracheostomy = !printEmpty && tracheostomy;
	const sheetDentures = !printEmpty && dentures;
	const sheetNasogastricTube = !printEmpty && nasogastricTube;
	const sheetUrinaryCatheter = !printEmpty && urinaryCatheter;
	const sheetCystostomy = !printEmpty && cystostomy;
	const sheetUrostomy = !printEmpty && urostomy;
	const sheetColostomy = !printEmpty && colostomy;
	const sheetDiaper = !printEmpty && diaper;
	const sheetPressureSore = !printEmpty && pressureSore;
	const sheetPressureSoreArea = printEmpty ? '' : pressureSoreArea;
	const sheetPressureSorePrevention = !printEmpty && pressureSorePrevention;
	const sheetPressureSorePreventionTool = printEmpty ? '' : pressureSorePreventionTool;
	const sheetName = printEmpty ? '' : (headerInfo.name || String(selectedMember?.P_NM ?? '').trim());
	const sheetBirthDate = printEmpty
		? ''
		: (headerInfo.birthDate || (selectedMember?.P_BRDT ? String(selectedMember.P_BRDT).substring(0, 10) : ''));
	const sheetGradeLabel = printEmpty
		? ''
		: (headerInfo.gradeLabel || formatCareGradeLabel(selectedMember?.P_GRD, ''));
	const sheetCertNo = printEmpty
		? ''
		: (headerInfo.certNo || String(selectedMember?.P_CERTNO ?? selectedMember?.P_YYNO ?? '').trim());
	const sheetRoomNo = printEmpty
		? ''
		: (roomNo || headerInfo.roomNo || String(selectedMember?.P_ROOM ?? '').trim());

	const vitalDisplay = (i: number) => {
		if (!sheetWeekDates[i]) return '';
		const v = sheetDaily.vitalSigns[i]?.trim();
		return v || <span className="tiny lt-center">/</span>;
	};

return (
		<div className="lt-longterm-root min-h-screen text-black bg-white">
			<style dangerouslySetInnerHTML={{ __html: ltFormCss }} />
			<style dangerouslySetInnerHTML={{ __html: ltPrintLayoutCss }} />

			<div className="lt-longterm-page mx-auto w-full max-w-[1800px] min-w-0 p-3 sm:p-4">
				<div className="flex flex-col lg:flex-row gap-4 min-w-0">
					<aside className="lt-no-print w-full lg:w-1/3 lg:max-w-md shrink-0 min-w-0">
						<MemberListPanel
							onSelectMember={(m) => { setSelectedMember(m); }}
						/>
					</aside>

					<section className="flex-1">
						<div className="lt-longterm-card bg-white border border-blue-300 rounded-lg shadow-sm">
							<div className="lt-no-print flex justify-end px-4 py-3 bg-blue-100 border-b border-blue-200">
								<div className="mr-auto flex items-center gap-2 text-sm text-blue-900">
									<span className="font-semibold">기준일</span>
									<input
										type="date"
										value={toYmd(baseDate)}
										onChange={(e) => {
											const v = e.target.value;
											if (!v) return;
											setBaseDate(startOfDay(new Date(`${v}T00:00:00`)));
										}}
										className="rounded border border-blue-300 bg-white px-2 py-1"
									/>
									<button
										type="button"
										onClick={() => void loadRecordData(selectedPnum, weekStart, baseDate)}
										disabled={!selectedPnum || loading}
										className="px-3 py-1 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										조회
									</button>
									{loading && <span className="text-blue-900/70">불러오는 중...</span>}
								</div>
								<button
									type="button"
									onClick={handlePrintEmpty}
									className="mr-2 px-4 py-2 text-sm font-medium text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-50"
								>
									빈 양식 출력
								</button>
								<button
									type="button"
									onClick={handlePrint}
									className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-700 rounded hover:bg-blue-700"
								>
									출력
								</button>
							</div>

							<div className="relative">
							<div
								className={`lt-longterm-sheet-wrap p-4 overflow-x-auto ${
									!selectedMember && !printEmpty ? 'blur-sm select-none pointer-events-none opacity-70' : ''
								}`}
							>
								<div className="lt-sheet lt-form max-w-[210mm] mx-auto bg-white">
									<div className="lt-head-top">
										<div className="lt-law">■ 노인장기요양보험법 시행규칙 [별지 제16호서식] &lt;개정 2019. 9. 27.&gt;</div>
										<div className="lt-front">(앞쪽)</div>
									</div>
									<div className="lt-title">장기요양급여 제공기록지(시설급여/단기보호)</div>

									<table className="lt-info">
										<tbody>
											<tr>
												<td className="lbl tight" style={{ width: '11%' }}>수급자 성명</td>
												<td className="lt-left val-bold" style={{ width: '14%' }}>
													{sheetName}
												</td>
												<td className="lbl tight" style={{ width: '11%' }}>생년월일</td>
												<td className="lt-center val-bold" style={{ width: '14%' }}>
													{sheetBirthDate}
												</td>
												<td className="lbl tight" style={{ width: '11%' }}>장기요양등급</td>
												<td className="lt-center val-bold" style={{ width: '10%' }}>
													{sheetGradeLabel}
												</td>
												<td className="lbl tight" style={{ width: '13%' }}>장기요양인정번호</td>
												<td className="lt-center val-bold" style={{ width: '16%' }}>
													{sheetCertNo}
												</td>
											</tr>
											<tr>
												<td className="lbl tight">장기요양기관명</td>
												<td className="lt-left val-bold" colSpan={3}>
													{headerInfo.institutionName || '너싱홈 해원'}
												</td>
												<td className="lbl tight">장기요양기관기호</td>
												<td className="lt-center val-bold">
													{headerInfo.institutionCode || '14161000067'}
												</td>
												<td className="lbl tight">침실</td>
												<td className="lt-center val-bold">
													{sheetRoomNo}
												</td>
											</tr>
										</tbody>
									</table>

									<table className="lt-status" style={{ marginTop: '3px' }}>
										<tbody>
											<tr>
												<td className="lbl lt-center" rowSpan={4} style={{ width: '28px' }}>
													수급자
													<br />
													상태
												</td>
												<td colSpan={2} style={{ padding: 0 }}>
													<div className="split-top">
														<div className="split-left lt-left">
															<span className="cb-group">
																<span className={`cb ${sheetStatus === '와상' ? 'checked' : ''}`} />
																와상
															</span>
															<span className="cb-group">
																<span className={`cb ${sheetStatus === '준와상' ? 'checked' : ''}`} />
																준와상
															</span>
															<span className="cb-group">
																<span className={`cb ${sheetStatus === '자립' ? 'checked' : ''}`} />
																자립
															</span>
														</div>
														<div className="split-right lt-left">
															<span className="cb-group">
																<span className={`cb ${sheetDementia ? 'checked' : ''}`} />
																치매
															</span>
															<span className="cb-group">
																<span className={`cb ${sheetStroke ? 'checked' : ''}`} />
																중풍
															</span>
															<span className="cb-group">
																<span className={`cb ${sheetHypertension ? 'checked' : ''}`} />
																고혈압
															</span>
															<span className="cb-group">
																<span className={`cb ${sheetDiabetes ? 'checked' : ''}`} />
																당뇨
															</span>
															<span className="cb-group">
																<span className={`cb ${sheetArthritis ? 'checked' : ''}`} />
																관절염
															</span>
															<span className="cb-group">
																<span className={`cb ${sheetOtherDisease ? 'checked' : ''}`} />
																기타({String(sheetOtherDiseaseText ?? '').trim()})
															</span>
														</div>
													</div>
												</td>
											</tr>
											<tr>
												<td className="lt-left" colSpan={2}>
													<span className="cb-group">
														<span className={`cb ${sheetTracheostomy ? 'checked' : ''}`} />
														기관지절개관
													</span>
													<span className="cb-group">
														<span className={`cb ${sheetDentures ? 'checked' : ''}`} />
														틀니(부분/전체)
													</span>
													<span className="cb-group">
														<span className={`cb ${sheetNasogastricTube ? 'checked' : ''}`} />
														비위관(鼻胃管, L-tube)
													</span>
													<span className="cb-group">
														<span className={`cb ${sheetUrinaryCatheter ? 'checked' : ''}`} />
														고정소변배출관(유치도뇨관)
													</span>
												</td>
											</tr>
											<tr>
												<td className="lt-left" colSpan={2}>
													<span className="cb-group">
														<span className={`cb ${sheetCystostomy ? 'checked' : ''}`} />
														방광루
													</span>
													<span className="cb-group">
														<span className={`cb ${sheetUrostomy ? 'checked' : ''}`} />
														요루(요도샛길)
													</span>
													<span className="cb-group">
														<span className={`cb ${sheetColostomy ? 'checked' : ''}`} />
														장루(창자샛길)
													</span>
													<span className="cb-group">
														<span className={`cb ${sheetDiaper ? 'checked' : ''}`} />
														기저귀
													</span>
												</td>
											</tr>
											<tr>
												<td className="lt-left" colSpan={2}>
													<span className="cb-group">
														<span className={`cb ${sheetPressureSore ? 'checked' : ''}`} />
														욕창(부위: {String(sheetPressureSoreArea ?? '').trim()})
													</span>
													<span className="cb-group">
														<span className={`cb ${sheetPressureSorePrevention ? 'checked' : ''}`} />
														욕창방지 보조도구({String(sheetPressureSorePreventionTool ?? '').trim()})
													</span>
												</td>
											</tr>
										</tbody>
									</table>

									<table className="rec" style={{ marginTop: '3px' }}>
										<thead>
											<tr>
												<th className="lt-center" style={{ width: '20px' }} rowSpan={2} />
												<th className="lt-center lbl" colSpan={2} rowSpan={2} style={{ width: 'auto' }}>
													구분
												</th>
												<th className="lt-center lbl" colSpan={7}>
													( {sheetYear} )년&nbsp;&nbsp;월/일
												</th>
											</tr>
											<tr>
												{sheetWeekDates.map((d, i) => (
													<th key={i} className="day hdr">
														{d}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											<tr>
												<td className="cat" rowSpan={11}>
													신체활동지원
												</td>
												<td className="sub" colSpan={2}>
													세면, 구강, 머리감기, 몸단장, 옷 갈아입히기
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center">
														<span className={`cb ${sheetDaily.grooming[i] ? 'checked' : ''}`} />
													</td>
												))}
											</tr>
											<tr>
												<td className="grp" rowSpan={2}>
													목욕
												</td>
												<td className="sub">소요시간</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center tiny time-cell">
														{sheetDaily.bathTime[i] ? `${sheetDaily.bathTime[i]} 분` : '분'}
													</td>
												))}
											</tr>
											<tr>
												<td className="sub">방법</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="tiny lt-left">
														<div className="optcol">
															<div>
																<span className={`cb ${sheetDaily.bathMethod[i] === '1' ? 'checked' : ''}`} />
																전신입욕
															</div>
															<div>
																<span className={`cb ${sheetDaily.bathMethod[i] === '2' ? 'checked' : ''}`} />
																샤워식
															</div>
														</div>
													</td>
												))}
											</tr>
											<tr>
												<td className="grp" rowSpan={2}>
													식사
												</td>
												<td className="sub">종류</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="tiny lt-left">
														<div className="optcol">
															<div>
																<span className={`cb ${sheetDaily.mealType[i] === '일반식' ? 'checked' : ''}`} />
																일반식
															</div>
															<div>
																<span className={`cb ${sheetDaily.mealType[i] === '죽' ? 'checked' : ''}`} />
																죽
															</div>
															<div>
																<span className={`cb ${sheetDaily.mealType[i] === '유동식(미음)' || sheetDaily.mealType[i] === '유동식' ? 'checked' : ''}`} />
																유동식(미음)
															</div>
														</div>
													</td>
												))}
											</tr>
											<tr>
												<td className="sub">섭취량</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="tiny lt-left">
														<div className="optcol">
															<div>
																<span className={`cb ${sheetDaily.mealIntake[i] === '1' ? 'checked' : ''}`} />
																1
															</div>
															<div>
																<span className={`cb ${sheetDaily.mealIntake[i] === '1/2이상' ? 'checked' : ''}`} />
																1/2이상
															</div>
															<div>
																<span className={`cb ${sheetDaily.mealIntake[i] === '1/2미만' ? 'checked' : ''}`} />
																1/2미만
															</div>
														</div>
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													체위변경 (2시간마다)
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center">
														<span className={`cb ${sheetDaily.positionChange[i] ? 'checked' : ''}`} />
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													화장실이용하기 (기저귀 교환)
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center tiny time-cell">
														{sheetDaily.toiletUsage[i] ? `${sheetDaily.toiletUsage[i]} 회` : '회'}
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													이동도움 및 신체 기능유지·증진
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center">
														<span className={`cb ${sheetDaily.movementAssistance[i] ? 'checked' : ''}`} />
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													산책(외출)동행
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="tiny lt-left">
														<div className="optcol">
															<div>
																<span className={`cb ${sheetDaily.walk[i] ? 'checked' : ''}`} />
																산책
															</div>
															<div>
																<span className={`cb ${sheetDaily.outing[i] ? 'checked' : ''}`} />
																외출
															</div>
														</div>
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													특이사항
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="tiny lt-left" style={{ minHeight: '18px' }}>
														{sheetDaily.physicalActivityNotes[i] || ''}
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													작성자 성명
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="sig">
														<span className="tiny">{sheetDaily.physicalActivityPreparer[i] || '\u00a0'}</span>
														<br />
														<span className="tiny">(싸인)</span>
													</td>
												))}
											</tr>

											<tr>
												<td className="cat" rowSpan={4}>
													인지관리 및 의사소통
												</td>
												<td className="sub" colSpan={2}>
													인지관리지원
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center">
														<span className={`cb ${sheetDaily.cognitiveSupport[i] ? 'checked' : ''}`} />
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													의사소통도움 등 말벗, 격려
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center">
														<span className={`cb ${sheetDaily.communicationSupport[i] ? 'checked' : ''}`} />
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													특이사항
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="tiny lt-left">
														{sheetDaily.cognitiveNotes[i] || ''}
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													작성자 성명
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="sig">
														<span className="tiny">{sheetDaily.cognitivePreparer[i] || '\u00a0'}</span>
														<br />
														<span className="tiny">(싸인)</span>
													</td>
												))}
											</tr>

											<tr>
												<td className="cat" rowSpan={6}>
													<span className="cat-label">건강 및 간호관리</span>
												</td>
												<td className="sub" colSpan={2}>
													혈압/체온
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center tiny">
														{vitalDisplay(i)}
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													건강관리( 분)
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center tiny time-cell">
														<span className={`cb ${sheetDaily.healthManagement[i] ? 'checked' : ''}`} />
														{sheetDaily.healthTime[i] ? ` ${sheetDaily.healthTime[i]}` : ''}
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													간호관리( 분)
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center tiny time-cell">
														<span className={`cb ${sheetDaily.nursingManagement[i] ? 'checked' : ''}`} />
														{sheetDaily.nursingTime[i] ? ` ${sheetDaily.nursingTime[i]}` : ''}
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													기타(응급서비스)
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center">
														<span className={`cb ${sheetDaily.emergencyService[i] ? 'checked' : ''}`} />
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													특이사항
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="tiny lt-left">
														{sheetDaily.healthNotes[i] || ''}
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													작성자 성명
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="sig">
														<span className="tiny">{sheetDaily.healthPreparer[i] || '\u00a0'}</span>
														<br />
														<span className="tiny">(싸인)</span>
													</td>
												))}
											</tr>

											<tr>
												<td className="cat" rowSpan={6}>
													기능회복훈련
												</td>
												<td className="sub" colSpan={2}>
													신체·인지기능 향상 프로그램
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center">
														<span className={`cb ${sheetDaily.trainingProgram[i] ? 'checked' : ''}`} />
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													신체기능·기본동작, 일상생활동작훈련
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center">
														<span className={`cb ${sheetDaily.physicalFunctionTraining[i] ? 'checked' : ''}`} />
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													인지기능 향상훈련
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center">
														<span className={`cb ${sheetDaily.cognitiveTraining[i] ? 'checked' : ''}`} />
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													물리(작업)치료
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center">
														<span className={`cb ${sheetDaily.physicalTherapy[i] ? 'checked' : ''}`} />
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													특이사항
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="tiny lt-left">
														{sheetDaily.trainingNotes[i] || ''}
													</td>
												))}
											</tr>
											<tr>
												<td className="sub" colSpan={2}>
													작성자 성명
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="sig">
														<span className="tiny">{sheetDaily.trainingPreparer[i] || '\u00a0'}</span>
														<br />
														<span className="tiny">(싸인)</span>
													</td>
												))}
											</tr>

											<tr>
												<td className="lbl lt-center" colSpan={3} style={{ lineHeight: 1.25 }}>
													수급자의 입·퇴소시간,
													<br />
													외박 및 복귀시간, 외출시간
												</td>
												{sheetWeekDates.map((_, i) => (
													<td key={i} className="lt-center tiny">
														{sheetDaily.admissionDischargeTime[i] || ''}
													</td>
												))}
											</tr>
										</tbody>
									</table>

									<div className="lt-footer">210mm×297mm[백상지 80g/㎡]</div>
								</div>
							</div>
							{!selectedMember && !printEmpty && (
								<div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-white/30 backdrop-blur-[1px] lt-no-print">
									<p className="text-center text-lg font-semibold text-blue-900 bg-white/95 px-8 py-5 rounded-lg border border-blue-300 shadow-md max-w-sm">
										수급자를 선택해주세요
									</p>
								</div>
							)}
						</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
