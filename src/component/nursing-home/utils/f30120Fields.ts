/** F30120 공통 매핑 헬퍼 (일상/주기 활력증상) */

export function toYmd(raw: unknown): string {
	if (raw == null || raw === '') return '';
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		const y = raw.getFullYear();
		const m = String(raw.getMonth() + 1).padStart(2, '0');
		const d = String(raw.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(raw).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	const parsed = new Date(s);
	if (!Number.isNaN(parsed.getTime())) {
		const y = parsed.getFullYear();
		const m = String(parsed.getMonth() + 1).padStart(2, '0');
		const d = String(parsed.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return '';
}

/** BJYN: 1=없음, 2=있음 */
export function bjynToBool(v: unknown): boolean {
	const s = String(v ?? '').trim();
	return s === '2' || s === 'Y' || s === 'y';
}

export function boolToBjyn(checked: boolean): string {
	return checked ? '2' : '1';
}

/** BJDG: 1:+, 2:++, 3:+++ */
export function bjdgToLabel(v: unknown): string {
	const s = String(v ?? '').trim();
	if (s === '1' || s === '+') return '+';
	if (s === '2' || s === '++') return '++';
	if (s === '3' || s === '+++') return '+++';
	return '';
}

export function labelToBjdg(label: string): string | null {
	const s = String(label ?? '').trim();
	if (!s) return null;
	if (s === '+' || s === '1') return '1';
	if (s === '++' || s === '2') return '2';
	if (s === '+++' || s === '3') return '3';
	return null;
}

/** 0/1 플래그 */
export function flag01ToBool(v: unknown): boolean {
	return String(v ?? '').trim() === '1';
}

export function boolToFlag01(checked: boolean): string {
	return checked ? '1' : '0';
}

/** N/Y 플래그 */
export function flagNyToBool(v: unknown): boolean {
	const s = String(v ?? '').trim().toUpperCase();
	return s === 'Y' || s === '1';
}

export function boolToFlagNy(checked: boolean): string {
	return checked ? 'Y' : 'N';
}

export function parseBloodPressure(bp: string): { sbdp: number | null; ebdp: number | null } {
	const s = String(bp ?? '').trim();
	if (!s) return { sbdp: null, ebdp: null };
	const m = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
	if (m) {
		return { sbdp: Number(m[1]), ebdp: Number(m[2]) };
	}
	const n = Number(s);
	if (Number.isFinite(n)) return { sbdp: n, ebdp: null };
	return { sbdp: null, ebdp: null };
}

export function toNullableNumber(v: unknown): number | null {
	if (v == null || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

export function toNullableDecimal(v: unknown): number | null {
	return toNullableNumber(v);
}
