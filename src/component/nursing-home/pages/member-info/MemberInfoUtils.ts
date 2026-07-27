import { normalizePGrdForSelect } from '../../utils/careGrade';

export interface MemberData {
	[key: string]: any;
}

export function escapeHtml(v: unknown): string {
	const s = String(v ?? '');
	return s
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

/** DB/API에서 오는 날짜를 date input용 YYYY-MM-DD 문자열로 */
export function toDateInputString(v: unknown): string {
	if (v == null || v === '') return '';
	if (typeof v === 'string') {
		const s = v.trim();
		return s.length >= 10 ? s.slice(0, 10) : s;
	}
	if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	return '';
}

export function fmtDate10(v: unknown): string {
	const s = toDateInputString(v);
	return s || '';
}

export function fmtStatus(v: unknown): string {
	const s = String(v ?? '').trim();
	if (s === '1') return '입소';
	if (s === '9') return '퇴소';
	return s || '';
}

export function fmtSex(v: unknown): string {
	const s = String(v ?? '').trim();
	if (s === '1') return '남';
	if (s === '2') return '여';
	return s || '';
}

export function todayYYYYMMDD(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** 수정 모드 진입 시 select·input과 맞추기 위해 스칼라 필드 정규화 */
export function buildMemberForEdit(m: MemberData): MemberData {
	const floor = m.P_FLOOR;
	const floorStr =
		floor === 0 || floor === '0'
			? String(floor)
			: floor !== null && floor !== undefined && floor !== ''
				? String(floor)
				: '';

	return {
		...m,
		selectedANCD: String(m.ANCD ?? ''),
		P_GRD: normalizePGrdForSelect(m.P_GRD),
		P_FLOOR: floorStr,
		P_BRDT: toDateInputString(m.P_BRDT),
		P_YYDT: toDateInputString(m.P_YYDT),
		P_CTDT: toDateInputString(m.P_CTDT),
		P_SDT: toDateInputString(m.P_SDT),
		P_EDT: toDateInputString(m.P_EDT),
		P_YYSDT: toDateInputString(m.P_YYSDT),
		P_YYEDT: toDateInputString(m.P_YYEDT),
		INSPER: m.INSPER !== undefined && m.INSPER !== null ? String(m.INSPER) : '',
		USRPER: m.USRPER !== undefined && m.USRPER !== null ? String(m.USRPER) : '',
	};
}

/** 보호자 정보 카드 조회 모드의 관계 표시 (BHREL 코드 → 라벨, 없으면 GUARDIAN_P_TEL) */
export function formatGuardianRelation(member: MemberData | null | undefined): string {
	const m = member ?? ({} as MemberData);
	return m.BHREL === '10'
		? '남편'
		: m.BHREL === '11'
			? '부인'
			: m.BHREL === '20'
				? '아들'
				: m.BHREL === '21'
					? '딸'
					: m.BHREL === '22'
						? '며느리'
						: m.BHREL === '23'
							? '사위'
							: m.BHREL === '31'
								? '손주'
								: !m.BHREL || m.BHREL === null || m.BHREL === ''
									? m.GUARDIAN_P_TEL || '-'
									: m.BHREL || m.BHETC || '-';
}
