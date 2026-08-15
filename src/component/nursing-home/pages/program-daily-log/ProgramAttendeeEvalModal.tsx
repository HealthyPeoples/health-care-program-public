"use client";

/**
 * @file 프로그램일지 — 수급자 개별평가 모달
 *
 * @description
 * F14031 기반 참석자 평가. 좌측 수급자 목록 + 우측 평가 입력.
 *
 * @module component/nursing-home/pages/program-daily-log/ProgramAttendeeEvalModal
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { formatCareGradeLabel, normalizePGrdForSelect } from "../../utils/careGrade";

export type AttendeeEval = {
	PNUM: number;
	name: string;
	sex: string;
	birthday: string;
	gradeLabel: string;
	P_GRD: string;
	JOIN_FLAG: string;
	PLAY_FLAG: string;
	HAPP_FLAG: string;
	RESP_DESC: string;
};

type MemberRow = {
	PNUM: number;
	name: string;
	sex: string;
	birthday: string;
	gradeLabel: string;
	P_GRD: string;
	status: string;
};

type ListFilter = "all" | "in" | "attend" | "pending";

const LEVELS: { code: string; label: string }[] = [
	{ code: "1", label: "상" },
	{ code: "2", label: "중" },
	{ code: "3", label: "하" },
];

export function levelLabel(code: string): string {
	return LEVELS.find((x) => x.code === code)?.label ?? "";
}

function formatYmdLoose(value: unknown): string {
	if (value == null || value === "") return "";
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		const y = value.getFullYear();
		const mo = String(value.getMonth() + 1).padStart(2, "0");
		const d = String(value.getDate()).padStart(2, "0");
		return `${y}-${mo}-${d}`;
	}
	const s = String(value).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	return s.slice(0, 10);
}

function sexLabel(raw: unknown): string {
	const s = String(raw ?? "").trim();
	if (s === "1" || s === "M" || s === "남") return "남";
	if (s === "2" || s === "F" || s === "여") return "여";
	return s || "-";
}

function isInhouseStatus(st: string): boolean {
	const s = String(st ?? "").trim();
	return s === "1" || s === "입소" || s.includes("입소");
}

function LevelPicks({
	value,
	onChange,
	disabled,
}: {
	value: string;
	onChange: (v: string) => void;
	disabled: boolean;
}) {
	return (
		<div className="flex gap-1">
			{LEVELS.map((lv) => {
				const on = value === lv.code;
				const tone =
					lv.code === "1"
						? on
							? "bg-emerald-600 text-white border-emerald-700"
							: "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
						: lv.code === "2"
							? on
								? "bg-amber-500 text-white border-amber-600"
								: "bg-white text-amber-800 border-amber-200 hover:bg-amber-50"
							: on
								? "bg-slate-600 text-white border-slate-700"
								: "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";
				return (
					<button
						key={lv.code}
						type="button"
						disabled={disabled}
						onClick={() => onChange(lv.code)}
						className={`min-w-[3rem] px-3 py-1.5 text-sm font-medium border rounded disabled:opacity-40 ${tone}`}
					>
						{lv.label}
					</button>
				);
			})}
		</div>
	);
}

function evalsKey(list: AttendeeEval[]): string {
	return list
		.map((e) => `${e.PNUM}|${e.JOIN_FLAG}|${e.PLAY_FLAG}|${e.HAPP_FLAG}|${e.RESP_DESC}`)
		.sort()
		.join(";");
}

const CLOSE_WITHOUT_APPLY_MSG =
	"참석자 명단을 적용하지 않으면 저장되지 않습니다. 닫으시겠습니까?";

export function LevelBadge({ flag }: { flag: string }) {
	const label = levelLabel(flag);
	if (!label) return <span className="text-blue-900/35">-</span>;
	const cls =
		flag === "1"
			? "bg-emerald-100 text-emerald-800"
			: flag === "2"
				? "bg-amber-100 text-amber-800"
				: "bg-slate-200 text-slate-700";
	return <span className={`inline-block min-w-[1.5rem] px-1 py-0.5 rounded text-[11px] font-semibold text-center ${cls}`}>{label}</span>;
}

type Props = {
	open: boolean;
	onClose: () => void;
	canEdit: boolean;
	programName: string;
	serviceDate: string;
	pgseq: string;
	dseq: number | null;
	evals: AttendeeEval[];
	onEvalsChange: (next: AttendeeEval[]) => void;
};

export default function ProgramAttendeeEvalModal({
	open,
	onClose,
	canEdit,
	programName,
	serviceDate,
	pgseq,
	dseq,
	evals,
	onEvalsChange,
}: Props) {
	const [members, setMembers] = useState<MemberRow[]>([]);
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [q, setQ] = useState("");
	const [listFilter, setListFilter] = useState<ListFilter>("in");
	const [selectedPnum, setSelectedPnum] = useState<number | null>(null);
	const [joinFlag, setJoinFlag] = useState("2");
	const [playFlag, setPlayFlag] = useState("2");
	const [happFlag, setHappFlag] = useState("2");
	const [remark, setRemark] = useState("");
	const [evalOn, setEvalOn] = useState(true);
	const [samples, setSamples] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);
	const [draftEvals, setDraftEvals] = useState<AttendeeEval[]>([]);
	const [openedKey, setOpenedKey] = useState("");
	const [formBaseline, setFormBaseline] = useState("");

	const evalMap = useMemo(() => {
		const m = new Map<number, AttendeeEval>();
		for (const e of draftEvals) m.set(e.PNUM, e);
		return m;
	}, [draftEvals]);

	const loadMembers = useCallback(async () => {
		setLoadingMembers(true);
		try {
			const res = await fetch("/api/f10010", { cache: "no-store", credentials: "include" });
			const json = await res.json();
			if (!res.ok || !json?.success) throw new Error(json?.error || "수급자 목록을 불러오지 못했습니다.");
			const rows = Array.isArray(json.data) ? json.data : [];
			const mapped: MemberRow[] = rows
				.map((r: Record<string, unknown>) => {
					const pnum = parseInt(String(r.PNUM ?? ""), 10);
					if (!Number.isFinite(pnum)) return null;
					const pGrd = normalizePGrdForSelect(r.P_GRD);
					return {
						PNUM: pnum,
						name: String(r.P_NM ?? "").trim() || `(${pnum})`,
						sex: sexLabel(r.P_SEX),
						birthday: formatYmdLoose(r.P_BRDT),
						gradeLabel: formatCareGradeLabel(r.P_GRD),
						P_GRD: pGrd,
						status: String(r.P_ST ?? "").trim(),
					};
				})
				.filter((x: MemberRow | null): x is MemberRow => Boolean(x));
			mapped.sort((a, b) => a.name.localeCompare(b.name, "ko"));
			setMembers(mapped);
		} catch (e) {
			setMembers([]);
			setMsg(e instanceof Error ? e.message : "수급자 목록 조회 오류");
		} finally {
			setLoadingMembers(false);
		}
	}, []);

	const loadSamples = useCallback(async () => {
		const seq = parseInt(pgseq, 10);
		if (!Number.isFinite(seq) || seq <= 0) {
			setSamples([]);
			return;
		}
		try {
			const res = await fetch(`/api/f14039?pgseq=${seq}&smp_flag=2`, { cache: "no-store" });
			const json = await res.json();
			if (!json?.success || !Array.isArray(json.data)) {
				setSamples([]);
				return;
			}
			setSamples(
				json.data
					.map((r: { SMP_DSC?: string }) => String(r.SMP_DSC ?? "").trim())
					.filter(Boolean),
			);
		} catch {
			setSamples([]);
		}
	}, [pgseq]);

	useEffect(() => {
		if (!open) return;
		setQ("");
		setMsg(null);
		setDraftEvals(evals);
		setOpenedKey(evalsKey(evals));
		setSelectedPnum(null);
		setFormBaseline("");
		void loadMembers();
		void loadSamples();
		// 열릴 때 부모 목록만 초깃값으로 받음
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, loadMembers, loadSamples]);

	const filtered = useMemo(() => {
		const needle = q.trim().toLowerCase();
		return members.filter((m) => {
			if (needle && !m.name.toLowerCase().includes(needle)) return false;
			const ev = evalMap.get(m.PNUM);
			if (listFilter === "in" && !isInhouseStatus(m.status)) return false;
			if (listFilter === "attend" && !ev) return false;
			if (listFilter === "pending" && ev) return false;
			return true;
		});
	}, [members, q, listFilter, evalMap]);

	const selectedMember = useMemo(
		() => members.find((m) => m.PNUM === selectedPnum) ?? null,
		[members, selectedPnum],
	);

	const applyMemberToForm = (pnum: number) => {
		setSelectedPnum(pnum);
		const ev = evalMap.get(pnum);
		const nextJoin = ev?.JOIN_FLAG || "2";
		const nextPlay = ev?.PLAY_FLAG || "2";
		const nextHapp = ev?.HAPP_FLAG || "2";
		const nextRemark = ev?.RESP_DESC || "";
		setJoinFlag(nextJoin);
		setPlayFlag(nextPlay);
		setHappFlag(nextHapp);
		setRemark(nextRemark);
		setEvalOn(true);
		setFormBaseline(`${nextJoin}|${nextPlay}|${nextHapp}|${nextRemark}|1`);
	};

	const formDirty =
		selectedPnum != null &&
		formBaseline !== "" &&
		`${joinFlag}|${playFlag}|${happFlag}|${remark}|${evalOn ? "1" : "0"}` !== formBaseline;

	const listDirty = evalsKey(draftEvals) !== openedKey;
	const hasUnappliedChanges = canEdit && (listDirty || formDirty);

	const requestClose = () => {
		if (hasUnappliedChanges) {
			if (!confirm(CLOSE_WITHOUT_APPLY_MSG)) return;
		}
		onClose();
	};

	const persistEval = async (row: AttendeeEval) => {
		if (dseq == null) return;
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
		if (!res.ok || !json?.success) throw new Error(json?.error || "평가 저장에 실패했습니다.");
	};

	const handleSave = async () => {
		if (!canEdit) return;
		if (!selectedMember) {
			setMsg("왼쪽 목록에서 수급자를 선택해 주세요.");
			return;
		}
		if (!evalOn) {
			setMsg("평가여부를 선택한 뒤 저장해 주세요.");
			return;
		}
		if (!joinFlag || !playFlag || !happFlag) {
			setMsg("참여도·수행도·만족도를 모두 선택해 주세요.");
			return;
		}
		const nextRow: AttendeeEval = {
			PNUM: selectedMember.PNUM,
			name: selectedMember.name,
			sex: selectedMember.sex,
			birthday: selectedMember.birthday,
			gradeLabel: selectedMember.gradeLabel,
			P_GRD: selectedMember.P_GRD,
			JOIN_FLAG: joinFlag,
			PLAY_FLAG: playFlag,
			HAPP_FLAG: happFlag,
			RESP_DESC: remark.trim(),
		};
		setSaving(true);
		setMsg(null);
		try {
			const without = draftEvals.filter((e) => e.PNUM !== nextRow.PNUM);
			const nextList = [...without, nextRow].sort((a, b) => a.name.localeCompare(b.name, "ko"));
			setDraftEvals(nextList);
			setFormBaseline(`${nextRow.JOIN_FLAG}|${nextRow.PLAY_FLAG}|${nextRow.HAPP_FLAG}|${nextRow.RESP_DESC}|1`);
			setMsg(`${nextRow.name} 평가를 담았습니다. 「참석자 명단 적용」을 눌러야 저장됩니다.`);
			const nextPending = filtered.find((m) => m.PNUM !== nextRow.PNUM && !evalMap.has(m.PNUM) && m.PNUM !== selectedMember.PNUM);
			const fallback = filtered.find((m) => m.PNUM !== selectedMember.PNUM && !evalMap.has(m.PNUM));
			const pick = nextPending || fallback;
			if (pick) applyMemberToForm(pick.PNUM);
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!canEdit || selectedPnum == null) return;
		const ev = evalMap.get(selectedPnum);
		if (!ev) {
			setMsg("저장된 참석 평가가 없습니다.");
			return;
		}
		if (!confirm(`${ev.name} 평가를 삭제할까요?`)) return;
		setSaving(true);
		setMsg(null);
		try {
			setDraftEvals(draftEvals.filter((e) => e.PNUM !== selectedPnum));
			setMsg(`${ev.name} 평가를 목록에서 뺐습니다. 「참석자 명단 적용」을 눌러야 반영됩니다.`);
			setJoinFlag("2");
			setPlayFlag("2");
			setHappFlag("2");
			setRemark("");
			setFormBaseline("2|2|2||1");
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleApply = async () => {
		if (!canEdit) {
			onClose();
			return;
		}
		let nextList = draftEvals;
		if (formDirty && selectedMember && evalOn && joinFlag && playFlag && happFlag) {
			const nextRow: AttendeeEval = {
				PNUM: selectedMember.PNUM,
				name: selectedMember.name,
				sex: selectedMember.sex,
				birthday: selectedMember.birthday,
				gradeLabel: selectedMember.gradeLabel,
				P_GRD: selectedMember.P_GRD,
				JOIN_FLAG: joinFlag,
				PLAY_FLAG: playFlag,
				HAPP_FLAG: happFlag,
				RESP_DESC: remark.trim(),
			};
			nextList = [...draftEvals.filter((e) => e.PNUM !== nextRow.PNUM), nextRow].sort((a, b) =>
				a.name.localeCompare(b.name, "ko"),
			);
			setDraftEvals(nextList);
		}
		setSaving(true);
		setMsg(null);
		try {
			if (dseq != null) {
				const keep = new Set(nextList.map((e) => e.PNUM));
				for (const ev of evals) {
					if (!keep.has(ev.PNUM)) {
						const res = await fetch("/api/f14031", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							credentials: "include",
							body: JSON.stringify({ action: "delete", DSEQ: dseq, PNUM: ev.PNUM }),
						});
						const json = await res.json();
						if (!res.ok || !json?.success) throw new Error(json?.error || "참석자 삭제에 실패했습니다.");
					}
				}
				for (const row of nextList) {
					await persistEval(row);
				}
			}
			onEvalsChange(nextList);
			onClose();
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "참석자 명단 적용 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	if (!open) return null;

	const filterBtn = (id: ListFilter, label: string) => (
		<button
			key={id}
			type="button"
			onClick={() => setListFilter(id)}
			className={`px-2.5 py-1 text-xs rounded border ${
				listFilter === id
					? "bg-blue-600 text-white border-blue-700"
					: "bg-white text-blue-900 border-blue-200 hover:bg-blue-50"
			}`}
		>
			{label}
		</button>
	);

	return (
		<div
			className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 print:hidden p-3"
			role="dialog"
			aria-modal="true"
			aria-labelledby="attendee-eval-title"
			onClick={(e) => {
				if (e.target === e.currentTarget) requestClose();
			}}
		>
			<div
				className="bg-white rounded-lg border border-blue-300 shadow-xl w-full max-w-6xl h-[min(88vh,820px)] flex flex-col overflow-hidden"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="shrink-0 px-4 py-3 border-b border-blue-200 bg-blue-50 flex items-center justify-between gap-3">
					<div>
						<h2 id="attendee-eval-title" className="text-lg font-semibold text-blue-900">
							수급자 전체 프로그램 평가
						</h2>
						<p className="text-xs text-blue-900/70 mt-0.5">
							왼쪽에서 수급자를 고른 뒤 평가를 저장하면 참석자로 등록됩니다. 저장 후에도 모달은 열린 채 다음 사람을 이어서 입력할 수 있습니다.
						</p>
					</div>
					<div className="flex items-center gap-3 shrink-0">
						<div className="text-sm text-blue-900 font-medium whitespace-nowrap">
							참석 {draftEvals.length}명
						</div>
						<button
							type="button"
							onClick={requestClose}
							className="px-3 py-1.5 text-sm font-medium text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-100"
							aria-label="닫기"
						>
							닫기
						</button>
					</div>
				</div>

				<div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
					<div className="min-h-0 flex flex-col border-r border-blue-200">
						<div className="shrink-0 p-3 space-y-2 border-b border-blue-100">
							<input
								value={q}
								onChange={(e) => setQ(e.target.value)}
								placeholder="수급자 이름 검색"
								className="w-full px-2.5 py-1.5 text-sm border border-blue-300 rounded"
							/>
							<div className="flex flex-wrap gap-1">
								{filterBtn("in", "입소")}
								{filterBtn("all", "전체")}
								{filterBtn("attend", `참석 (${draftEvals.length})`)}
								{filterBtn("pending", "미평가")}
							</div>
						</div>
						<div className="flex-1 min-h-0 overflow-auto">
							<table className="w-full text-xs border-collapse">
								<thead className="sticky top-0 bg-blue-50 z-10">
									<tr className="text-blue-900">
										<th className="px-2 py-2 text-left border-b border-blue-200">수급자</th>
										<th className="px-2 py-2 text-center border-b border-blue-200 w-10">성별</th>
										<th className="px-2 py-2 text-center border-b border-blue-200 w-24">생일</th>
										<th className="px-2 py-2 text-center border-b border-blue-200 w-16">요양등급</th>
										<th className="px-2 py-2 text-center border-b border-blue-200 w-10">참여</th>
										<th className="px-2 py-2 text-center border-b border-blue-200 w-10">수행</th>
										<th className="px-2 py-2 text-center border-b border-blue-200 w-10">만족</th>
									</tr>
								</thead>
								<tbody>
									{loadingMembers ? (
										<tr>
											<td colSpan={7} className="px-3 py-8 text-center text-blue-900/60">
												불러오는 중...
											</td>
										</tr>
									) : filtered.length === 0 ? (
										<tr>
											<td colSpan={7} className="px-3 py-8 text-center text-blue-900/60">
												해당하는 수급자가 없습니다.
											</td>
										</tr>
									) : (
										filtered.map((m) => {
											const ev = evalMap.get(m.PNUM);
											const selected = selectedPnum === m.PNUM;
											return (
												<tr
													key={m.PNUM}
													onClick={() => applyMemberToForm(m.PNUM)}
													className={`cursor-pointer border-b border-blue-50 hover:bg-blue-50 ${
														selected ? "bg-blue-100" : ev ? "bg-emerald-50/40" : ""
													}`}
												>
													<td className="px-2 py-1.5 font-medium text-blue-950">{m.name}</td>
													<td className="px-2 py-1.5 text-center">{m.sex}</td>
													<td className="px-2 py-1.5 text-center tabular-nums">{m.birthday || "-"}</td>
													<td className="px-2 py-1.5 text-center">{m.gradeLabel}</td>
													<td className="px-2 py-1.5 text-center"><LevelBadge flag={ev?.JOIN_FLAG ?? ""} /></td>
													<td className="px-2 py-1.5 text-center"><LevelBadge flag={ev?.PLAY_FLAG ?? ""} /></td>
													<td className="px-2 py-1.5 text-center"><LevelBadge flag={ev?.HAPP_FLAG ?? ""} /></td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>

					<div className="min-h-0 overflow-auto p-4 space-y-3">
						<div className="grid grid-cols-[5.5rem_1fr] gap-2 items-center text-sm">
							<div className="text-blue-900/80">프로그램</div>
							<div className="px-2 py-1.5 border border-blue-200 rounded bg-blue-50/50">{programName || "-"}</div>
							<div className="text-blue-900/80">수행일자</div>
							<div className="px-2 py-1.5 border border-blue-200 rounded bg-blue-50/50">{serviceDate || "-"}</div>
							<div className="text-blue-900/80">수급자</div>
							<div className="px-2 py-1.5 border border-blue-200 rounded bg-white font-medium">
								{selectedMember ? selectedMember.name : "왼쪽에서 선택"}
							</div>
						</div>

						<label className="flex items-center gap-2 text-sm text-blue-900">
							<input
								type="checkbox"
								checked={evalOn}
								disabled={!canEdit}
								onChange={(e) => setEvalOn(e.target.checked)}
							/>
							평가여부
						</label>

						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm text-blue-900 w-16 shrink-0">참여도</span>
								<LevelPicks value={joinFlag} onChange={setJoinFlag} disabled={!canEdit} />
							</div>
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm text-blue-900 w-16 shrink-0">수행도</span>
								<LevelPicks value={playFlag} onChange={setPlayFlag} disabled={!canEdit} />
							</div>
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm text-blue-900 w-16 shrink-0">만족도</span>
								<LevelPicks value={happFlag} onChange={setHappFlag} disabled={!canEdit} />
							</div>
						</div>

						<div>
							<div className="text-sm text-blue-900 mb-1">반응 및 특이사항</div>
							{samples.length > 0 ? (
								<select
									disabled={!canEdit}
									className="w-full mb-1.5 px-2 py-1.5 text-sm border border-blue-300 rounded"
									value=""
									onChange={(e) => {
										if (e.target.value) setRemark(e.target.value);
									}}
								>
									<option value="">샘플 문구 넣기</option>
									{samples.map((s, i) => (
										<option key={`${i}-${s.slice(0, 12)}`} value={s}>
											{s.length > 40 ? `${s.slice(0, 40)}…` : s}
										</option>
									))}
								</select>
							) : null}
							<textarea
								value={remark}
								disabled={!canEdit}
								onChange={(e) => setRemark(e.target.value.slice(0, 200))}
								rows={5}
								maxLength={200}
								className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded resize-y disabled:bg-blue-50/40"
								placeholder="반응·특이사항을 입력하세요 (최대 200자)"
							/>
							<div className="text-[11px] text-blue-900/55 text-right">{remark.length}/200</div>
						</div>

						{canEdit ? (
							<p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
								모달에서 저장한 평가는 「참석자 명단 적용」을 눌러야 반영됩니다. 적용하지 않고 닫으면 저장되지 않습니다.
							</p>
						) : null}

						{msg ? <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">{msg}</p> : null}

						<div className="flex flex-wrap gap-2 pt-1">
							<button
								type="button"
								disabled={!canEdit || saving}
								onClick={() => void handleSave()}
								className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 border border-green-700 rounded hover:bg-green-700 disabled:opacity-40"
							>
								{saving ? "처리 중…" : "저장"}
							</button>
							<button
								type="button"
								disabled={!canEdit || saving || selectedPnum == null || !evalMap.has(selectedPnum)}
								onClick={() => void handleDelete()}
								className="px-3 py-1.5 text-sm font-medium text-red-800 bg-red-50 border border-red-300 rounded hover:bg-red-100 disabled:opacity-40"
							>
								삭제
							</button>
							<button
								type="button"
								disabled={loadingMembers}
								onClick={() => void loadMembers()}
								className="px-3 py-1.5 text-sm font-medium text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-50"
							>
								재검색
							</button>
							<button
								type="button"
								onClick={requestClose}
								className="px-3 py-1.5 text-sm font-medium text-blue-900 bg-white border border-blue-400 rounded hover:bg-blue-50"
							>
								닫기
							</button>
						</div>
						<button
							type="button"
							disabled={saving}
							onClick={() => void handleApply()}
							className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-700 rounded hover:bg-blue-700 disabled:opacity-40"
						>
							참석자 명단 적용 ({draftEvals.length}명)
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
