/**
 * @file F14020(일 급여실적) 일자·상세 조회/저장 헬퍼
 */

export function formatDateYmd(v: unknown): string {
	if (v == null) return '';
	const s = String(v).trim();
	if (!s) return '';
	if (s.includes('T')) return s.split('T')[0];
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	return s.length >= 10 ? s.slice(0, 10) : s;
}

export function formatDateDisplay(dateStr: string): string {
	return formatDateYmd(dateStr);
}

export async function fetchF14020ServiceDates(ancd: string, pnum: string): Promise<string[]> {
	if (!ancd || !pnum) return [];

	const today = new Date();
	const end = formatDateYmd(today.toISOString());
	const oneYearAgo = new Date(today);
	oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
	const start = formatDateYmd(oneYearAgo.toISOString());

	const url = `/api/f14020?ancd=${encodeURIComponent(ancd)}&pnum=${encodeURIComponent(
		pnum
	)}&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
	const response = await fetch(url, { method: 'GET' });
	const result = await response.json().catch(() => ({}));
	if (!response.ok || !result?.success) {
		throw new Error(result?.error || '서비스제공일자 조회 실패');
	}

	const list = Array.isArray(result.data) ? result.data : [];
	const dates = Array.from(
		new Set(
			list
				.map((r: any) => formatDateYmd(r?.SVDT))
				.filter((d: string) => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
		)
	) as string[];
	dates.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
	return dates;
}

export async function fetchF14020Detail(ancd: string, pnum: string, svdt: string): Promise<any | null> {
	if (!ancd || !pnum || !svdt) return null;
	const url = `/api/f14020?ancd=${encodeURIComponent(ancd)}&pnum=${encodeURIComponent(
		pnum
	)}&svdt=${encodeURIComponent(svdt)}`;
	const res = await fetch(url, { method: 'GET' });
	const json = await res.json().catch(() => ({}));
	if (!res.ok || !json?.success) {
		throw new Error(json?.error || '상세 조회 실패');
	}
	return Array.isArray(json.data) ? json.data?.[0] ?? null : null;
}

export async function fetchF14020Range(
	ancd: string,
	pnum: string,
	startDate: string,
	endDate: string
): Promise<any[]> {
	if (!ancd || !pnum || !startDate || !endDate) return [];
	const url = `/api/f14020?ancd=${encodeURIComponent(ancd)}&pnum=${encodeURIComponent(
		pnum
	)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
	const res = await fetch(url, { method: 'GET' });
	const json = await res.json().catch(() => ({}));
	if (!res.ok || !json?.success) {
		throw new Error(json?.error || '기간 조회 실패');
	}
	return Array.isArray(json.data) ? json.data : [];
}

export async function saveF14020Fields(
	ancd: string,
	pnum: string,
	svdt: string,
	fields: Record<string, any>
): Promise<void> {
	const payload = { svdt, rows: [{ pnum, ...fields }] };
	const res = await fetch(`/api/f14020?ancd=${encodeURIComponent(ancd)}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok || !json?.success) {
		throw new Error(json?.error || '저장 실패');
	}
}
