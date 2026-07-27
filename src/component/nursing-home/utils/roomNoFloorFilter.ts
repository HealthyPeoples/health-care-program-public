import {
	NO_ROOM_VALUE,
	extractFloorFromRoomNo,
	extractMemberFloor,
	normalizeRoomNo,
} from './roomNoFloor';

/** @deprecated prefer matchesSelectedFloor(member, selectedFloor) — P_FLOOR 폴백 포함 */
export function matchesSelectedFloorByRoomNo(roomNo: unknown, selectedFloor: string): boolean {
	if (!selectedFloor) return true;

	if (selectedFloor === NO_ROOM_VALUE) {
		return normalizeRoomNo(roomNo) === '';
	}

	const memberFloor = extractFloorFromRoomNo(roomNo);
	const selectedFloorNum = Number(String(selectedFloor).trim());
	if (!Number.isFinite(selectedFloorNum)) return false;
	return memberFloor === selectedFloorNum;
}

/** 층수 필터 매칭 (ROOM_NO 인코딩 → P_FLOOR 순) */
export function matchesSelectedFloor(
	member: { ROOM_NO?: unknown; P_FLOOR?: unknown } | null | undefined,
	selectedFloor: string
): boolean {
	if (!selectedFloor) return true;

	if (selectedFloor === NO_ROOM_VALUE) {
		return normalizeRoomNo(member?.ROOM_NO) === '';
	}

	const memberFloor = extractMemberFloor(member);
	const selectedFloorNum = Number(String(selectedFloor).trim());
	if (!Number.isFinite(selectedFloorNum)) return false;
	return memberFloor === selectedFloorNum;
}
