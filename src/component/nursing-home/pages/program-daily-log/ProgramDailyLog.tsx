"use client";

/**
 * @file 프로그램일지 — 화면 컴포넌트 (ProgramDailyLog.tsx)
 *
 * @description
 * 요양원 프로그램일지 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/program-daily-log
 *
 * @module component/nursing-home/pages/program-daily-log/ProgramDailyLog
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import ProgramAttendeeEvalModal, {
	LevelBadge,
	type AttendeeEval,
} from "./ProgramAttendeeEvalModal";
import { formatCareGradeLabel, normalizePGrdForSelect } from "../../utils/careGrade";

/** F14030 행 */
interface F14030Row {
	ANCD?: number;
	DSEQ?: number;
	SVDT?: string | Date | null;
	SVSTM?: string | null;
	SVETM?: string | null;
	SVGU?: string | null;
	SVDIC?: string | null;
	SVDES?: string | null;
	PGMAN0?: string | null;
	PGADD?: string | null;
	PGMAN1?: string | null;
	PGMAN2?: string | null;
	PGOJ?: string | null;
	PGJB?: string | null;
	PGDES?: string | null;
	INDT?: string | Date | null;
	ETC?: string | null;
	INEMPNO?: number | null;
	INEMPNM?: string | null;
	PGSEQ?: number | null;
	MIMG?: string | null;
	PG_GU?: string | null;
	PG_GU_NM?: string | null;
	SVDIC_SUB?: string | null;
}

const PG_GU_OPTIONS: { code: string; label: string }[] = [
	{ code: "1", label: "인지기능강화" },
	{ code: "2", label: "신체기능강화" },
	{ code: "3", label: "사회적응프로그램" },
	{ code: "4", label: "가족참여프로그램" },
	{ code: "6", label: "여가프로그램" },
	{ code: "9", label: "기타" },
];

/** 서비스구분 코드 SVGU — DB 1자리 */
const SVGU_OPTIONS: { code: string; label: string }[] = [
	{ code: "1", label: "프로그램" },
	{ code: "2", label: "교육" },
];

const DATE_PAGE_SIZE = 13;
/** 왼쪽 서비스일자 페이지 번호 표시 개수 */
const DATE_PAGE_NUMBER_WINDOW = 5;
/** 오른쪽 상단 프로그램 목록(표) — 한 페이지당 행 수, 영역 높이와 동일 */
const PROGRAM_LIST_PAGE_SIZE = 3;

function formatYmd(value: unknown): string {
	if (value == null || value === "") return "";
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return "";
		const y = value.getFullYear();
		const mo = String(value.getMonth() + 1).padStart(2, "0");
		const d = String(value.getDate()).padStart(2, "0");
		return `${y}-${mo}-${d}`;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		const str = String(Math.trunc(value));
		if (/^\d{8}$/.test(str)) return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
	}
	const s = String(value).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return "";
}

function monthRangeYmd(d: Date): { start: string; end: string } {
	const y = d.getFullYear();
	const m = d.getMonth();
	const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
	const last = new Date(y, m + 1, 0).getDate();
	const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
	return { start, end };
}

function parsePgseq(value: unknown): number | null {
	if (value == null || value === "") return null;
	if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
	const n = parseInt(String(value).trim(), 10);
	return Number.isNaN(n) ? null : n;
}

function labelFromPgGuCode(guRaw: string): string {
	const gu = String(guRaw ?? "").trim().replace(/^0+/, "");
	if (!gu) return "";
	const o = PG_GU_OPTIONS.find((x) => x.code === gu);
	return o ? o.label : gu;
}

/** F14030 행 표시용 — PGSEQ로 F14040의 PG_GU를 우선 적용 */
function programCategoryLabel(row: F14030Row, pgseqToPgGu: ReadonlyMap<number, string>): string {
	const seq = parsePgseq(row.PGSEQ);
	if (seq != null) {
		const gu40 = pgseqToPgGu.get(seq);
		if (gu40 != null && String(gu40).trim() !== "") {
			const lbl = labelFromPgGuCode(String(gu40));
			if (lbl) return lbl;
		}
	}
	const nm = String(row.PG_GU_NM ?? "").trim();
	if (nm) return nm;
	const gu = String(row.PG_GU ?? "").trim().replace(/^0+/, "");
	if (gu) {
		const o = PG_GU_OPTIONS.find((x) => x.code === gu);
		if (o) return o.label;
		return gu;
	}
	const svgu = String(row.SVGU ?? "").trim();
	const svguOpt = SVGU_OPTIONS.find((x) => x.code === svgu);
	if (svguOpt) return svguOpt.label;
	return svgu || "-";
}

/** 폼 상태에 F14040 기준 PG_GU / PG_GU_NM 반영 */
function mergePlanPgGuFromF14040(
	fd: Record<string, string>,
	pgseqToPgGu: ReadonlyMap<number, string>,
): Record<string, string> {
	const seq = parsePgseq(fd.PGSEQ);
	if (seq == null) return fd;
	const gu40 = pgseqToPgGu.get(seq);
	if (gu40 == null || String(gu40).trim() === "") return fd;
	const code = String(gu40).trim().replace(/^0+/, "");
	const o = PG_GU_OPTIONS.find((x) => x.code === code);
	return { ...fd, PG_GU: code, PG_GU_NM: o ? o.label : fd.PG_GU_NM };
}

function emptyForm(svdDate: string): Record<string, string> {
	return {
		SVDT: svdDate,
		SVSTM: "",
		SVETM: "",
		SVGU: "1",
		SVDIC: "",
		SVDES: "",
		PGMAN0: "",
		PGADD: "",
		PGMAN1: "",
		PGMAN2: "",
		PGOJ: "",
		PGJB: "",
		PGDES: "",
		INDT: formatYmd(new Date()),
		ETC: "",
		PGSEQ: "",
		MIMG: "",
		PG_GU: "",
		PG_GU_NM: "",
		SVDIC_SUB: "",
		INEMPNO: "",
		INEMPNM: "",
	};
}

function rowToForm(row: F14030Row): Record<string, string> {
	return {
		SVDT: formatYmd(row.SVDT),
		SVSTM: timeFromRow(row.SVSTM),
		SVETM: timeFromRow(row.SVETM),
		SVGU: (() => {
			const s = String(row.SVGU ?? "").trim();
			return s === "1" || s === "2" ? s : "";
		})(),
		SVDIC: String(row.SVDIC ?? ""),
		SVDES: String(row.SVDES ?? ""),
		PGMAN0: String(row.PGMAN0 ?? ""),
		PGADD: String(row.PGADD ?? ""),
		PGMAN1: String(row.PGMAN1 ?? ""),
		PGMAN2: String(row.PGMAN2 ?? ""),
		PGOJ: String(row.PGOJ ?? ""),
		PGJB: String(row.PGJB ?? ""),
		PGDES: String(row.PGDES ?? ""),
		INDT: formatYmd(row.INDT) || formatYmd(new Date()),
		ETC: String(row.ETC ?? ""),
		PGSEQ: row.PGSEQ != null ? String(row.PGSEQ) : "",
		MIMG: String(row.MIMG ?? ""),
		PG_GU: String(row.PG_GU ?? "").replace(/^0+/, ""),
		PG_GU_NM: String(row.PG_GU_NM ?? ""),
		SVDIC_SUB: String(row.SVDIC_SUB ?? ""),
		INEMPNO: row.INEMPNO != null ? String(row.INEMPNO) : "",
		INEMPNM: String(row.INEMPNM ?? ""),
	};
}

type UserInfo = { empno?: string | number; empnm?: string; [key: string]: unknown };

function padTimeForInput(t: string): string {
	const s = String(t ?? "").trim();
	if (/^\d{2}:\d{2}$/.test(s)) return s;
	const m = s.match(/^(\d{1,2}):(\d{1,2})/);
	if (m) {
		return `${String(parseInt(m[1], 10)).padStart(2, "0")}:${String(parseInt(m[2], 10)).padStart(2, "0")}`;
	}
	if (/^\d{3,4}$/.test(s)) {
		const padded = s.padStart(4, "0");
		return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
	}
	return "";
}

/** DB/직렬화된 시간 → HH:mm (5자) */
function timeFromRow(value: unknown): string {
	if (value == null || value === "") return "";
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		const h = value.getHours();
		const mi = value.getMinutes();
		return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
	}
	const s = String(value).trim();
	const iso = s.match(/(\d{1,2}):(\d{2})/);
	if (iso) return padTimeForInput(`${iso[1]}:${iso[2]}`);
	return padTimeForInput(s);
}

/** F14040 계획서 — 일지 선택·자동반영·출력 공통 */
type F14040PlanLite = {
	PGSEQ?: number;
	PG_GU?: string | null;
	PGNM?: string | null;
	DEL?: string | null;
	PGOJ?: string | null;
	PGJB?: string | null;
	PGDES?: string | null;
	PGMAN1?: string | null;
	PGMAN2?: string | null;
	PGADD?: string | null;
};

/** 출력용 F14040 행(참여 실적 집계) */
type F14040PlanForPrint = F14040PlanLite;

/** V14030AB 일지 출력 행 */
type V14030ABPrintRow = {
	ANCD?: number | null;
	DSEQ?: number | null;
	SVDT?: string;
	weekday?: string;
	institutionName?: string;
	startTime?: string;
	endTime?: string;
	serviceGu?: string;
	programTitle?: string;
	serviceContent?: string;
	attendees?: string;
	facilitator?: string;
	assistant?: string;
	goal?: string;
	materials?: string;
	programContent?: string;
	comment?: string;
	place?: string;
	MIMG?: string;
	PG_GU?: string;
	programGu?: string;
};

/** V14030C 수급자 개별평가 */
type V14030CEvalRow = {
	DSEQ?: number | null;
	PNUM?: number | null;
	name?: string;
	joinLevel?: string;
	happLevel?: string;
	remark?: string;
};

function isDeletedPlan(del: string | null | undefined): boolean {
	return String(del ?? "").trim().toUpperCase() === "D";
}

function pgman0FromEvals(evals: AttendeeEval[]): string {
	return evals
		.map((e) => e.name)
		.filter(Boolean)
		.join(" ")
		.slice(0, 200);
}

function sexLabelFromMember(raw: unknown): string {
	const s = String(raw ?? "").trim();
	if (s === "1" || s === "M" || s === "남") return "남";
	if (s === "2" || s === "F" || s === "여") return "여";
	return s || "-";
}

function clipField(v: unknown, max: number): string {
	return String(v ?? "").trim().slice(0, max);
}

/** F14040 선택 시 일지 폼에 계획서 컬럼을 반영 (PG_GU, PGADD, PGMAN1, PGMAN2, PGOJ, PGJB, PGDES, PGNM) */
function applyPlanToForm(prev: Record<string, string>, plan: F14040PlanLite): Record<string, string> {
	const gu = String(plan.PG_GU ?? "")
		.trim()
		.replace(/^0+/, "")
		.charAt(0);
	const o = PG_GU_OPTIONS.find((x) => x.code === gu);
	return {
		...prev,
		PGSEQ: plan.PGSEQ != null ? String(plan.PGSEQ) : "",
		SVDIC: clipField(plan.PGNM, 200),
		PG_GU: o ? o.code : gu,
		PG_GU_NM: o ? o.label : prev.PG_GU_NM,
		PGADD: clipField(plan.PGADD, 50),
		PGMAN1: clipField(plan.PGMAN1, 20),
		PGMAN2: clipField(plan.PGMAN2, 20),
		PGOJ: clipField(plan.PGOJ, 500),
		PGJB: clipField(plan.PGJB, 200),
		PGDES: clipField(plan.PGDES, 1000),
		SVGU: prev.SVGU === "2" ? "2" : "1",
	};
}

type ParticipationSection = {
	participant: string;
	lines: { programLine: string; count: number }[];
	subtotal: number;
};

