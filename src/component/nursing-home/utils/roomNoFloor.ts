export const NO_ROOM_VALUE = '__NO_ROOM__';

export function normalizeRoomNo(roomNo: unknown): string {
	const s = String(roomNo ?? '').trim();
	// F14090 등에서 미배정을 '0'으로 넣는 경우가 있어 방번호 없음으로 취급
	if (!s || s === '0') return '';
	return s;
}

/** PNUM 맵 키 정규화 (선행 0 / number·string 불일치 흡수) */
export function normalizePnumKey(pnum: unknown): string {
	const s = String(pnum ?? '').trim();
	if (!s) return '';
	if (/^\d+$/.test(s)) return String(Number(s));
	return s;
}

/**
 * 방번호에서 층 추출.
 * - 104 => 1층, 1203 => 12층 (방번호 ≥ 100 인코딩)
 * - '0', 빈값, 100 미만 숫자만 있는 값 => null (층 인코딩으로 보지 않음)
 */
export function extractFloorFromRoomNo(roomNo: unknown): number | null {
	const s = normalizeRoomNo(roomNo);
	if (!s) return null;
	const digits = s.replace(/\D/g, '');
	if (!digits) return null;
	const n = Number(digits);
	if (!Number.isFinite(n) || n < 100) return null;
	return Math.floor(n / 100);
}

/** F10010.P_FLOOR 직접 층수 */
export function extractFloorFromPFloor(pFloor: unknown): number | null {
	if (pFloor === null || pFloor === undefined) return null;
	const s = String(pFloor).trim();
	if (!s) return null;
	const n = Number(s);
	if (!Number.isFinite(n) || n < 0) return null;
	return n;
}

/**
 * 수급자 층수: ROOM_NO 인코딩 우선, 없으면 P_FLOOR.
 * (방번호가 0/미설정이어도 P_FLOOR로 1·2·3층 필터 옵션을 구성)
 */
export function extractMemberFloor(
	member: { ROOM_NO?: unknown; P_FLOOR?: unknown } | null | undefined
): number | null {
	if (!member) return null;
	const fromRoom = extractFloorFromRoomNo(member.ROOM_NO);
	if (fromRoom !== null) return fromRoom;
	return extractFloorFromPFloor(member.P_FLOOR);
}

export function countNoRoom<T extends { ROOM_NO?: unknown }>(members: T[]): number {
	return members.filter((m) => normalizeRoomNo(m?.ROOM_NO) === '').length;
}

export function availableFloorsFromMembers<
	T extends { ROOM_NO?: unknown; P_FLOOR?: unknown },
>(members: T[]): number[] {
	return Array.from(
		new Set(members.map((m) => extractMemberFloor(m)).filter((f): f is number => f !== null))
	).sort((a, b) => a - b);
}

/**
 * 최신 YYYYMM 기준 F14090에서 ROOM_NO를 가져와 members(주로 F10010) 데이터에 병합.
 * - key: PNUM (정규화, F14090는 세션 ANCD로 이미 제한됨)
 */
export async function attachLatestRoomNoByPnum<T extends { PNUM?: unknown; ROOM_NO?: unknown }>(
	members: T[]
): Promise<T[]> {
	if (!Array.isArray(members) || members.length === 0) return members;
	try {
		const res = await fetch('/api/f14090');
		const json = await res.json();
		if (!json?.success || !Array.isArray(json.data)) return members;

		const roomByPnum = new Map<string, unknown>();
		json.data.forEach((row: any) => {
			const pnumKey = normalizePnumKey(row?.PNUM);
			if (!pnumKey) return;
			roomByPnum.set(pnumKey, row?.ROOM_NO ?? null);
		});

		return members.map((m) => {
			const pnumKey = normalizePnumKey((m as any)?.PNUM);
			const roomNo = pnumKey ? roomByPnum.get(pnumKey) : undefined;
			return { ...(m as any), ROOM_NO: roomNo ?? (m as any).ROOM_NO ?? null };
		}) as T[];
	} catch {
		return members;
	}
}

/**
 * F30112(수급자 입력 기준정보)에서 PNUM별 최신 ROOM_NO 조회
 */
export async function fetchRoomNoMapFromF30112(
	pnums: unknown[]
): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	const unique = Array.from(
		new Set(
			(Array.isArray(pnums) ? pnums : [])
				.map((p) => normalizePnumKey(p))
				.filter(Boolean)
		)
	);
	if (unique.length === 0) return map;

	try {
		// URL 길이 제한 대비 청크
		const chunkSize = 80;
		for (let i = 0; i < unique.length; i += chunkSize) {
			const chunk = unique.slice(i, i + chunkSize);
			const res = await fetch(`/api/f30112?pnums=${encodeURIComponent(chunk.join(','))}`);
			const json = await res.json().catch(() => ({}));
			if (!json?.success || !Array.isArray(json.data)) continue;
			json.data.forEach((row: any) => {
				const key = normalizePnumKey(row?.PNUM);
				if (!key) return;
				const room = normalizeRoomNo(row?.ROOM_NO);
				if (room) map.set(key, room);
			});
		}
	} catch {
		/* ignore */
	}
	return map;
}