function escapeHtml(s: string): string {
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** 일지 첨부 사진 (F14030.MIMG JSON) */
type LogPhoto = { blobName: string; fileName?: string };

const MAX_LOG_PHOTOS = 4;

function serializeMimgPhotos(photos: LogPhoto[]): string {
	if (!photos.length) return "";
	// DB 컬럼이 짧을 수 있어 blobName만 콤팩트 저장
	return JSON.stringify(photos.slice(0, MAX_LOG_PHOTOS).map((p) => p.blobName));
}

function parseMimgPhotos(mimg: string | null | undefined): LogPhoto[] {
	const s = String(mimg ?? "").trim();
	if (!s) return [];
	try {
		const parsed = JSON.parse(s);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.map((p: unknown) => {
				if (typeof p === "string") {
					const blobName = p.trim();
					return blobName ? { blobName } : null;
				}
				if (p && typeof p === "object") {
					const blobName = String((p as { blobName?: unknown }).blobName ?? "").trim();
					const fileName = String((p as { fileName?: unknown }).fileName ?? "").trim() || undefined;
					return blobName ? { blobName, fileName } : null;
				}
				return null;
			})
			.filter((p): p is LogPhoto => Boolean(p?.blobName))
			.slice(0, MAX_LOG_PHOTOS);
	} catch {
		return [];
	}
}

function photoViewUrl(blobName: string, origin?: string): string {
	const path = `/api/program-daily-log/photos?blobName=${encodeURIComponent(blobName)}`;
	if (origin) return `${origin.replace(/\/$/, "")}${path}`;
	return path;
}

/** 참여 실적 표 — 프로그램 명 앞 분류 접두어 */
const PG_GU_SHORT_PRINT: Record<string, string> = {
	"1": "인지",
	"2": "신체",
	"3": "사회",
	"4": "가족",
	"6": "여가",
	"9": "기타",
};

function shortPgGuLabelForPrint(codeRaw: string): string {
	const code = String(codeRaw ?? "")
		.trim()
		.replace(/^0+/, "");
	return PG_GU_SHORT_PRINT[code] ?? (code || "기타");
}

/** PGMAN0(프로그램 참석자)에서 수급자 이름 목록 */
function extractParticipantNames(pgm0: string | null | undefined): string[] {
	const s = String(pgm0 ?? "").trim();
	if (!s) return [];
	const parts = s.split(/[\s,，、;/|]+/).map((x) => x.trim()).filter(Boolean);
	const seen = new Set<string>();
	const out: string[] = [];
	for (const p of parts) {
		if (seen.has(p)) continue;
		seen.add(p);
		out.push(p);
	}
	return out;
}

function buildPlanMetaFromF14040Json(
	plans: F14040PlanForPrint[],
): Map<number, { pgGu: string; pgnm: string }> {
	const m = new Map<number, { pgGu: string; pgnm: string }>();
	for (const r of plans) {
		const seq = r.PGSEQ;
		if (seq == null) continue;
		const n = typeof seq === "number" ? Math.trunc(seq) : parseInt(String(seq), 10);
		if (Number.isNaN(n)) continue;
		m.set(n, {
			pgGu: r.PG_GU != null ? String(r.PG_GU).trim() : "",
			pgnm: r.PGNM != null ? String(r.PGNM).trim() : "",
		});
	}
	return m;
}

function buildParticipationSections(
	rows: F14030Row[],
	planMeta: ReadonlyMap<number, { pgGu: string; pgnm: string }>,
): ParticipationSection[] {
	const outer = new Map<string, Map<string, { programLine: string; count: number }>>();

	for (const row of rows) {
		const names = extractParticipantNames(row.PGMAN0);
		if (names.length === 0) continue;
		const seq = parsePgseq(row.PGSEQ);
		const plan = seq != null ? planMeta.get(seq) : undefined;
		const titleFromPlan = plan?.pgnm?.trim() ?? "";
		const svdic = String(row.SVDIC ?? "").trim();
		const sub = String(row.SVDIC_SUB ?? "").trim();
		const title =
			titleFromPlan || (sub ? `${svdic} (${sub})` : svdic) || "(프로그램명 없음)";
		let guCode = "";
		if (plan?.pgGu && plan.pgGu.trim()) guCode = plan.pgGu.trim().replace(/^0+/, "");
		else guCode = String(row.PG_GU ?? "").trim().replace(/^0+/, "");
		const short = shortPgGuLabelForPrint(guCode);
		const programLine = `${short} - ${title}`;
		const aggKey = `${seq ?? "x"}|${title}`;

		for (const name of names) {
			if (!outer.has(name)) outer.set(name, new Map());
			const inner = outer.get(name)!;
			const cur = inner.get(aggKey);
			if (cur) cur.count += 1;
			else inner.set(aggKey, { programLine, count: 1 });
		}
	}

	const participants = Array.from(outer.keys()).sort((a, b) => a.localeCompare(b, "ko"));
	return participants.map((participant) => {
		const inner = outer.get(participant)!;
		const lines = Array.from(inner.values()).sort((a, b) =>
			a.programLine.localeCompare(b.programLine, "ko"),
		);
		const subtotal = lines.reduce((acc, x) => acc + x.count, 0);
		return { participant, lines, subtotal };
	});
}

function buildProgramParticipationPrintHtml(
	periodStart: string,
	periodEnd: string,
	sections: ParticipationSection[],
): string {
	const rowsHtml = sections
		.map((sec) => {
			const body = sec.lines
				.map((line, idx) => {
					const nameCell = idx === 0 ? escapeHtml(sec.participant) : "";
					return `<tr>
	<td class="td-name">${nameCell}</td>
	<td class="td-kind"></td>
	<td class="td-prog">${escapeHtml(line.programLine)}</td>
	<td class="td-num">${line.count}</td>
</tr>`;
				})
				.join("");
			const sub = `<tr class="tr-sub">
	<td class="td-name"></td>
	<td class="td-kind td-subtxt">소계</td>
	<td class="td-prog"></td>
	<td class="td-num">${sec.subtotal}</td>
</tr>`;
			return body + sub;
		})
		.join("");

	return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>프로그램 참여 실적</title>
<style>
@page { size: A4; margin: 14mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11pt; color: #000; background: #fff; }
.wrap { max-width: 190mm; margin: 0 auto; }
h1 { text-align: center; font-size: 18pt; font-weight: 700; text-decoration: underline; margin-bottom: 10px; }
.period { margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; border: 1px solid #000; table-layout: fixed; }
th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: middle; }
th { text-align: center; font-weight: 600; background: #f5f5f5; }
.td-name { width: 18%; }
.td-kind { width: 10%; text-align: center; }
.td-prog { width: 52%; word-break: break-word; }
.td-num { width: 12%; text-align: right; }
.tr-sub td { border-top: 2px solid #000; font-weight: 600; }
.td-subtxt { text-align: center; }
.footer { margin-top: 16px; text-align: right; font-size: 10pt; }
@media print {
	body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
<div class="wrap">
<h1>프로그램 참여 실적</h1>
<div class="period">기간: ${escapeHtml(periodStart)} ~ ${escapeHtml(periodEnd)}</div>
<table>
<thead><tr>
<th>수급자</th><th>구분</th><th>프로그램 명</th><th>참여횟수</th>
</tr></thead>
<tbody>
${rowsHtml}
</tbody>
</table>
<div class="footer">페이지: 1</div>
</div>
</body>
</html>`;
}

function svguLabelForPrint(codeRaw: string): string {
	const c = String(codeRaw ?? "").trim();
	const o = SVGU_OPTIONS.find((x) => x.code === c);
	return o ? o.label : c || "—";
}

async function fetchPhotoAsDataUrl(blobName: string): Promise<string | null> {
	try {
		const res = await fetch(photoViewUrl(blobName), { credentials: "include", cache: "no-store" });
		if (!res.ok) return null;
		const blob = await res.blob();
		return await new Promise<string | null>((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}

async function resolvePrintPhotoSrcs(mimg: string | null | undefined): Promise<{ src: string; fileName?: string }[]> {
	const photos = parseMimgPhotos(mimg);
	const out: { src: string; fileName?: string }[] = [];
	for (const p of photos) {
		const dataUrl = await fetchPhotoAsDataUrl(p.blobName);
		if (dataUrl) out.push({ src: dataUrl, fileName: p.fileName });
	}
	return out;
}

const WEEKDAY_EN_TO_KO: Record<string, string> = {
	sunday: "일",
	monday: "월",
	tuesday: "화",
	wednesday: "수",
	thursday: "목",
	friday: "금",
	saturday: "토",
};

function weekdayKoFromView(svdt: string, weekdayRaw: string): string {
	const raw = String(weekdayRaw ?? "").trim();
	const lower = raw.toLowerCase();
	if (WEEKDAY_EN_TO_KO[lower]) return WEEKDAY_EN_TO_KO[lower];
	if (/^[일월화수목금토]/.test(raw)) return raw.charAt(0);
	if (svdt) {
		const d = new Date(`${svdt}T00:00:00`);
		if (!Number.isNaN(d.getTime())) {
			return ["일", "월", "화", "수", "목", "금", "토"][d.getDay()] ?? "";
		}
	}
	return raw;
}

function formatViewDateTimeForLogPrint(row: V14030ABPrintRow): string {
	const d = String(row.SVDT ?? "").trim();
	const wd = weekdayKoFromView(d, String(row.weekday ?? ""));
	const a = String(row.startTime ?? "").trim();
	const b = String(row.endTime ?? "").trim();
	if (!d) return "—";
	const datePart = wd ? `${d} (${wd})` : d;
	if (a && b) return `${datePart} ${a} ~ ${b}`;
	if (a) return `${datePart} ${a}`;
	return datePart;
}

function f14030ToPrintRow(row: F14030Row, institutionName: string): V14030ABPrintRow {
	return {
		ANCD: row.ANCD ?? null,
		DSEQ: row.DSEQ ?? null,
		SVDT: formatYmd(row.SVDT),
		weekday: "",
		institutionName,
		startTime: timeFromRow(row.SVSTM),
		endTime: timeFromRow(row.SVETM),
		serviceGu: svguLabelForPrint(String(row.SVGU ?? "")),
		programTitle: String(row.SVDIC ?? "").trim(),
		serviceContent: String(row.SVDES ?? "").trim(),
		attendees: String(row.PGMAN0 ?? "").trim(),
		facilitator: String(row.PGMAN1 ?? "").trim(),
		assistant: String(row.PGMAN2 ?? "").trim(),
		goal: String(row.PGOJ ?? "").trim(),
		materials: String(row.PGJB ?? "").trim(),
		programContent: String(row.PGDES ?? "").trim(),
		comment: String(row.ETC ?? "").trim(),
		place: String(row.PGADD ?? "").trim(),
		MIMG: String(row.MIMG ?? ""),
		PG_GU: String(row.PG_GU ?? "").trim(),
		programGu: labelFromPgGuCode(String(row.PG_GU ?? "")),
	};
}

function buildIndivEvalTableHtml(evals: V14030CEvalRow[]): string {
	if (!evals.length) {
		return `<div class="eval-empty">등록된 개별평가가 없습니다.</div>`;
	}
	const body = evals
		.map((ev) => {
			return `<tr>
	<td class="eval-name">${escapeHtml(String(ev.name ?? "").trim() || " ")}</td>
	<td class="eval-lv">${escapeHtml(String(ev.joinLevel ?? "").trim() || " ")}</td>
	<td class="eval-lv">${escapeHtml(String(ev.happLevel ?? "").trim() || " ")}</td>
	<td class="eval-rm">${escapeHtml(String(ev.remark ?? "").trim() || " ")}</td>
</tr>`;
		})
		.join("");
	return `<table class="eval-table">
<thead><tr><th>수급자</th><th>참여도</th><th>만족도</th><th>특이사항</th></tr></thead>
<tbody>${body}</tbody>
</table>`;
}

function buildSingleProgramDailyLogSheetHtml(
	row: V14030ABPrintRow,
	evals: V14030CEvalRow[],
	institutionName: string,
	pageBreakAfter: boolean,
	printPhotos: { src: string; fileName?: string }[] = [],
): string {
	const pb = pageBreakAfter ? "page-break-after:always;break-after:page;" : "";
	const org = escapeHtml(String(row.institutionName ?? "").trim() || institutionName.trim() || "—");
	const progName = escapeHtml(String(row.programTitle ?? "").trim() || " ");
	const place = escapeHtml(String(row.place ?? "").trim() || " ");
	const dt = escapeHtml(formatViewDateTimeForLogPrint(row));
	const gu = escapeHtml(String(row.programGu ?? "").trim() || String(row.serviceGu ?? "").trim() || " ");
	const man1 = escapeHtml(String(row.facilitator ?? "").trim() || " ");
	const man2 = escapeHtml(String(row.assistant ?? "").trim() || " ");
	const attendees = escapeHtml(String(row.attendees ?? "").trim() || " ");
	const goal = escapeHtml(String(row.goal ?? "").trim() || " ");
	const materials = escapeHtml(String(row.materials ?? "").trim() || " ");
	const process = escapeHtml(String(row.programContent ?? "").trim() || " ");
	const evaluation = escapeHtml(String(row.serviceContent ?? "").trim() || " ");
	const evalTable = buildIndivEvalTableHtml(evals);

	const photoCells =
		printPhotos.length > 0
			? printPhotos
					.map((p) => {
						const src = escapeHtml(p.src);
						return `<div class="photo-item"><img src="${src}" alt="${escapeHtml(p.fileName || "첨부사진")}" /></div>`;
					})
					.join("")
			: `<div class="photo-empty">&nbsp;</div>`;

	return `<div class="log-sheet" style="${pb}">
<div class="log-top">
	<div class="log-title-block">
		<h1 class="log-title">프로그램일지</h1>
		<div class="log-org">기관명 : ${org}</div>
	</div>
	<table class="sign-table" aria-label="담당 검토 결재">
		<tr><th>담당</th><th>검토</th><th>결재</th></tr>
		<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
		<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
	</table>
</div>
<table class="log-main">
	<colgroup>
		<col style="width:14%"/>
		<col style="width:38%"/>
		<col style="width:14%"/>
		<col style="width:34%"/>
	</colgroup>
	<tbody>
	<tr class="row-fixed">
		<td class="cell-label">프로그램명</td>
		<td class="cell-val">${progName}</td>
		<td class="cell-label">장소</td>
		<td class="cell-val">${place}</td>
	</tr>
	<tr class="row-fixed">
		<td class="cell-label">일시</td>
		<td class="cell-val">${dt}</td>
		<td class="cell-label">구분</td>
		<td class="cell-val">${gu}</td>
	</tr>
	<tr class="row-fixed">
		<td class="cell-label">진행자</td>
		<td class="cell-val">${man1}</td>
		<td class="cell-label">보조진행자</td>
		<td class="cell-val">${man2}</td>
	</tr>
	<tr class="row-attend">
		<td class="cell-label">참석자</td>
		<td class="cell-val cell-pre" colspan="3">${attendees}</td>
	</tr>
	<tr class="row-goal">
		<td class="cell-label">프로그램 목표</td>
		<td class="cell-val cell-pre" colspan="3">${goal}</td>
	</tr>
	<tr class="row-mat">
		<td class="cell-label">준비물</td>
		<td class="cell-val cell-pre" colspan="3">${materials}</td>
	</tr>
	<tr class="row-process">
		<td class="cell-label">프로그램 운영<br/>과정 및 내용</td>
		<td class="cell-val cell-pre" colspan="3">${process}</td>
	</tr>
	<tr class="row-eval">
		<td class="cell-label">평가</td>
		<td class="cell-val cell-pre" colspan="3">${evaluation}</td>
	</tr>
	<tr class="row-indiv">
		<td class="cell-label">수급자<br/>개별평가</td>
		<td class="cell-val cell-indiv" colspan="3">${evalTable}</td>
	</tr>
	<tr class="row-photo">
		<td class="cell-label">사진</td>
		<td class="cell-val cell-photo" colspan="3"><div class="photo-grid">${photoCells}</div></td>
	</tr>
	</tbody>
</table>
</div>`;
}

function wrapProgramDailyLogPrintDocument(sheetsInnerHtml: string): string {
	return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>프로그램일지</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; }
body { font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 10.5pt; color: #000; background: #fff; }
.log-sheet {
	width: 190mm;
	min-height: 277mm;
	margin: 0 auto;
	display: flex;
	flex-direction: column;
}
.log-top {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: flex-start;
	gap: 8px;
	margin-bottom: 4px;
	flex: 0 0 auto;
}
.log-title-block { flex: 1; min-width: 0; }
.log-title { text-align: center; font-size: 18pt; font-weight: 700; text-decoration: underline; margin: 0 0 6px 0; line-height: 1.2; }
.log-org { text-align: left; font-size: 11pt; padding-left: 2mm; }
.sign-table { border-collapse: collapse; border: 1px solid #000; font-size: 9pt; flex-shrink: 0; }
.sign-table th, .sign-table td { border: 1px solid #000; width: 64px; min-width: 56px; text-align: center; vertical-align: middle; padding: 3px 2px; }
.sign-table th { font-weight: 700; background: #f7f7f7; height: 22px; }
.sign-table td { height: 28px; }
.log-main {
	width: 100%;
	flex: 1 1 auto;
	height: 100%;
	border-collapse: collapse;
	border: 2px solid #000;
	table-layout: fixed;
}
.log-main td { border: 1px solid #000; padding: 5px 7px; vertical-align: middle; font-size: 10.5pt; }
.cell-label { text-align: center; font-weight: 600; background: #fafafa; vertical-align: middle; }
.cell-val { text-align: left; word-break: break-word; }
.cell-pre { white-space: pre-wrap; vertical-align: top; }
.row-fixed { height: 7mm; }
.row-attend { height: 12mm; }
.row-goal { height: 14mm; }
.row-mat { height: 10mm; }
.row-process { height: 42mm; }
.row-eval { height: 22mm; }
.row-indiv td { vertical-align: top; }
.cell-indiv { padding: 4px 6px; }
.eval-table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
.eval-table th, .eval-table td { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; }
.eval-table th { text-align: center; font-weight: 600; background: #f5f5f5; }
.eval-name { width: 18%; }
.eval-lv { width: 12%; text-align: center; }
.eval-rm { width: 58%; word-break: break-word; }
.eval-empty { font-size: 9.5pt; color: #444; padding: 4px 0; }
.row-photo { height: auto; }
.row-photo td { height: 72mm; vertical-align: top; }
.cell-photo { padding: 4px; }
.photo-grid {
	display: flex;
	flex-wrap: wrap;
	align-content: flex-start;
	gap: 4px;
	width: 100%;
	height: 100%;
	min-height: 68mm;
}
.photo-item {
	flex: 1 1 calc(50% - 4px);
	max-width: calc(50% - 4px);
	height: calc(50% - 2px);
	min-height: 32mm;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px solid #ccc;
	overflow: hidden;
	background: #fff;
}
.photo-item img {
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
}
.photo-empty { width: 100%; height: 100%; min-height: 68mm; }
@media print {
	body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
	.log-sheet { min-height: 277mm; }
}
</style>
</head>
<body>
${sheetsInnerHtml}
</body>
</html>`;
}

function openProgramDailyLogPrintWindow(html: string, waitForImages = true): void {
	const printWindow = window.open("", "_blank");
	if (!printWindow) {
		alert("팝업이 차단되었습니다. 팝업 차단을 해제해 주세요.");
		return;
	}
	printWindow.document.open();
	printWindow.document.write(html);
	printWindow.document.close();

	const doPrint = () => {
		try {
			printWindow.focus();
			printWindow.print();
		} catch (_) {
			/* ignore */
		}
	};

	if (!waitForImages) {
		setTimeout(doPrint, 250);
		return;
	}

	const imgs = Array.from(printWindow.document.images || []);
	if (imgs.length === 0) {
		setTimeout(doPrint, 250);
		return;
	}
	let done = 0;
	const mark = () => {
		done += 1;
		if (done >= imgs.length) setTimeout(doPrint, 100);
	};
	imgs.forEach((img) => {
		if (img.complete) mark();
		else {
			img.addEventListener("load", mark);
			img.addEventListener("error", mark);
		}
	});
	setTimeout(doPrint, 4000);
}

export default function ProgramDailyLog() {
	const initialRange = useMemo(() => monthRangeYmd(new Date()), []);

	const [workPeriodStart, setWorkPeriodStart] = useState(initialRange.start);
	const [workPeriodEnd, setWorkPeriodEnd] = useState(initialRange.end);
	const [rows, setRows] = useState<F14030Row[]>([]);
	const [loading, setLoading] = useState(false);
	const [listError, setListError] = useState<string | null>(null);

	const [selectedSvdDate, setSelectedSvdDate] = useState<string | null>(null);
	const [editingDseq, setEditingDseq] = useState<number | null>(null);
	/** 「추가」로 신규 입력 중이면 상단 행 미선택이어도 하단 폼 잠금 해제 */
	const [isAddingNewProgram, setIsAddingNewProgram] = useState(false);
	/** 기존 일지 선택 후 「수정」을 누른 경우에만 필드 편집 허용 */
	const [formFieldsUnlocked, setFormFieldsUnlocked] = useState(false);
	const [datePage, setDatePage] = useState(1);
	const [formData, setFormData] = useState<Record<string, string>>(() => emptyForm(initialRange.start));
	const [saveLoading, setSaveLoading] = useState(false);
	const [photoUploading, setPhotoUploading] = useState(false);
	const photoInputRef = useRef<HTMLInputElement | null>(null);
	const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
	/** 「검색」으로 조회를 한 번이라도 성공한 뒤(빈 목록 포함) — 안내 문구 구분용 */
	const [hasSearched, setHasSearched] = useState(false);
	/** 기간설정 출력 모달 — 일지 / 참여실적 */
	const [periodPrintKind, setPeriodPrintKind] = useState<"log" | "participation" | null>(null);
	const [periodLogStart, setPeriodLogStart] = useState(initialRange.start);
	const [periodLogEnd, setPeriodLogEnd] = useState(initialRange.end);

	/** F14040 치료프로그램(일지 PGSEQ → 계획서 필드 자동반영) */
	const [f14040Plans, setF14040Plans] = useState<F14040PlanLite[]>([]);
	const [f14040LoadError, setF14040LoadError] = useState<string | null>(null);
	const [attendeeEvals, setAttendeeEvals] = useState<AttendeeEval[]>([]);
	const [attendeeModalOpen, setAttendeeModalOpen] = useState(false);
	const [svdesSamples, setSvdesSamples] = useState<string[]>([]);
	/** 신규생성 중 다른 일지·일자로 이동하기 전 확인 */
	const [pendingLeaveNav, setPendingLeaveNav] = useState<
		{ type: "date"; date: string } | { type: "program"; program: F14030Row } | null
	>(null);

	/** 목록 조회 세대 — 기간 변경·새 조회 시작 시 이전 비동기 결과 무시 */
	const listFetchEpoch = useRef(0);

	const uniqueDates = useMemo(() => {
		const set = new Set<string>();
		for (const r of rows) {
			const d = formatYmd(r.SVDT);
			if (d) set.add(d);
		}
		return Array.from(set).sort((a, b) => b.localeCompare(a));
	}, [rows]);

	const dateTotalPages = Math.max(1, Math.ceil(uniqueDates.length / DATE_PAGE_SIZE));
	const pagedDates = useMemo(() => {
		const start = (datePage - 1) * DATE_PAGE_SIZE;
		return uniqueDates.slice(start, start + DATE_PAGE_SIZE);
	}, [uniqueDates, datePage]);

	/** 페이지 번호 버튼에 표시할 구간(최대 5개), 현재 페이지가 가능한 한 가운데 오도록 */
	const datePageNumberWindow = useMemo(() => {
		const n = dateTotalPages;
		if (n <= 1) return [];
		const size = Math.min(DATE_PAGE_NUMBER_WINDOW, n);
		const startMax = Math.max(1, n - DATE_PAGE_NUMBER_WINDOW + 1);
		const start = Math.min(Math.max(1, datePage - 2), startMax);
		return Array.from({ length: size }, (_, i) => start + i);
	}, [datePage, dateTotalPages]);

	const programsForDate = useMemo(() => {
		if (!selectedSvdDate) return [];
		return rows
			.filter((r) => formatYmd(r.SVDT) === selectedSvdDate)
			.sort((a, b) => {
				const ta = String(a.SVSTM ?? "");
				const tb = String(b.SVSTM ?? "");
				if (ta !== tb) return ta.localeCompare(tb);
				return (a.DSEQ ?? 0) - (b.DSEQ ?? 0);
			});
	}, [rows, selectedSvdDate]);

	const pgseqToPlanMeta = useMemo(() => {
		const m = new Map<number, { pgGu: string; pgnm: string }>();
		for (const r of f14040Plans) {
			const seq = r.PGSEQ;
			if (seq == null) continue;
			const n = typeof seq === "number" ? Math.trunc(seq) : parseInt(String(seq), 10);
			if (Number.isNaN(n)) continue;
			m.set(n, {
				pgGu: r.PG_GU != null ? String(r.PG_GU).trim() : "",
				pgnm: r.PGNM != null ? String(r.PGNM).trim() : "",
			});
		}
		return m;
	}, [f14040Plans]);

	const pgseqToPgGuMap = useMemo(() => {
		const m = new Map<number, string>();
		pgseqToPlanMeta.forEach((v, k) => {
			if (v.pgGu) m.set(k, v.pgGu);
		});
		return m;
	}, [pgseqToPlanMeta]);

	const pgseqToPlan = useMemo(() => {
		const m = new Map<number, F14040PlanLite>();
		for (const r of f14040Plans) {
			const seq = parsePgseq(r.PGSEQ);
			if (seq == null) continue;
			m.set(seq, r);
		}
		return m;
	}, [f14040Plans]);

	const selectablePlans = useMemo(() => {
		const currentSeq = parsePgseq(formData.PGSEQ);
		return f14040Plans
			.filter((p) => {
				const seq = parsePgseq(p.PGSEQ);
				if (seq == null) return false;
				if (currentSeq != null && seq === currentSeq) return true;
				return !isDeletedPlan(p.DEL);
			})
			.slice()
			.sort((a, b) => String(a.PGNM ?? "").localeCompare(String(b.PGNM ?? ""), "ko"));
	}, [f14040Plans, formData.PGSEQ]);

	const [programListPage, setProgramListPage] = useState(1);
	const programTotalPages = Math.max(1, Math.ceil(programsForDate.length / PROGRAM_LIST_PAGE_SIZE));
	const pagedProgramsForDate = useMemo(() => {
		const start = (programListPage - 1) * PROGRAM_LIST_PAGE_SIZE;
		return programsForDate.slice(start, start + PROGRAM_LIST_PAGE_SIZE);
	}, [programsForDate, programListPage]);

	const fetchDataRows = useCallback(async (): Promise<F14030Row[]> => {
		const url = `/api/f14030?startDate=${encodeURIComponent(workPeriodStart)}&endDate=${encodeURIComponent(workPeriodEnd)}`;
		const res = await fetch(url, { cache: "no-store" });
		const json = await res.json();
		if (!res.ok || !json.success) {
			throw new Error(json.error || "조회에 실패했습니다.");
		}
		return Array.isArray(json.data) ? json.data : [];
	}, [workPeriodStart, workPeriodEnd]);

	const reloadFull = useCallback(async () => {
		const run = ++listFetchEpoch.current;
		setLoading(true);
		setListError(null);
		try {
			const data = await fetchDataRows();
			if (run !== listFetchEpoch.current) return;
			setRows(data);
			setHasSearched(true);
			setSelectedSvdDate(null);
			setEditingDseq(null);
			setIsAddingNewProgram(false);
			setFormFieldsUnlocked(false);
			setProgramListPage(1);
			setDatePage(1);
			setFormData(emptyForm(workPeriodStart));
			setAttendeeEvals([]);
			setAttendeeModalOpen(false);
		} catch (e) {
			if (run !== listFetchEpoch.current) return;
			setRows([]);
			setHasSearched(false);
			setListError(e instanceof Error ? e.message : "조회 오류");
		} finally {
			if (run === listFetchEpoch.current) setLoading(false);
		}
	}, [fetchDataRows, workPeriodStart]);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch("/api/auth/user-info");
				const json = await res.json();
				if (json?.success && json?.data) setUserInfo(json.data as UserInfo);
			} catch {
				/* ignore */
			}
		})();
	}, []);

	const applyAttendeeEvals = useCallback((next: AttendeeEval[]) => {
		setAttendeeEvals(next);
		setFormData((p) => ({ ...p, PGMAN0: pgman0FromEvals(next) }));
	}, []);

	const loadAttendeeEvals = useCallback(async (dseq: number) => {
		try {
			const [j31, j10] = await Promise.all([
				fetch(`/api/f14031?dseq=${encodeURIComponent(String(dseq))}`, { cache: "no-store" }).then((r) =>
					r.json(),
				),
				fetch("/api/f10010", { cache: "no-store" }).then((r) => r.json()),
			]);
			if (!j31?.success || !Array.isArray(j31.data)) {
				setAttendeeEvals([]);
				return;
			}
			const members = new Map<number, Record<string, unknown>>();
			if (j10?.success && Array.isArray(j10.data)) {
				for (const r of j10.data as Record<string, unknown>[]) {
					const pnum = parseInt(String(r.PNUM ?? ""), 10);
					if (Number.isFinite(pnum)) members.set(pnum, r);
				}
			}
			const next: AttendeeEval[] = j31.data
				.map((r: { PNUM?: number; P_GRD?: string; JOIN_FLAG?: string; PLAY_FLAG?: string; HAPP_FLAG?: string; RESP_DESC?: string }) => {
					const pnum = Number(r.PNUM);
					if (!Number.isFinite(pnum)) return null;
					const m = members.get(pnum);
					const pGrd = normalizePGrdForSelect(r.P_GRD || m?.P_GRD);
					return {
						PNUM: pnum,
						name: String(m?.P_NM ?? "").trim() || `수급자 ${pnum}`,
						sex: sexLabelFromMember(m?.P_SEX),
						birthday: formatYmd(m?.P_BRDT),
						gradeLabel: formatCareGradeLabel(r.P_GRD || m?.P_GRD),
						P_GRD: pGrd,
						JOIN_FLAG: String(r.JOIN_FLAG ?? "").trim(),
						PLAY_FLAG: String(r.PLAY_FLAG ?? "").trim(),
						HAPP_FLAG: String(r.HAPP_FLAG ?? "").trim(),
						RESP_DESC: String(r.RESP_DESC ?? "").trim(),
					};
				})
				.filter((x: AttendeeEval | null): x is AttendeeEval => Boolean(x))
				.sort((a: AttendeeEval, b: AttendeeEval) => a.name.localeCompare(b.name, "ko"));
			setAttendeeEvals(next);
			setFormData((p) => ({ ...p, PGMAN0: pgman0FromEvals(next) || p.PGMAN0 }));
		} catch {
			setAttendeeEvals([]);
		}
	}, []);

	const persistPendingAttendeeEvals = useCallback(async (dseq: number, rows: AttendeeEval[]) => {
		for (const row of rows) {
			const res = await fetch("/api/f14031", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					action: "save",
					DSEQ: dseq,
					PNUM: row.PNUM,
					P_GRD: row.P_GRD,
					JOIN_FLAG: row.JOIN_FLAG,
					PLAY_FLAG: row.PLAY_FLAG,
					HAPP_FLAG: row.HAPP_FLAG,
					RESP_DESC: row.RESP_DESC,
				}),
			});
			const json = await res.json();
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || `${row.name} 개별평가 저장에 실패했습니다.`);
			}
		}
	}, []);

	const fetchF14040Plans = useCallback(async () => {
		try {
			const res = await fetch("/api/f14040", { cache: "no-store", credentials: "include" });
			const json = await res.json();
			if (!res.ok || !json?.success || !Array.isArray(json.data)) {
				throw new Error(json?.error || "프로그램계획서 목록을 불러오지 못했습니다.");
			}
			setF14040Plans(json.data as F14040PlanLite[]);
			setF14040LoadError(null);
		} catch (e) {
			setF14040Plans([]);
			setF14040LoadError(e instanceof Error ? e.message : "프로그램계획서 목록을 불러오지 못했습니다.");
		}
	}, []);

	useEffect(() => {
		void fetchF14040Plans();
	}, [fetchF14040Plans]);

	useEffect(() => {
		const seq = parsePgseq(formData.PGSEQ);
		if (seq == null) {
			setSvdesSamples([]);
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`/api/f14039?pgseq=${encodeURIComponent(String(seq))}&smp_flag=1`, {
					cache: "no-store",
				});
				const json = await res.json();
				if (cancelled) return;
				if (!json?.success || !Array.isArray(json.data)) {
					setSvdesSamples([]);
					return;
				}
				setSvdesSamples(
					json.data
						.map((r: { SMP_DSC?: string }) => String(r.SMP_DSC ?? "").trim())
						.filter(Boolean),
				);
			} catch {
				if (!cancelled) setSvdesSamples([]);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [formData.PGSEQ]);

	useEffect(() => {
		setDatePage((p) => Math.min(p, dateTotalPages));
	}, [dateTotalPages]);

	useEffect(() => {
		setProgramListPage((p) => Math.min(p, programTotalPages));
	}, [programTotalPages]);

	useEffect(() => {
		setProgramListPage(1);
	}, [selectedSvdDate]);

	useEffect(() => {
		if (!workPeriodStart || !workPeriodEnd) return;
		if (workPeriodStart > workPeriodEnd) return;
		void reloadFull();
	}, [workPeriodStart, workPeriodEnd, reloadFull]);

	const handleSearch = () => {
		void reloadFull();
	};

	const applySelectProgram = (program: F14030Row) => {
		if (program.DSEQ == null) return;
		setIsAddingNewProgram(false);
		setFormFieldsUnlocked(false);
		setEditingDseq(program.DSEQ);
		let fd = mergePlanPgGuFromF14040(rowToForm(program), pgseqToPgGuMap);
		if (!fd.PGSEQ && fd.SVDIC.trim()) {
			const hits = f14040Plans.filter(
				(p) => !isDeletedPlan(p.DEL) && String(p.PGNM ?? "").trim() === fd.SVDIC.trim(),
			);
			if (hits.length === 1 && hits[0].PGSEQ != null) {
				fd = { ...fd, PGSEQ: String(hits[0].PGSEQ) };
			}
		}
		setFormData(fd);
		void loadAttendeeEvals(program.DSEQ);
	};

	const applySelectDate = (svdDate: string) => {
		setSelectedSvdDate(svdDate);
		const firstProgram = rows
			.filter((r) => formatYmd(r.SVDT) === svdDate)
			.sort((a, b) => {
				const ta = String(a.SVSTM ?? "");
				const tb = String(b.SVSTM ?? "");
				if (ta !== tb) return ta.localeCompare(tb);
				return (a.DSEQ ?? 0) - (b.DSEQ ?? 0);
			})[0];
		if (firstProgram) {
			applySelectProgram(firstProgram);
			return;
		}
		setEditingDseq(null);
		setIsAddingNewProgram(false);
		setFormFieldsUnlocked(false);
		setFormData(emptyForm(svdDate));
		setAttendeeEvals([]);
	};

	const handleSelectProgram = (program: F14030Row) => {
		if (isAddingNewProgram) {
			setPendingLeaveNav({ type: "program", program });
			return;
		}
		applySelectProgram(program);
	};

	const handleSelectDate = (svdDate: string) => {
		if (isAddingNewProgram) {
			setPendingLeaveNav({ type: "date", date: svdDate });
			return;
		}
		applySelectDate(svdDate);
	};

	const confirmLeaveNewProgram = () => {
		if (!pendingLeaveNav) return;
		const nav = pendingLeaveNav;
		setPendingLeaveNav(null);
		if (nav.type === "date") applySelectDate(nav.date);
		else applySelectProgram(nav.program);
	};

	const handleNew = () => {
		const editingNow = isAddingNewProgram || (editingDseq != null && formFieldsUnlocked);
		if (editingNow && !confirm("작성 중인 내용이 저장되지 않습니다. 신규로 전환할까요?")) {
			return;
		}
		const today = formatYmd(new Date());
		const defaultDate =
			selectedSvdDate ||
			(workPeriodStart && workPeriodEnd && today >= workPeriodStart && today <= workPeriodEnd
				? today
				: workPeriodStart) ||
			today;
		setSelectedSvdDate(defaultDate);
		setIsAddingNewProgram(true);
		setFormFieldsUnlocked(true);
		setEditingDseq(null);
		setFormData(emptyForm(defaultDate));
		setAttendeeEvals([]);
		void fetchF14040Plans();
	};

	/** 수정·신규 입력 모드 종료 — 저장 없이 읽기 전용으로 복귀 */
	const handleCancelEdit = () => {
		if (isAddingNewProgram) {
			setIsAddingNewProgram(false);
			setFormFieldsUnlocked(false);
			setEditingDseq(null);
			if (selectedSvdDate) setFormData(emptyForm(selectedSvdDate));
			else setFormData(emptyForm(workPeriodStart));
			setAttendeeEvals([]);
			return;
		}
		if (editingDseq != null && selectedSvdDate) {
			const row = rows.find(
				(r) => r.DSEQ === editingDseq && formatYmd(r.SVDT) === selectedSvdDate,
			);
			if (row) setFormData(mergePlanPgGuFromF14040(rowToForm(row), pgseqToPgGuMap));
			setFormFieldsUnlocked(false);
			return;
		}
		setFormFieldsUnlocked(false);
	};

	const buildSaveBody = (action: "create" | "save") => {
		let INEMPNO: number | null = null;
		const eno = userInfo?.empno;
		if (eno !== undefined && eno !== null && String(eno).trim() !== "") {
			const n = parseInt(String(eno), 10);
			INEMPNO = Number.isNaN(n) ? null : n;
		}
		const INEMPNM = (userInfo?.empnm && String(userInfo.empnm).trim()) || null;

		const body: Record<string, unknown> = {
			action,
			SVDT: formData.SVDT?.trim(),
			SVSTM: formData.SVSTM?.trim() ?? "",
			SVETM: formData.SVETM?.trim() ?? "",
			SVGU: formData.SVGU?.trim() ?? "",
			SVDIC: formData.SVDIC ?? "",
			SVDES: formData.SVDES ?? "",
			PGMAN0: formData.PGMAN0 ?? "",
			PGADD: formData.PGADD ?? "",
			PGMAN1: formData.PGMAN1 ?? "",
			PGMAN2: formData.PGMAN2 ?? "",
			PGOJ: formData.PGOJ ?? "",
			PGJB: formData.PGJB ?? "",
			PGDES: formData.PGDES ?? "",
			INDT: formData.INDT?.trim() || null,
			ETC: formData.ETC ?? "",
			INEMPNO,
			INEMPNM,
			PGSEQ: formData.PGSEQ?.trim() ? parseInt(formData.PGSEQ, 10) : null,
			MIMG: formData.MIMG?.trim() || null,
			PG_GU: formData.PG_GU?.trim() || null,
			PG_GU_NM: formData.PG_GU_NM?.trim() || null,
			SVDIC_SUB: formData.SVDIC_SUB?.trim() || null,
		};
		if (action === "save" && editingDseq != null) {
			body.dseq = editingDseq;
		}
		return body;
	};

	const handleSave = async () => {
		const areaLocked =
			!selectedSvdDate ||
			(programsForDate.length > 0 && editingDseq == null && !isAddingNewProgram);
		const mayEdit =
			!areaLocked && (isAddingNewProgram || (editingDseq != null && formFieldsUnlocked));
		if (!mayEdit) {
			alert("「수정」으로 편집을 시작하거나 「추가」로 신규 작성을 시작한 뒤 저장할 수 있습니다.");
			return;
		}
		if (!formData.SVDT?.trim()) {
			alert("서비스일자를 입력해 주세요.");
			return;
		}
		if (!formData.PGSEQ?.trim() || !formData.SVDIC?.trim()) {
			alert("프로그램명을 선택해 주세요.");
			return;
		}

		const action = editingDseq != null ? "save" : "create";
		setSaveLoading(true);
		try {
			const res = await fetch("/api/f14030", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(buildSaveBody(action)),
			});
			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.error || "저장에 실패했습니다.");
			}
			const newDseq = json.dseq as number | undefined;
			const pickDseqAfter = action === "create" ? (newDseq != null ? Number(newDseq) : null) : editingDseq;
			if (action === "create" && pickDseqAfter != null && attendeeEvals.length > 0) {
				await persistPendingAttendeeEvals(pickDseqAfter, attendeeEvals);
			}
			alert(action === "create" ? "등록되었습니다." : "수정되었습니다.");
			const data = await fetchDataRows();
			setRows(data);
			const svd = formData.SVDT.trim();
			setSelectedSvdDate(svd);
			const pickDseq = action === "create" ? (newDseq != null ? Number(newDseq) : null) : editingDseq;
			if (pickDseq != null) {
				const row = data.find((r) => r.DSEQ === pickDseq && formatYmd(r.SVDT) === svd);
				if (row) {
					setIsAddingNewProgram(false);
					setFormFieldsUnlocked(false);
					setEditingDseq(pickDseq);
					setFormData(mergePlanPgGuFromF14040(rowToForm(row), pgseqToPgGuMap));
					void loadAttendeeEvals(pickDseq);
					const sorted = data
						.filter((r) => formatYmd(r.SVDT) === svd)
						.sort((a, b) => {
							const ta = String(a.SVSTM ?? "");
							const tb = String(b.SVSTM ?? "");
							if (ta !== tb) return ta.localeCompare(tb);
							return (a.DSEQ ?? 0) - (b.DSEQ ?? 0);
						});
					const idx = sorted.findIndex((r) => r.DSEQ === pickDseq);
					if (idx >= 0) {
						setProgramListPage(Math.floor(idx / PROGRAM_LIST_PAGE_SIZE) + 1);
					}
				}
			} else {
				setIsAddingNewProgram(false);
				setFormFieldsUnlocked(false);
				setEditingDseq(null);
				setFormData(emptyForm(svd));
			}
		} catch (e) {
			alert(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
		} finally {
			setSaveLoading(false);
		}
	};

	const handleDelete = async () => {
		if (editingDseq == null) {
			alert("삭제할 행을 목록에서 선택해 주세요.");
			return;
		}
		if (!confirm("정말 삭제하시겠습니까?")) return;
		setSaveLoading(true);
		try {
			const res = await fetch("/api/f14030", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "delete", dseq: editingDseq }),
			});
			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.error || "삭제에 실패했습니다.");
			}
			alert("삭제되었습니다.");
			const keepDate = selectedSvdDate;
			const data = await fetchDataRows();
			setRows(data);
			if (keepDate && data.some((r) => formatYmd(r.SVDT) === keepDate)) {
				setSelectedSvdDate(keepDate);
				setFormData(emptyForm(keepDate));
			} else {
				setSelectedSvdDate(null);
				setFormData(emptyForm(workPeriodStart));
			}
			setEditingDseq(null);
			setIsAddingNewProgram(false);
			setFormFieldsUnlocked(false);
			setAttendeeEvals([]);
		} catch (e) {
			alert(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
		} finally {
			setSaveLoading(false);
		}
	};

	const handleCopyDate = () => {
		if (editingDseq == null || !selectedSvdDate) {
			alert("복사할 일지를 목록에서 선택해 주세요.");
			return;
		}
		const editingNow = isAddingNewProgram || (editingDseq != null && formFieldsUnlocked);
		if (editingNow && !confirm("작성 중인 내용이 저장되지 않습니다. 해당 일지를 복사할까요?")) {
			return;
		}
		const today = formatYmd(new Date());
		setSelectedSvdDate(today);
		setIsAddingNewProgram(true);
		setFormFieldsUnlocked(true);
		setEditingDseq(null);
		setFormData({
			...formData,
			SVDT: today,
			SVSTM: "",
			SVETM: "",
			INDT: today,
		});
		setAttendeeEvals((prev) => prev.map((ev) => ({ ...ev })));
		void fetchF14040Plans();
	};
	const handleCopyByCase = () => {
		alert("기능 개발 중입니다.");
	};
	const handleCopyToCenter = () => {
		alert("기능 개발 중입니다.");
	};

	const institutionNameForPrint = useMemo(
		() => String(userInfo?.annm ?? "").trim() || "—",
		[userInfo],
	);

	const handleOpenPeriodPrintModal = (kind: "log" | "participation") => {
		setPeriodLogStart(workPeriodStart);
		setPeriodLogEnd(workPeriodEnd);
		setPeriodPrintKind(kind);
	};

	const handlePrintSingleProgramLog = async () => {
		if (editingDseq == null || !selectedSvdDate) {
			alert("출력할 일지를 목록에서 선택해 주세요.");
			return;
		}
		if (isAddingNewProgram) {
			alert("신규 작성 중인 일지는 저장한 뒤 출력해 주세요.");
			return;
		}
		const row = rows.find((r) => r.DSEQ === editingDseq && formatYmd(r.SVDT) === selectedSvdDate);
		if (!row) {
			alert("선택한 일지 데이터를 찾을 수 없습니다.");
			return;
		}
		try {
			const res = await fetch(`/api/v14030ab?dseq=${encodeURIComponent(String(editingDseq))}&includeEvals=1`, {
				cache: "no-store",
			});
			const json = await res.json();
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "출력 데이터를 불러오지 못했습니다.");
			}
			const viewRows: V14030ABPrintRow[] = Array.isArray(json.data) ? json.data : [];
			const evals: V14030CEvalRow[] = Array.isArray(json.evals) ? json.evals : [];
			const viewRow = viewRows[0] ?? f14030ToPrintRow(row, institutionNameForPrint);
			const printPhotos = await resolvePrintPhotoSrcs(formData.MIMG || row.MIMG || viewRow.MIMG);
			const sheet = buildSingleProgramDailyLogSheetHtml(
				viewRow,
				evals,
				institutionNameForPrint,
				false,
				printPhotos,
			);
			openProgramDailyLogPrintWindow(wrapProgramDailyLogPrintDocument(sheet));
		} catch (e) {
			alert(e instanceof Error ? e.message : "출력 중 오류가 발생했습니다.");
		}
	};

	const handlePrintProgramLogsInPeriod = async () => {
		const start = periodLogStart.trim();
		const end = periodLogEnd.trim();
		if (!start || !end) {
			alert("시작일·종료일을 입력해 주세요.");
			return;
		}
		if (start > end) {
			alert("시작일이 종료일보다 늦을 수 없습니다.");
			return;
		}
		try {
			const [jView, j30] = await Promise.all([
				fetch(
					`/api/v14030ab?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&includeEvals=1`,
					{ cache: "no-store" },
				).then((r) => r.json()),
				fetch(
					`/api/f14030?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
					{ cache: "no-store" },
				).then((r) => r.json()),
			]);
			if (!jView?.success) {
				alert(String(jView?.error || "일지 출력 데이터를 불러오지 못했습니다."));
				return;
			}
			const viewRows: V14030ABPrintRow[] = Array.isArray(jView.data) ? jView.data : [];
			const evals: V14030CEvalRow[] = Array.isArray(jView.evals) ? jView.evals : [];
			const fallbackRows: F14030Row[] = j30?.success && Array.isArray(j30.data) ? j30.data : [];
			const mimgByDseq = new Map<number, string>();
			for (const r of fallbackRows) {
				if (r.DSEQ != null && r.MIMG) mimgByDseq.set(r.DSEQ, String(r.MIMG));
			}
			const evalsByDseq = new Map<number, V14030CEvalRow[]>();
			for (const ev of evals) {
				const dseq = ev.DSEQ;
				if (dseq == null) continue;
				const list = evalsByDseq.get(dseq) ?? [];
				list.push(ev);
				evalsByDseq.set(dseq, list);
			}
			if (viewRows.length === 0) {
				alert("해당 기간에 출력할 일지가 없습니다.");
				return;
			}
			const sheets = [];
			for (let i = 0; i < viewRows.length; i++) {
				const viewRow = viewRows[i];
				const dseq = viewRow.DSEQ ?? null;
				const mimg = (dseq != null ? mimgByDseq.get(dseq) : "") || viewRow.MIMG;
				const printPhotos = await resolvePrintPhotoSrcs(mimg);
				sheets.push(
					buildSingleProgramDailyLogSheetHtml(
						viewRow,
						dseq != null ? evalsByDseq.get(dseq) ?? [] : [],
						institutionNameForPrint,
						i < viewRows.length - 1,
						printPhotos,
					),
				);
			}
			openProgramDailyLogPrintWindow(wrapProgramDailyLogPrintDocument(sheets.join("")));
			setPeriodPrintKind(null);
		} catch (e) {
			alert(e instanceof Error ? e.message : "출력 중 오류가 발생했습니다.");
		}
	};

	const handlePrintProgramParticipation = async () => {
		const start = periodLogStart.trim();
		const end = periodLogEnd.trim();
		if (!start || !end) {
			alert("시작일·종료일을 입력해 주세요.");
			return;
		}
		if (start > end) {
			alert("시작일이 종료일보다 늦을 수 없습니다.");
			return;
		}
		try {
			const [j30, j40] = await Promise.all([
				fetch(
					`/api/f14030?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`,
					{ cache: "no-store" },
				).then((r) => r.json()),
				fetch("/api/f14040", { cache: "no-store" }).then((r) => r.json()),
			]);
			if (!j30?.success) {
				alert(String(j30?.error || "일지 데이터를 불러오지 못했습니다."));
				return;
			}
			const dataRows: F14030Row[] = Array.isArray(j30.data) ? j30.data : [];
			const plans: F14040PlanForPrint[] =
				j40?.success && Array.isArray(j40.data) ? j40.data : [];
			const planMeta = buildPlanMetaFromF14040Json(plans);
			const sections = buildParticipationSections(dataRows, planMeta);
			if (sections.length === 0) {
				alert(
					"출력할 참여 데이터가 없습니다. 해당 기간 일지에 프로그램 참석자(PGMAN0)가 입력된 행이 있는지 확인해 주세요.",
				);
				return;
			}
			const html = buildProgramParticipationPrintHtml(start, end, sections);
			const printWindow = window.open("", "_blank");
			if (!printWindow) {
				alert("팝업이 차단되었습니다. 팝업 차단을 해제해 주세요.");
				return;
			}
			printWindow.document.open();
			printWindow.document.write(html);
			printWindow.document.close();
			setTimeout(() => {
				printWindow.focus();
				printWindow.print();
			}, 250);
			setPeriodPrintKind(null);
		} catch (e) {
			alert(e instanceof Error ? e.message : "출력 중 오류가 발생했습니다.");
		}
	};

	const fieldRo =
		"px-2 py-1.5 text-sm border border-blue-300 rounded bg-white w-full max-w-full focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-600";
	const btnBase =
		"px-3 py-1.5 text-sm font-medium rounded border transition-colors disabled:opacity-40 disabled:pointer-events-none";
	const btnBlue = `${btnBase} text-blue-900 bg-blue-100 border-blue-300 hover:bg-blue-200`;
	const btnAmber = `${btnBase} text-amber-900 bg-amber-100 border-amber-400 hover:bg-amber-200`;
	const btnGreen = `${btnBase} text-white bg-green-600 border-green-700 hover:bg-green-700 disabled:hover:bg-green-600`;
	const btnRed = `${btnBase} text-red-800 bg-red-50 border-red-300 hover:bg-red-100`;
	const btnWhite = `${btnBase} text-blue-900 bg-white border-blue-300 hover:bg-blue-50`;

	/** 상단 표에서 행을 고르지 않았을 때 하단 폼 비활성 표시(「추가」로 신규 입력 중은 제외) */
	const formAreaLocked =
		!selectedSvdDate ||
		(programsForDate.length > 0 && editingDseq == null && !isAddingNewProgram);

	const canEditFormFields =
		!formAreaLocked &&
		(isAddingNewProgram || (editingDseq != null && formFieldsUnlocked));

	const attachedPhotos = useMemo(() => parseMimgPhotos(formData.MIMG), [formData.MIMG]);

	const handleUploadPhotos = async (files: FileList | null) => {
		if (!canEditFormFields) {
			alert("「수정」또는 「추가」후 사진을 첨부할 수 있습니다.");
			return;
		}
		if (!files || files.length === 0) return;
		const remain = MAX_LOG_PHOTOS - attachedPhotos.length;
		if (remain <= 0) {
			alert(`사진은 최대 ${MAX_LOG_PHOTOS}장까지 첨부할 수 있습니다.`);
			return;
		}
		const picked = Array.from(files).slice(0, remain);
		setPhotoUploading(true);
		try {
			const next = [...attachedPhotos];
			for (const file of picked) {
				const fd = new FormData();
				fd.append("file", file);
				const res = await fetch("/api/program-daily-log/photos", {
					method: "POST",
					body: fd,
					credentials: "include",
				});
				const json = await res.json().catch(() => ({}));
				if (!res.ok || !json?.success || !json?.photo?.blobName) {
					throw new Error(json?.error || `${file.name} 업로드에 실패했습니다.`);
				}
				next.push({
					blobName: String(json.photo.blobName),
					fileName: String(json.photo.fileName || file.name || ""),
				});
			}
			setFormData((p) => ({ ...p, MIMG: serializeMimgPhotos(next) }));
			if (files.length > remain) {
				alert(`사진은 최대 ${MAX_LOG_PHOTOS}장까지 첨부됩니다. 초과분은 제외되었습니다.`);
			}
		} catch (e) {
			alert(e instanceof Error ? e.message : "사진 업로드 중 오류가 발생했습니다.");
		} finally {
			setPhotoUploading(false);
			if (photoInputRef.current) photoInputRef.current.value = "";
		}
	};

	const handleRemovePhoto = async (blobName: string) => {
		if (!canEditFormFields) {
			alert("「수정」또는 「추가」후 사진을 삭제할 수 있습니다.");
			return;
		}
		if (!confirm("이 사진을 삭제하시겠습니까?")) return;
		setPhotoUploading(true);
		try {
			const res = await fetch("/api/program-daily-log/photos", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ blobName }),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "사진 삭제에 실패했습니다.");
			}
			const next = attachedPhotos.filter((p) => p.blobName !== blobName);
			setFormData((p) => ({ ...p, MIMG: serializeMimgPhotos(next) }));
		} catch (e) {
			alert(e instanceof Error ? e.message : "사진 삭제 중 오류가 발생했습니다.");
		} finally {
			setPhotoUploading(false);
		}
	};

	const onPgGuChange = (code: string) => {
		if (!canEditFormFields) return;
		const o = PG_GU_OPTIONS.find((x) => x.code === code);
		setFormData((prev) => ({
			...prev,
			PG_GU: code,
			PG_GU_NM: o ? o.label : prev.PG_GU_NM,
		}));
	};

	const onProgramPlanChange = (pgseqStr: string) => {
		if (!canEditFormFields) return;
		if (!pgseqStr) {
			setFormData((prev) => ({
				...prev,
				PGSEQ: "",
				SVDIC: "",
				PG_GU: "",
				PG_GU_NM: "",
				PGADD: "",
				PGMAN1: "",
				PGMAN2: "",
				PGOJ: "",
				PGJB: "",
				PGDES: "",
			}));
			return;
		}
		const seq = parsePgseq(pgseqStr);
		const plan = seq != null ? pgseqToPlan.get(seq) : undefined;
		if (!plan) {
			setFormData((prev) => ({ ...prev, PGSEQ: pgseqStr }));
			return;
		}
		setFormData((prev) => applyPlanToForm(prev, plan));
	};

	const showModifyButton =
		!formAreaLocked && editingDseq != null && !isAddingNewProgram && !formFieldsUnlocked;

	return (
		<div className="flex flex-col h-full min-h-0 w-full max-w-full min-w-0 overflow-hidden text-black bg-white">
			<div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-blue-200 bg-blue-50 print:hidden">
				<div className="flex items-center gap-2">
					<h1 className="text-xl font-semibold text-blue-900">프로그램 일지</h1>
					<button
						type="button"
						onClick={handleNew}
						disabled={saveLoading}
						className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-blue-700 rounded hover:bg-blue-700 disabled:opacity-50"
					>
						신규생성
					</button>
				</div>
				<div className="flex flex-wrap items-center gap-4">
					<div className="flex items-center gap-2">
						<label className="text-sm font-medium text-blue-900 whitespace-nowrap">업무기간</label>
						<input
							type="date"
							value={workPeriodStart}
							onChange={(e) => setWorkPeriodStart(e.target.value)}
							className="px-2 py-1 text-sm bg-white border border-blue-300 rounded"
						/>
						<span className="text-sm text-blue-900">~</span>
						<input
							type="date"
							value={workPeriodEnd}
							onChange={(e) => setWorkPeriodEnd(e.target.value)}
							className="px-2 py-1 text-sm bg-white border border-blue-300 rounded"
						/>
					</div>
					<button
						type="button"
						onClick={() => handleOpenPeriodPrintModal("log")}
						className="px-3 py-1.5 text-sm font-medium text-blue-900 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200"
					>
						기간설정 일지출력
					</button>
					<button
						type="button"
						onClick={() => handleOpenPeriodPrintModal("participation")}
						className="px-3 py-1.5 text-sm font-medium text-blue-900 bg-blue-100 border border-blue-300 rounded hover:bg-blue-200"
					>
						프로그램 참여 실적 출력
					</button>
					{/* <div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleSearch}
							disabled={loading}
							className="px-4 py-1.5 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50"
						>
							검색
						</button>
					</div> */}
				</div>
			</div>

			{listError ? (
				<div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-200">{listError}</div>
			) : null}

			<div className="flex flex-col xl:flex-row flex-1 min-h-0 overflow-hidden">
				<div className="flex flex-col w-full xl:w-[22%] xl:min-w-[200px] min-w-0 shrink-0 bg-white border-r border-blue-200 border-b xl:border-b-0 xl:h-full xl:min-h-0 xl:overflow-hidden">
					<div className="px-3 py-2 border-b border-blue-200 bg-blue-50">
						<label className="text-sm font-medium text-blue-900">프로그램</label>
					</div>
					<div className="px-3 py-2 border-b border-blue-200 bg-blue-50">
						<label className="text-xs text-blue-900/80">서비스일자 (같은 날짜는 한 줄)</label>
					</div>
					<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
						<div className="flex-1 min-h-0 overflow-y-auto bg-white flex flex-col">
							<div className="shrink-0">
								{loading ? (
									<div className="px-3 py-2 text-sm text-blue-900/60">로딩 중...</div>
								) : pagedDates.length === 0 ? (
									<div className="px-3 py-2 text-sm text-blue-900/60">
										{!hasSearched
											? "업무기간을 설정한 뒤 「검색」을 눌러 주세요."
											: "해당 기간에 서비스일자가 없습니다."}
									</div>
								) : (
									pagedDates.map((date) => (
										<div
											key={date}
											role="button"
											tabIndex={0}
											onClick={() => handleSelectDate(date)}
											onKeyDown={(ev) => {
												if (ev.key === "Enter" || ev.key === " ") handleSelectDate(date);
											}}
											className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-blue-50 ${
												selectedSvdDate === date ? "bg-blue-100 font-semibold" : ""
											}`}
										>
											{date}
										</div>
									))
								)}
							</div>
							{dateTotalPages > 1 ? (
								<div className="shrink-0 border-t border-blue-200 bg-white px-1.5 py-1.5 mt-0">
									<div className="flex items-center justify-center gap-0.5 flex-wrap">
										<button
											type="button"
											onClick={() => setDatePage(1)}
											disabled={datePage === 1}
											className="px-1.5 py-0.5 text-xs border border-blue-300 rounded disabled:opacity-40 hover:bg-blue-50 shrink-0"
											aria-label="첫 페이지"
										>
											&lt;&lt;
										</button>
										<button
											type="button"
											onClick={() => setDatePage((p) => Math.max(1, p - 1))}
											disabled={datePage === 1}
											className="px-1.5 py-0.5 text-xs border border-blue-300 rounded disabled:opacity-40 hover:bg-blue-50 shrink-0"
											aria-label="이전 페이지"
										>
											&lt;
										</button>
										{datePageNumberWindow.map((p) => (
											<button
												key={p}
												type="button"
												onClick={() => setDatePage(p)}
												className={`min-w-[1.75rem] px-1.5 py-0.5 text-xs border rounded shrink-0 tabular-nums ${
													p === datePage
														? "border-blue-500 bg-blue-200 font-semibold text-blue-900"
														: "border-blue-300 hover:bg-blue-50 text-blue-900"
												}`}
											>
												{p}
											</button>
										))}
										<button
											type="button"
											onClick={() => setDatePage((p) => Math.min(dateTotalPages, p + 1))}
											disabled={datePage >= dateTotalPages}
											className="px-1.5 py-0.5 text-xs border border-blue-300 rounded disabled:opacity-40 hover:bg-blue-50 shrink-0"
											aria-label="다음 페이지"
										>
											&gt;
										</button>
										<button
											type="button"
											onClick={() => setDatePage(dateTotalPages)}
											disabled={datePage >= dateTotalPages}
											className="px-1.5 py-0.5 text-xs border border-blue-300 rounded disabled:opacity-40 hover:bg-blue-50 shrink-0"
											aria-label="마지막 페이지"
										>
											&gt;&gt;
										</button>
									</div>
								</div>
							) : null}
						</div>
					</div>
				</div>

				<div className="flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden bg-white">
					<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
						{!isAddingNewProgram ? (
						<div className="shrink-0 border-b border-blue-200 bg-white w-full min-w-0">
							<table className="w-full text-sm table-fixed border-collapse">
								<colgroup>
									<col className="w-[8.5rem]" />
									<col className="w-[6.5rem]" />
									<col className="w-[6.5rem]" />
									<col className="w-[9.5rem]" />
									<col />
								</colgroup>
								<thead>
									<tr className="h-10 border-b border-blue-200 bg-blue-50">
										<th className="px-2 font-semibold text-center text-blue-900 border-r border-blue-200 whitespace-nowrap align-middle">
											서비스일자
										</th>
										<th className="px-2 font-semibold text-center text-blue-900 border-r border-blue-200 whitespace-nowrap align-middle">
											시작시간
										</th>
										<th className="px-2 font-semibold text-center text-blue-900 border-r border-blue-200 whitespace-nowrap align-middle">
											종료시간
										</th>
										<th className="px-2 font-semibold text-center text-blue-900 border-r border-blue-200 whitespace-nowrap align-middle">
											프로그램구분
										</th>
										<th className="px-2 font-semibold text-center text-blue-900 whitespace-nowrap align-middle">프로그램명</th>
									</tr>
								</thead>
								<tbody className="h-[9rem]">
									{loading ? (
										<tr className="h-[9rem]">
											<td colSpan={5} className="px-3 align-middle text-center text-blue-900/60">
												로딩 중...
											</td>
										</tr>
									) : !selectedSvdDate ? (
										<tr className="h-[9rem]">
											<td colSpan={5} className="px-3 align-middle text-center text-blue-900/60">
												서비스일자를 선택해 주세요
											</td>
										</tr>
									) : programsForDate.length === 0 ? (
										<tr className="h-[9rem]">
											<td colSpan={5} className="px-3 align-middle text-center text-blue-900/60">
												해당 일자에 등록된 프로그램이 없습니다. 아래에서 추가할 수 있습니다.
											</td>
										</tr>
									) : (
										<>
											{pagedProgramsForDate.map((program) => {
												const selected = editingDseq != null && program.DSEQ === editingDseq;
												return (
													<tr
														key={program.DSEQ ?? String(program.SVSTM) + String(program.SVDIC)}
														onClick={() => handleSelectProgram(program)}
														className={`h-12 max-h-12 border-b border-blue-100 hover:bg-blue-50 cursor-pointer ${
															selected ? "bg-blue-100 font-medium" : "bg-white"
														}`}
													>
														<td className="px-2 align-middle text-center border-r border-blue-100 whitespace-nowrap truncate">
															{formatYmd(program.SVDT)}
														</td>
														<td className="px-2 align-middle text-center border-r border-blue-100 truncate">
															{String(program.SVSTM ?? "")}
														</td>
														<td className="px-2 align-middle text-center border-r border-blue-100 truncate">
															{String(program.SVETM ?? "")}
														</td>
														<td className="px-2 align-middle text-center border-r border-blue-100 text-xs truncate">
															{programCategoryLabel(program, pgseqToPgGuMap)}
														</td>
														<td className="px-2 align-middle text-left truncate">{String(program.SVDIC ?? "")}</td>
													</tr>
												);
											})}
											{Array.from({
												length: Math.max(0, PROGRAM_LIST_PAGE_SIZE - pagedProgramsForDate.length),
											}).map((_, i) => (
												<tr
													key={`program-pad-${i}`}
													className="h-12 max-h-12 border-b border-blue-50/50 pointer-events-none bg-blue-50/10"
													aria-hidden
												>
													<td colSpan={5} />
												</tr>
											))}
										</>
									)}
								</tbody>
							</table>
							{programsForDate.length > PROGRAM_LIST_PAGE_SIZE ? (
								<div className="flex items-center justify-center gap-1 py-1.5 border-t border-blue-200 bg-blue-50/60 shrink-0">
									<button
										type="button"
										onClick={() => setProgramListPage(1)}
										disabled={programListPage === 1}
										className="px-2 py-0.5 text-xs border border-blue-300 rounded disabled:opacity-40 hover:bg-blue-50"
									>
										&lt;&lt;
									</button>
									<button
										type="button"
										onClick={() => setProgramListPage((p) => Math.max(1, p - 1))}
										disabled={programListPage === 1}
										className="px-2 py-0.5 text-xs border border-blue-300 rounded disabled:opacity-40 hover:bg-blue-50"
									>
										&lt;
									</button>
									<span className="text-xs text-blue-900 px-1 tabular-nums">
										{programListPage} / {programTotalPages}
									</span>
									<button
										type="button"
										onClick={() => setProgramListPage((p) => Math.min(programTotalPages, p + 1))}
										disabled={programListPage >= programTotalPages}
										className="px-2 py-0.5 text-xs border border-blue-300 rounded disabled:opacity-40 hover:bg-blue-50"
									>
										&gt;
									</button>
									<button
										type="button"
										onClick={() => setProgramListPage(programTotalPages)}
										disabled={programListPage >= programTotalPages}
										className="px-2 py-0.5 text-xs border border-blue-300 rounded disabled:opacity-40 hover:bg-blue-50"
									>
										&gt;&gt;
									</button>
								</div>
							) : null}
						</div>
						) : null}

						<div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-blue-200 bg-blue-50 print:hidden shrink-0">
							<div className="flex flex-wrap items-center gap-1.5">
								{/* <button
									type="button"
									onClick={handleCopyToCenter}
									disabled={isAddingNewProgram}
									className={btnBlue}
								>
									센터로복사
								</button> */}
								{/* <button
									type="button"
									onClick={handleNew}
									disabled={isAddingNewProgram}
									className={btnBlue}
								>
									추가
								</button> */}
								{showModifyButton ? (
									<button
										type="button"
										onClick={() => setFormFieldsUnlocked(true)}
										className={btnAmber}
									>
										수정
									</button>
								) : null}
								{canEditFormFields ? (
									<button
										type="button"
										onClick={handleCancelEdit}
										disabled={saveLoading}
										className={btnWhite}
									>
										취소
									</button>
								) : null}
								<button
									type="button"
									onClick={() => void handleSave()}
									disabled={saveLoading || !canEditFormFields}
									className={btnGreen}
								>
									{saveLoading ? "처리 중…" : editingDseq != null ? "저장(수정)" : "저장(등록)"}
								</button>
								<button
									type="button"
									onClick={() => void handleDelete()}
									disabled={saveLoading || editingDseq == null || isAddingNewProgram}
									className={btnRed}
								>
									삭제
								</button>
							</div>
							<div className="flex flex-wrap items-center gap-1.5">
								<button
									type="button"
									onClick={handleCopyDate}
									disabled={isAddingNewProgram || editingDseq == null}
									className={btnBlue}
								>
									해당일지 복사
								</button>
								{/* <button
									type="button"
									onClick={handleCopyByCase}
									disabled={isAddingNewProgram}
									className={btnBlue}
								>
									건별복사
								</button> */}
								<button
									type="button"
									onClick={handlePrintSingleProgramLog}
									disabled={isAddingNewProgram || editingDseq == null}
									className={btnBlue}
								>
									해당 일지 출력
								</button>
							</div>
						</div>

						<div className="relative flex-1 min-h-0 overflow-y-auto bg-slate-50/50">
							<div
								className={`p-4 ${formAreaLocked ? "pointer-events-none" : ""}`}
							>
								<fieldset
									disabled={!canEditFormFields}
									className={`grid gap-3 w-full min-w-0 border-0 p-0 m-0 ${
										formAreaLocked ? "blur-sm select-none opacity-70" : ""
									}`}
								>
									<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
									<div>
										<label className="block text-xs text-blue-900/80 mb-0.5">서비스일자 (SVDT)</label>
										<input
											type="date"
											value={formData.SVDT}
											onChange={(e) => setFormData((p) => ({ ...p, SVDT: e.target.value }))}
											className={fieldRo}
										/>
									</div>
									<div>
										<label className="block text-xs text-blue-900/80 mb-0.5">시작 (SVSTM, HH:mm)</label>
										<input
											type="time"
											value={padTimeForInput(formData.SVSTM)}
											onChange={(e) =>
												setFormData((p) => ({ ...p, SVSTM: e.target.value ? e.target.value.slice(0, 5) : "" }))
											}
											className={fieldRo}
										/>
									</div>
									<div>
										<label className="block text-xs text-blue-900/80 mb-0.5">종료 (SVETM, HH:mm)</label>
										<input
											type="time"
											value={padTimeForInput(formData.SVETM)}
											onChange={(e) =>
												setFormData((p) => ({ ...p, SVETM: e.target.value ? e.target.value.slice(0, 5) : "" }))
											}
											className={fieldRo}
										/>
									</div>
									<div>
										<label className="block text-xs text-blue-900/80 mb-0.5">등록일자 (INDT)</label>
										<input
											type="date"
											value={formData.INDT}
											onChange={(e) => setFormData((p) => ({ ...p, INDT: e.target.value }))}
											className={fieldRo}
										/>
									</div>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div>
										<label className="block text-xs text-blue-900/80 mb-0.5">
											프로그램명
											{selectablePlans.length > 0 ? ` (${selectablePlans.length}건)` : ""}
										</label>
										<select
											value={formData.PGSEQ}
											onChange={(e) => onProgramPlanChange(e.target.value)}
											className={fieldRo}
										>
											<option value="">해당 기관 프로그램계획서에서 선택</option>
											{formData.PGSEQ &&
											!selectablePlans.some((p) => String(parsePgseq(p.PGSEQ) ?? "") === formData.PGSEQ) ? (
												<option value={formData.PGSEQ}>
													{formData.SVDIC.trim() || `일련번호 ${formData.PGSEQ}`}
												</option>
											) : null}
											{selectablePlans.map((p) => {
												const seq = parsePgseq(p.PGSEQ);
												if (seq == null) return null;
												const guLbl = labelFromPgGuCode(String(p.PG_GU ?? ""));
												const name = String(p.PGNM ?? "").trim() || `(일련번호 ${seq})`;
												return (
													<option key={seq} value={String(seq)}>
														{guLbl ? `${name} · ${guLbl}` : name}
													</option>
												);
											})}
										</select>
										{f14040LoadError ? (
											<p className="mt-1 text-[11px] text-red-600">{f14040LoadError}</p>
										) : selectablePlans.length === 0 ? (
											<p className="mt-1 text-[11px] text-blue-900/65">
												등록된 프로그램이 없습니다. 프로그램계획서에서 먼저 등록해 주세요.
											</p>
										) : (
											<p className="mt-1 text-[11px] text-blue-900/65">
												선택 시 프로그램 구분·장소·진행자·보조 진행자·목표·준비물·운영과정이 계획서 내용으로 채워집니다.
											</p>
										)}
									</div>
									<div>
										<label className="block text-xs text-blue-900/80 mb-0.5">프로그램 구분</label>
										<select
											value={formData.PG_GU}
											onChange={(e) => onPgGuChange(e.target.value)}
											className={fieldRo}
										>
											<option value="">선택</option>
											{PG_GU_OPTIONS.map((o) => (
												<option key={o.code} value={o.code}>
													{o.code}. {o.label}
												</option>
											))}
										</select>
									</div>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
									<div className="sm:col-span-2">
										<label className="block text-xs text-blue-900/80 mb-0.5">프로그램 장소 (PGADD)</label>
										<input
											value={formData.PGADD}
											onChange={(e) => setFormData((p) => ({ ...p, PGADD: e.target.value }))}
											maxLength={50}
											className={fieldRo}
										/>
									</div>
									<div>
										<label className="block text-xs text-blue-900/80 mb-0.5">진행자 (PGMAN1)</label>
										<input
											value={formData.PGMAN1}
											onChange={(e) => setFormData((p) => ({ ...p, PGMAN1: e.target.value }))}
											maxLength={20}
											className={fieldRo}
										/>
									</div>
									<div>
										<label className="block text-xs text-blue-900/80 mb-0.5">보조 진행자 (PGMAN2)</label>
										<input
											value={formData.PGMAN2}
											onChange={(e) => setFormData((p) => ({ ...p, PGMAN2: e.target.value }))}
											maxLength={20}
											className={fieldRo}
										/>
									</div>
								</div>

								<div>
									<label className="block text-xs text-blue-900/80 mb-0.5">프로그램 목표 (PGOJ)</label>
									<textarea
										value={formData.PGOJ}
										onChange={(e) => setFormData((p) => ({ ...p, PGOJ: e.target.value }))}
										maxLength={500}
										rows={2}
										className={fieldRo + " resize-y"}
									/>
								</div>
								<div>
									<label className="block text-xs text-blue-900/80 mb-0.5">준비물 (PGJB)</label>
									<textarea
										value={formData.PGJB}
										onChange={(e) => setFormData((p) => ({ ...p, PGJB: e.target.value }))}
										maxLength={200}
										rows={2}
										className={fieldRo + " min-h-[2.75rem] resize-y"}
									/>
								</div>
								<div>
									<label className="block text-xs text-blue-900/80 mb-0.5">프로그램운영과정및내용 (PGDES)</label>
									<textarea
										value={formData.PGDES}
										onChange={(e) => setFormData((p) => ({ ...p, PGDES: e.target.value }))}
										maxLength={1000}
										rows={10}
										className={fieldRo + " min-h-[15rem] resize-y"}
									/>
								</div>

								<div>
									<label className="block text-xs text-blue-900/80 mb-0.5">서비스평가 (SVDES)</label>
									<select
										value=""
										onChange={(e) => {
											const v = e.target.value;
											if (!v) return;
											setFormData((p) => ({ ...p, SVDES: v.slice(0, 2000) }));
										}}
										className={fieldRo + " mb-1.5"}
									>
										<option value="">
											{!formData.PGSEQ
												? "프로그램을 먼저 선택해 주세요"
												: svdesSamples.length === 0
													? "등록된 총평 샘플이 없습니다"
													: "총평 샘플 선택"}
										</option>
										{svdesSamples.map((s, i) => (
											<option key={`${i}-${s.slice(0, 16)}`} value={s}>
												{s.length > 60 ? `${s.slice(0, 60)}…` : s}
											</option>
										))}
									</select>
									<textarea
										value={formData.SVDES}
										onChange={(e) => setFormData((p) => ({ ...p, SVDES: e.target.value }))}
										maxLength={2000}
										rows={5}
										className={fieldRo + " min-h-[100px] resize-y"}
									/>
								</div>

								</fieldset>

								<div className="space-y-2 rounded border border-blue-200 bg-white p-3">
									<div className="flex flex-wrap items-center justify-start gap-2">
										<label className="block text-xs text-blue-900/80">프로그램 참석자</label>
										<button
											type="button"
											disabled={!canEditFormFields}
											onClick={() => setAttendeeModalOpen(true)}
											className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-blue-700 rounded hover:bg-blue-700 disabled:opacity-40"
										>
											프로그램 참석자 등록 및 수정
										</button>
									</div>
									{attendeeEvals.length === 0 ? (
										<div className="text-sm text-blue-900/55 py-2 px-2 border border-dashed border-blue-200 rounded bg-blue-50/30">
											등록된 참석자가 없습니다. 버튼을 눌러 수급자를 선택·평가해 주세요.
										</div>
									) : (
										<div className="flex flex-wrap gap-1.5">
											{attendeeEvals.map((ev) => (
												<div key={ev.PNUM} className="relative group">
													<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-950 text-sm border border-blue-200 cursor-default">
														{ev.name}
													</span>
													<div className="pointer-events-none invisible group-hover:visible absolute left-0 bottom-full mb-1 z-30 w-64 rounded border border-blue-300 bg-white shadow-lg p-2.5 text-xs text-blue-950">
														<div className="font-semibold mb-1.5">{ev.name}</div>
														<div className="grid grid-cols-[3.2rem_1fr] gap-y-1 items-center">
															<span className="text-blue-900/70">참여도</span>
															<span><LevelBadge flag={ev.JOIN_FLAG} /></span>
															<span className="text-blue-900/70">수행도</span>
															<span><LevelBadge flag={ev.PLAY_FLAG} /></span>
															<span className="text-blue-900/70">만족도</span>
															<span><LevelBadge flag={ev.HAPP_FLAG} /></span>
															<span className="text-blue-900/70">특이사항</span>
															<span className="whitespace-pre-wrap break-words">{ev.RESP_DESC || "-"}</span>
														</div>
													</div>
												</div>
											))}
										</div>
									)}
									<p className="text-[11px] text-blue-900/60">
										참석자 변경은 「프로그램 참석자 등록 및 수정」 버튼에서 평가를 저장·삭제하세요.
									</p>
								</div>

								<fieldset
									disabled={!canEditFormFields}
									className={`grid gap-3 w-full min-w-0 border-0 p-0 m-0 ${
										formAreaLocked ? "blur-sm select-none opacity-70" : ""
									}`}
								>

								<div>
									<label className="block text-xs text-blue-900/80 mb-0.5">비고 (ETC)</label>
									<input
										value={formData.ETC}
										onChange={(e) => setFormData((p) => ({ ...p, ETC: e.target.value }))}
										maxLength={1000}
										className={fieldRo}
									/>
								</div>

								<div className="rounded border border-blue-200 bg-blue-50/40 p-3 space-y-2">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<label className="block text-xs font-medium text-blue-900">
											첨부 사진 (최대 {MAX_LOG_PHOTOS}장)
										</label>
										<div className="flex items-center gap-2">
											<input
												ref={photoInputRef}
												type="file"
												accept="image/jpeg,image/png,image/webp,image/gif"
												multiple
												className="hidden"
												onChange={(e) => handleUploadPhotos(e.target.files)}
											/>
											<button
												type="button"
												disabled={!canEditFormFields || photoUploading || attachedPhotos.length >= MAX_LOG_PHOTOS}
												onClick={() => photoInputRef.current?.click()}
												className="rounded border border-blue-400 bg-white px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50"
											>
												{photoUploading ? "업로드 중..." : "사진 첨부"}
											</button>
										</div>
									</div>
									<p className="text-[11px] text-blue-900/70">
										jpeg/png/webp/gif · 장당 8MB 이하 · 저장 시 일지에 함께 보관되며 출력 시 평가 아래에 표시됩니다.
									</p>
									{attachedPhotos.length === 0 ? (
										<div className="text-sm text-blue-900/55 py-2">첨부된 사진이 없습니다.</div>
									) : (
										<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
											{attachedPhotos.map((p) => (
												<div
													key={p.blobName}
													className="relative rounded border border-blue-200 bg-white overflow-hidden aspect-[4/3]"
												>
													{/* eslint-disable-next-line @next/next/no-img-element */}
													<img
														src={photoViewUrl(p.blobName)}
														alt={p.fileName || "첨부사진"}
														className="h-full w-full object-contain bg-white"
													/>
													{canEditFormFields ? (
														<button
															type="button"
															disabled={photoUploading}
															onClick={() => handleRemovePhoto(p.blobName)}
															className="absolute top-1 right-1 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
														>
															삭제
														</button>
													) : null}
													{p.fileName ? (
														<div className="absolute bottom-0 inset-x-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
															{p.fileName}
														</div>
													) : null}
												</div>
											))}
										</div>
									)}
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-blue-900/70 border-t border-blue-100 pt-2">
									<div>
										DSEQ: {editingDseq != null ? editingDseq : "(신규)"} · 저장 시 등록자:{" "}
										{userInfo?.empnm ? `${userInfo.empnm} (${userInfo.empno ?? "-"})` : "로그인 정보 없음"}
									</div>
								</div>
								</fieldset>
							</div>
							{formAreaLocked ? (
								<div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-slate-50/70">
									<p className="text-center text-base font-semibold text-blue-900 bg-white px-8 py-5 rounded-lg border border-blue-300 shadow-md max-w-sm">
										프로그램 일지를 선택해 주세요
									</p>
								</div>
							) : null}
						</div>
					</div>
				</div>
			</div>

			<ProgramAttendeeEvalModal
				open={attendeeModalOpen}
				onClose={() => setAttendeeModalOpen(false)}
				canEdit={canEditFormFields}
				programName={formData.SVDIC}
				serviceDate={formData.SVDT}
				pgseq={formData.PGSEQ}
				dseq={editingDseq}
				evals={attendeeEvals}
				onEvalsChange={applyAttendeeEvals}
			/>

			{pendingLeaveNav ? (
				<div
					className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 print:hidden p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="leave-new-program-title"
					onClick={(e) => {
						if (e.target === e.currentTarget) setPendingLeaveNav(null);
					}}
				>
					<div
						className="bg-white rounded-lg border border-blue-300 shadow-xl w-full max-w-md p-5"
						onClick={(e) => e.stopPropagation()}
					>
						<h2 id="leave-new-program-title" className="text-lg font-semibold text-blue-900 mb-3">
							작성 중인 일지
						</h2>
						<p className="text-sm text-blue-900/90 leading-relaxed mb-5">
							저장하지 않으면 현재 생성한 일지는 저장되지 않습니다. 정말로 이동하시겠습니까?
						</p>
						<div className="flex justify-end gap-2 flex-wrap">
							<button
								type="button"
								onClick={() => setPendingLeaveNav(null)}
								className="px-4 py-2 text-sm font-medium text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-50"
							>
								취소
							</button>
							<button
								type="button"
								onClick={confirmLeaveNewProgram}
								className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-700 rounded hover:bg-blue-700"
							>
								이동하기
							</button>
						</div>
					</div>
				</div>
			) : null}

			{periodPrintKind ? (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 print:hidden p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="period-print-title"
					onClick={(e) => {
						if (e.target === e.currentTarget) setPeriodPrintKind(null);
					}}
				>
					<div
						className="bg-white rounded-lg border border-blue-300 shadow-xl w-full max-w-md p-5"
						onClick={(e) => e.stopPropagation()}
					>
						<h2 id="period-print-title" className="text-lg font-semibold text-blue-900 mb-4">
							{periodPrintKind === "log" ? "기간설정 일지출력" : "프로그램 참여 실적 출력"}
						</h2>
						<div className="flex flex-col gap-4 mb-5">
							<div className="flex flex-col gap-1">
								<label htmlFor="period-log-start" className="text-sm font-medium text-blue-900">
									시작일
								</label>
								<input
									id="period-log-start"
									type="date"
									value={periodLogStart}
									onChange={(e) => setPeriodLogStart(e.target.value)}
									className="px-2 py-1.5 text-sm bg-white border border-blue-300 rounded w-full max-w-full"
								/>
							</div>
							<div className="flex flex-col gap-1">
								<label htmlFor="period-log-end" className="text-sm font-medium text-blue-900">
									종료일
								</label>
								<input
									id="period-log-end"
									type="date"
									value={periodLogEnd}
									onChange={(e) => setPeriodLogEnd(e.target.value)}
									className="px-2 py-1.5 text-sm bg-white border border-blue-300 rounded w-full max-w-full"
								/>
							</div>
							<p className="text-xs text-blue-900/75 leading-snug">
								{periodPrintKind === "log"
									? "선택한 기간의 일지를 날짜·시간 순으로 모두 인쇄합니다. 각 일지는 한 페이지 양식으로 이어집니다."
									: "선택한 기간의 프로그램 참여 실적을 출력합니다."}
							</p>
						</div>
						<div className="flex justify-end gap-2 flex-wrap">
							<button
								type="button"
								onClick={() => setPeriodPrintKind(null)}
								className="px-4 py-2 text-sm font-medium text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-50"
							>
								취소
							</button>
							<button
								type="button"
								onClick={() =>
									void (periodPrintKind === "log"
										? handlePrintProgramLogsInPeriod()
										: handlePrintProgramParticipation())
								}
								className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-green-700 rounded hover:bg-green-700"
							>
								출력
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
