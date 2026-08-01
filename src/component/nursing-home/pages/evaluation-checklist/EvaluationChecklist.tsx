"use client";

/**
 * @file 평가지침/체크리스트 — 화면 컴포넌트 (EvaluationChecklist.tsx)
 *
 * @description
 * 요양원 평가지침/체크리스트 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/evaluation-checklist
 *
 * @module component/nursing-home/pages/evaluation-checklist/EvaluationChecklist
 */
import React, { useMemo, useState } from "react";

type CategoryTab = "기관운영" | "수급자" | "직원";
/** 전체 병합 / 2칸 / 4칸 / 12칸 */
type MergeMode = "1" | "2" | "4" | "12";

interface PlanCell {
	checked: boolean;
	text: string;
}

interface ChecklistTask {
	id: string;
	category: CategoryTab;
	mergeMode: MergeMode;
	freqLabel: string;
	content: string;
	cells: PlanCell[];
}

const TABS: CategoryTab[] = ["기관운영", "수급자", "직원"];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const QUARTERS = [{ label: "1분기" }, { label: "2분기" }, { label: "3분기" }, { label: "4분기" }] as const;

const MERGE_OPTIONS: {
	value: MergeMode;
	label: string;
	freqLabel: string;
	count: number;
	colSpan: number;
}[] = [
	{ value: "1", label: "전체 병합", freqLabel: "연중", count: 1, colSpan: 12 },
	{ value: "2", label: "2칸", freqLabel: "반기", count: 2, colSpan: 6 },
	{ value: "4", label: "4칸", freqLabel: "분기", count: 4, colSpan: 3 },
	{ value: "12", label: "12칸", freqLabel: "매월", count: 12, colSpan: 1 },
];

const CHECKED_BG = "#FFF59D";
const HEADER_BG = "#F5E6C8";

function mergeMeta(mode: MergeMode) {
	return MERGE_OPTIONS.find((o) => o.value === mode)!;
}

/** 병합 방식별 기본 칸 텍스트 (선택 시 자동 입력, 이후 수정 가능) */
function defaultTextsForMerge(mode: MergeMode): string[] {
	switch (mode) {
		case "1":
			return ["연 1회"];
		case "2":
			return ["상반기", "하반기"];
		case "4":
			return ["1분기", "2분기", "3분기", "4분기"];
		case "12":
			return MONTHS.map((m) => `${m}월`);
		default:
			return [];
	}
}

function makeCells(count: number, texts: string[] = []): PlanCell[] {
	return Array.from({ length: count }, (_, i) => ({
		checked: false,
		text: texts[i] ?? "",
	}));
}

function createTask(
	id: string,
	category: CategoryTab,
	mergeMode: MergeMode,
	content: string,
	opts?: { freqLabel?: string; texts?: string[] }
): ChecklistTask {
	const meta = mergeMeta(mergeMode);
	const defaultTexts = opts?.texts ?? defaultTextsForMerge(mergeMode);
	return {
		id,
		category,
		mergeMode,
		freqLabel: opts?.freqLabel ?? meta.freqLabel,
		content,
		cells: makeCells(meta.count, defaultTexts),
	};
}

const INITIAL_TASKS: ChecklistTask[] = [
	createTask("op-y1", "기관운영", "1", "운영규정 마련 및 정비 (지표 1번)"),
	createTask("op-y2", "기관운영", "1", "급여제공지침 마련 및 정비 (지표 26번)"),
	createTask("op-y3", "기관운영", "1", "사업계획 및 예산 수립 (지표 2번)"),
	createTask("op-y4", "기관운영", "1", "사업계획 평가 (지표 2번)"),
	createTask("op-y5", "기관운영", "1", "프로그램 계획 수립 (지표 38번)"),
	createTask("op-h1", "기관운영", "2", "보호자 간담회 (지표 27번)"),
	createTask("op-h2", "기관운영", "2", "프로그램 의견수렴 (지표 38번)"),
	createTask("op-q1", "기관운영", "4", "실/내외 소독 (살균, 살충, 살서) (지표 15번)"),
	createTask("op-q2", "기관운영", "4", "의약품 관리 (지표 35번)"),
	createTask("op-m1", "기관운영", "12", "소화 및 경보 설비 점검 (지표 22번)"),
	createTask("op-m2", "기관운영", "12", "기관소식제공 (지표 27번)"),
	createTask("op-w1", "기관운영", "12", "자원봉사활동 (지표 3번)", {
		freqLabel: "매주",
		texts: Array.from({ length: 12 }, () => "일 1회"),
	}),
	createTask("op-w2", "기관운영", "12", "주방 및 집기 소독 (지표 14번)", { freqLabel: "매주" }),

	createTask("rc-y1", "수급자", "1", "욕구평가 (지표 30번)"),
	createTask("rc-y2", "수급자", "1", "위험도 평가 (지표 30번)"),
	createTask("rc-y3", "수급자", "1", "급여계획 작성 (지표 31번)"),
	createTask("rc-y4", "수급자", "1", "급여제공결과 평가 (지표 44번)"),
	createTask("rc-h1", "수급자", "2", "재난상황 대응훈련 (지표 23번)"),
	createTask("rc-q1", "수급자", "4", "수급자(보호자) 상담 (지표 25번)"),
	createTask("rc-q2", "수급자", "4", "사례관리 회의 (지표 43번)"),
	createTask("rc-m1", "수급자", "12", "급여제공기록지 제공 (지표 44번)"),
	createTask("rc-m2", "수급자", "12", "상태변화 기록 (지표 44번)"),

	createTask("st-y1", "직원", "1", "운영규정, 급여제공지침 교육 (지표 1번, 26번)"),
	createTask("st-y2", "직원", "1", "직원 건강검진 (지표 7번)", {
		texts: ["연 1회 (연 내에 모두 받을 수 있도록 하여야 함)"],
	}),
	createTask("st-h1", "직원", "2", "소화 및 경보설비 교육 (지표 22번)"),
	createTask("st-h2", "직원", "2", "재난상황 대응훈련 (지표 23번)"),
	createTask("st-q1", "직원", "4", "복지(포상) 등 제공 (지표 10번)"),
];

function buildFreqRowSpans(tasks: ChecklistTask[]): Map<string, number> {
	const spans = new Map<string, number>();
	let i = 0;
	while (i < tasks.length) {
		const label = tasks[i].freqLabel;
		let count = 1;
		while (i + count < tasks.length && tasks[i + count].freqLabel === label) count += 1;
		spans.set(tasks[i].id, count);
		i += count;
	}
	return spans;
}

function cloneInitialTasks(): ChecklistTask[] {
	return INITIAL_TASKS.map((t) => ({ ...t, cells: t.cells.map((c) => ({ ...c })) }));
}

function mapApiToTasks(
	structure: Array<{
		TASK_ID: string;
		CATEGORY: string;
		FREQ_LABEL: string;
		MERGE_MODE: string;
		CONTENT: string;
		CELL_TEXTS: string[];
	}>,
	checks: Array<{ TASK_ID: string; CELL_INDEX: number; CHECKED: boolean }>
): ChecklistTask[] {
	if (!structure.length) return cloneInitialTasks();

	const checkMap = new Map<string, boolean>();
	for (const c of checks) {
		checkMap.set(`${c.TASK_ID}:${c.CELL_INDEX}`, !!c.CHECKED);
	}

	return structure.map((s) => {
		const mergeMode = (["1", "2", "4", "12"].includes(s.MERGE_MODE) ? s.MERGE_MODE : "12") as MergeMode;
		const meta = mergeMeta(mergeMode);
		const texts =
			Array.isArray(s.CELL_TEXTS) && s.CELL_TEXTS.length > 0
				? s.CELL_TEXTS
				: defaultTextsForMerge(mergeMode);
		const category = (TABS.includes(s.CATEGORY as CategoryTab) ? s.CATEGORY : "기관운영") as CategoryTab;
		return {
			id: s.TASK_ID,
			category,
			mergeMode,
			freqLabel: s.FREQ_LABEL || meta.freqLabel,
			content: s.CONTENT || "",
			cells: Array.from({ length: meta.count }, (_, i) => ({
				text: String(texts[i] ?? ""),
				checked: checkMap.get(`${s.TASK_ID}:${i}`) ?? false,
			})),
		};
	});
}

function buildChecksPayload(tasks: ChecklistTask[]) {
	return tasks.flatMap((t) =>
		t.cells.map((c, cellIndex) => ({
			TASK_ID: t.id,
			CELL_INDEX: cellIndex,
			CHECKED: !!c.checked,
		}))
	);
}

export default function EvaluationChecklist() {
	const currentYear = useMemo(() => new Date().getFullYear(), []);
	const [year, setYear] = useState(currentYear);
	const [facilityName, setFacilityName] = useState("");
	const [activeTab, setActiveTab] = useState<CategoryTab>("기관운영");
	const [isEditMode, setIsEditMode] = useState(false);
	const [tasks, setTasks] = useState<ChecklistTask[]>(cloneInitialTasks);
	const [sessionAncd, setSessionAncd] = useState<string | number | null>(null);
	const [sessionEmpno, setSessionEmpno] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const tabTasks = useMemo(() => tasks.filter((t) => t.category === activeTab), [tasks, activeTab]);

	const loadData = React.useCallback(async (ancd: string | number, empno: string, y: number) => {
		setLoading(true);
		try {
			const qs = new URLSearchParams({
				ancd: String(ancd),
				year: String(y),
				empno: String(empno),
			});
			const res = await fetch(`/api/evaluation-checklists?${qs.toString()}`, {
				cache: "no-store",
				credentials: "include",
			});
			const data = await res.json();
			if (!res.ok || !data?.success) {
				throw new Error(data?.error || "조회에 실패했습니다.");
			}
			setTasks(mapApiToTasks(data.structure || [], data.checks || []));
		} catch (e) {
			console.error(e);
			alert(e instanceof Error ? e.message : "평가 체크리스트 조회 중 오류가 발생했습니다.");
			setTasks(cloneInitialTasks());
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/auth/user-info", { cache: "no-store", credentials: "include" });
				const json = await res.json().catch(() => ({}));
				if (cancelled) return;
				if (!res.ok || !json?.success) {
					alert(json?.error || "로그인 정보를 확인할 수 없습니다.");
					setLoading(false);
					return;
				}
				// API: { success, data: { ancd, empno, annm, ... } }
				const user = (json?.data || json?.user || {}) as {
					ancd?: string | number;
					empno?: string | number;
					uid?: string;
					annm?: string;
					ANNM?: string;
				};
				const ancd = user?.ancd;
				const empno = String(user?.empno ?? user?.uid ?? "").trim();
				const anNm = String(user?.annm ?? user?.ANNM ?? "").trim();
				if (anNm) setFacilityName(anNm);
				if (ancd == null || ancd === "" || !empno) {
					alert("로그인 기관/직원 정보를 확인할 수 없습니다.");
					setLoading(false);
					return;
				}
				setSessionAncd(ancd);
				setSessionEmpno(empno);
			} catch (e) {
				console.error(e);
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	React.useEffect(() => {
		if (sessionAncd == null || !sessionEmpno) return;
		loadData(sessionAncd, sessionEmpno, year);
	}, [year, sessionAncd, sessionEmpno, loadData]);

	const updateTask = (taskId: string, patch: Partial<ChecklistTask> | ((t: ChecklistTask) => ChecklistTask)) => {
		setTasks((prev) =>
			prev.map((t) => {
				if (t.id !== taskId) return t;
				return typeof patch === "function" ? patch(t) : { ...t, ...patch };
			})
		);
	};

	const changeMergeMode = (taskId: string, mergeMode: MergeMode) => {
		const meta = mergeMeta(mergeMode);
		const texts = defaultTextsForMerge(mergeMode);
		setTasks((prev) =>
			prev.map((t) => {
				if (t.id !== taskId) return t;
				const keepWeekly = t.freqLabel === "매주" && mergeMode === "12";
				return {
					...t,
					mergeMode,
					freqLabel: keepWeekly ? "매주" : meta.freqLabel,
					cells: texts.map((text, i) => ({
						checked: t.cells[i]?.checked ?? false,
						text,
					})),
				};
			})
		);
	};

	const updateCellText = (taskId: string, cellIndex: number, text: string) => {
		updateTask(taskId, (t) => ({
			...t,
			cells: t.cells.map((c, i) => (i === cellIndex ? { ...c, text } : c)),
		}));
	};

	const toggleCell = (taskId: string, cellIndex: number) => {
		if (isEditMode) return;
		updateTask(taskId, (t) => ({
			...t,
			cells: t.cells.map((c, i) => (i === cellIndex ? { ...c, checked: !c.checked } : c)),
		}));
	};

	const addRow = () => {
		const id = `row-${Date.now()}`;
		const newTask = createTask(id, activeTab, "12", "새 항목");
		setTasks((prev) => {
			const lastIdx = prev.reduce((acc, t, i) => (t.category === activeTab ? i : acc), -1);
			if (lastIdx < 0) return [...prev, newTask];
			const next = [...prev];
			next.splice(lastIdx + 1, 0, newTask);
			return next;
		});
	};

	const deleteRow = (taskId: string) => {
		if (tabTasks.length <= 1) {
			alert("최소 1개 행은 남겨야 합니다.");
			return;
		}
		if (!confirm("이 행을 삭제할까요?")) return;
		setTasks((prev) => prev.filter((t) => t.id !== taskId));
	};

	const handleSave = async () => {
		if (sessionAncd == null || !sessionEmpno) {
			alert("로그인 정보를 확인할 수 없습니다.");
			return;
		}
		setSaving(true);
		try {
			const res = await fetch("/api/evaluation-checklists", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					ancd: sessionAncd,
					year,
					empno: sessionEmpno,
					mode: "both",
					tasks: tasks.map((t, sortNo) => ({
						id: t.id,
						category: t.category,
						freqLabel: t.freqLabel,
						mergeMode: t.mergeMode,
						content: t.content,
						sortNo,
						cells: t.cells,
					})),
					checks: buildChecksPayload(tasks),
				}),
			});
			const data = await res.json();
			if (!res.ok || !data?.success) {
				throw new Error(data?.error || "저장에 실패했습니다.");
			}
			alert("저장되었습니다.");
		} catch (e) {
			console.error(e);
			alert(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handlePrint = () => {
		const printWindow = window.open("", "_blank");
		if (!printWindow) {
			alert("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
			return;
		}

		const renderPeriodCells = (task: ChecklistTask) => {
			const { colSpan } = mergeMeta(task.mergeMode);
			return task.cells
				.map((cell) => {
					const textHtml = cell.text ? `<div class="label">${escapeHtml(cell.text)}</div>` : "";
					return `<td colspan="${colSpan}" class="plan-cell${cell.checked ? " checked" : ""}">${textHtml}</td>`;
				})
				.join("");
		};

		const rowCount = Math.max(tasks.length, 1);
		// A4 297mm - 상하여백 7mm*2 - 제목 - 헤더
		const pageInnerMm = 297 - 14;
		const titleMm = 11;
		const theadMm = 16;
		const bodyMm = pageInnerMm - titleMm - theadMm;
		const rowMm = Number((bodyMm / rowCount).toFixed(3));
		const baseFontPt = rowCount <= 22 ? 10 : rowCount <= 28 ? 9 : 8;
		const labelFontPt = Math.max(7.5, baseFontPt - 0.5);

		const categoryBlocks = TABS.map((cat) => {
			const list = tasks.filter((t) => t.category === cat);
			if (list.length === 0) return "";
			const freqSpans = buildFreqRowSpans(list);
			return list
				.map((task, idx) => {
					const showCategory = idx === 0;
					const showFreq = freqSpans.has(task.id);
					const catCell = showCategory
						? `<td class="cat" rowspan="${list.length}">${escapeHtml(cat)}</td>`
						: "";
					const freqCell = showFreq
						? `<td class="freq" rowspan="${freqSpans.get(task.id)}">${escapeHtml(task.freqLabel)}</td>`
						: "";
					return `<tr style="height:${rowMm}mm">${catCell}${freqCell}<td class="content">${escapeHtml(task.content)}</td>${renderPeriodCells(task)}</tr>`;
				})
				.join("");
		}).join("");

		const monthHeaders = MONTHS.map((m) => `<th>${m}월</th>`).join("");
		const quarterHeaders = QUARTERS.map((q) => `<th colspan="3">${q.label}</th>`).join("");

		printWindow.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>평가 체크리스트 - ${escapeHtml(facilityName)} (${year})</title>
<style>
  @page {
    size: A4 portrait;
    margin: 7mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%;
    height: 100%;
  }
  body {
    font-family: "Malgun Gothic", "맑은 고딕", sans-serif;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .print-wrap {
    width: 100%;
    height: ${pageInnerMm}mm;
    display: flex;
    flex-direction: column;
  }
  .title {
    flex: 0 0 ${titleMm}mm;
    height: ${titleMm}mm;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 0.14em;
  }
  table {
    width: 100%;
    height: ${bodyMm + theadMm}mm;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: ${baseFontPt}pt;
  }
  thead {
    height: ${theadMm}mm;
  }
  th, td {
    border: 1px solid #111;
    text-align: center;
    vertical-align: middle;
    padding: 2px 3px;
    word-break: keep-all;
    line-height: 1.25;
  }
  thead th {
    background: ${HEADER_BG};
    font-weight: 700;
    font-size: ${baseFontPt}pt;
  }
  tbody tr {
    height: ${rowMm}mm;
  }
  td.cat, td.freq {
    font-weight: 700;
    font-size: ${baseFontPt + 0.5}pt;
  }
  td.content {
    text-align: left;
    padding-left: 6px;
    font-size: ${baseFontPt - 0.5}pt;
  }
  td.plan-cell {
    height: ${rowMm}mm;
  }
  td.plan-cell.checked {
    background: ${CHECKED_BG};
  }
  .label {
    font-size: ${labelFontPt}pt;
    white-space: pre-wrap;
    line-height: 1.2;
  }
  @media print {
    html, body {
      width: 210mm;
      height: 297mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-wrap {
      height: ${pageInnerMm}mm;
      overflow: hidden;
      page-break-after: avoid;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table, tr, td, th {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }
</style>
</head>
<body>
  <div class="print-wrap">
    <div class="title">${escapeHtml(facilityName)}</div>
    <table>
      <colgroup>
        <col style="width:5.5%" />
        <col style="width:5.5%" />
        <col style="width:23%" />
        ${MONTHS.map(() => `<col style="width:5.5%" />`).join("")}
      </colgroup>
      <thead>
        <tr style="height:${(theadMm / 3).toFixed(2)}mm">
          <th colspan="2" rowspan="3">구분</th>
          <th rowspan="3">사업내용</th>
          <th colspan="12">추진계획</th>
        </tr>
        <tr style="height:${(theadMm / 3).toFixed(2)}mm">${quarterHeaders}</tr>
        <tr style="height:${(theadMm / 3).toFixed(2)}mm">${monthHeaders}</tr>
      </thead>
      <tbody>
        ${categoryBlocks}
      </tbody>
    </table>
  </div>
</body>
</html>`);
		printWindow.document.close();
		printWindow.focus();
		setTimeout(() => {
			printWindow.print();
		}, 300);
	};

	const planColSpan = 12;

	return (
		<div className="relative min-h-screen bg-white text-black">
			{(loading || saving) && (
				<div
					className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40"
					aria-busy="true"
					aria-live="polite"
				>
					<div className="flex flex-col items-center gap-3 rounded-lg border border-blue-200 bg-white px-8 py-6 shadow-lg">
						<div
							className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
							role="status"
						/>
						<div className="text-sm font-medium text-blue-900">
							{saving ? "저장 중..." : "데이터를 불러오는 중..."}
						</div>
					</div>
				</div>
			)}

			<div className="p-4 space-y-4">
				<div className="flex flex-col items-stretch gap-3">
					<div className="flex-1 rounded border border-blue-300 bg-blue-100 px-6 py-4 text-center text-2xl font-semibold text-blue-900">
						평가 체크리스트
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-2 rounded border border-blue-300 bg-white px-3 py-3">
							<span className="rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900">
								연도
							</span>
							<input
								type="number"
								min={2000}
								max={2100}
								value={year}
								onChange={(e) => setYear(Number(e.target.value) || currentYear)}
								className="w-24 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
							/>
						</div>

						<div className="flex items-center gap-2 rounded border border-blue-300 bg-white px-3 py-3">
							<span className="rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900">
								시설명
							</span>
							<input
								value={facilityName}
								onChange={(e) => setFacilityName(e.target.value)}
								className="w-40 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
							/>
						</div>

						<div className="flex items-center gap-2 text-xs text-blue-900/70">
							<span className="inline-block h-4 w-6 rounded border border-amber-400" style={{ background: CHECKED_BG }} />
							<span>체크됨</span>
							<span className="ml-2">
								{isEditMode
									? "수정모드 · 병합/사업내용/칸 텍스트 · 행 추가·삭제"
									: "칸 클릭=체크 · 구조 변경은 [평가 체크리스트 수정]"}
							</span>
						</div>

						<div className="ml-auto flex items-center gap-2">
							<button
								type="button"
								onClick={handleSave}
								disabled={saving || loading}
								className="w-24 rounded border border-blue-400 bg-blue-200 px-6 py-3 text-base font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
							>
								{saving ? "저장중" : "저장"}
							</button>
							<button
								type="button"
								onClick={handlePrint}
								disabled={loading}
								className="w-24 rounded border border-blue-400 bg-blue-200 px-6 py-3 text-base font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
							>
								출력
							</button>
							<button
								type="button"
								onClick={() => setIsEditMode((v) => !v)}
								disabled={loading}
								className={`rounded border px-4 py-3 text-base font-medium hover:opacity-90 disabled:opacity-50 ${
									isEditMode
										? "border-amber-500 bg-amber-400 text-amber-950"
										: "border-blue-400 bg-blue-200 text-blue-900 hover:bg-blue-300"
								}`}
							>
								{isEditMode ? "수정 완료" : "평가 체크리스트 수정"}
							</button>
						</div>
					</div>
				</div>

				<div
					className={`rounded-lg border bg-white overflow-hidden ${
						isEditMode ? "border-amber-400 ring-2 ring-amber-200" : "border-blue-300"
					}`}
				>
					<div
						className={`flex flex-wrap items-center gap-1 border-b p-2 ${
							isEditMode ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
						}`}
					>
						{TABS.map((tab) => (
							<button
								key={tab}
								type="button"
								onClick={() => setActiveTab(tab)}
								className={`rounded border px-5 py-2 text-sm font-semibold transition-colors ${
									activeTab === tab
										? isEditMode
											? "border-amber-500 bg-amber-500 text-white"
											: "border-blue-500 bg-blue-500 text-white"
										: "border-blue-300 bg-white text-blue-900 hover:bg-blue-100"
								}`}
							>
								{tab}
							</button>
						))}
						{isEditMode && (
							<button
								type="button"
								onClick={addRow}
								className="ml-2 rounded border border-amber-500 bg-amber-200 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-300"
							>
								행 추가
							</button>
						)}
						<div className="ml-auto pr-2 text-sm font-medium text-blue-900">
							{facilityName || "평가 체크리스트"}
							{isEditMode ? " · 수정모드" : ""}
						</div>
					</div>

					<div className="overflow-auto p-3">
						<table className="w-full min-w-[1280px] table-fixed border-collapse text-sm">
							<colgroup>
								<col style={{ width: 72 }} />
								<col style={{ width: 100 }} />
								<col style={{ width: 260 }} />
								{MONTHS.map((m) => (
									<col key={m} />
								))}
								{isEditMode && <col style={{ width: 64 }} />}
							</colgroup>
							<thead>
								<tr>
									<th
										colSpan={2}
										rowSpan={3}
										className="border border-blue-300 px-2 py-2 font-semibold text-blue-900"
										style={{ background: HEADER_BG }}
									>
										구분
									</th>
									<th
										rowSpan={3}
										className="border border-blue-300 px-2 py-2 font-semibold text-blue-900"
										style={{ background: HEADER_BG }}
									>
										사업내용
									</th>
									<th
										colSpan={planColSpan}
										className="border border-blue-300 px-2 py-2 font-semibold text-blue-900"
										style={{ background: HEADER_BG }}
									>
										추진계획
									</th>
									{isEditMode && (
										<th
											rowSpan={3}
											className="border border-blue-300 px-2 py-2 text-xs font-semibold text-blue-900"
											style={{ background: HEADER_BG }}
										>
											삭제
										</th>
									)}
								</tr>
								<tr>
									{QUARTERS.map((q) => (
										<th
											key={q.label}
											colSpan={3}
											className="border border-blue-300 px-1 py-1.5 text-xs font-semibold text-blue-900"
											style={{ background: HEADER_BG }}
										>
											{q.label}
										</th>
									))}
								</tr>
								<tr>
									{MONTHS.map((m) => (
										<th
											key={m}
											className="border border-blue-300 px-1 py-1.5 text-xs font-semibold text-blue-900"
											style={{ background: HEADER_BG }}
										>
											{m}월
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{tabTasks.length === 0 ? (
									<tr>
										<td
											colSpan={isEditMode ? 16 : 15}
											className="border border-blue-300 px-3 py-10 text-center text-blue-900/60"
										>
											항목이 없습니다. 수정모드에서 행을 추가하세요.
										</td>
									</tr>
								) : (
									tabTasks.map((task, idx) => {
										const showCategory = idx === 0;
										const { colSpan } = mergeMeta(task.mergeMode);
										const categoryRowSpan = Math.max(tabTasks.length, 1);

										return (
											<tr key={task.id}>
												{showCategory && (
													<td
														rowSpan={categoryRowSpan}
														className="border border-blue-300 px-2 py-2 text-center font-semibold text-blue-900 align-middle"
													>
														{activeTab}
													</td>
												)}
												<td className="border border-blue-300 px-1 py-1 align-middle">
													{isEditMode ? (
														<select
															value={task.mergeMode}
															onChange={(e) => changeMergeMode(task.id, e.target.value as MergeMode)}
															className="w-full rounded border border-blue-300 bg-white px-1 py-1.5 text-[11px] text-blue-900"
															title="병합 방식"
														>
															{MERGE_OPTIONS.map((o) => (
																<option key={o.value} value={o.value}>
																	{o.label}
																</option>
															))}
														</select>
													) : (
														<div className="px-1 py-2 text-center text-xs font-medium text-blue-900">
															{task.freqLabel}
														</div>
													)}
												</td>
												<td className="border border-blue-300 px-2 py-1 text-left align-middle overflow-hidden">
													{isEditMode ? (
														<input
															value={task.content}
															onChange={(e) => updateTask(task.id, { content: e.target.value })}
															className="w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
														/>
													) : (
														<span className="block truncate text-sm text-blue-900" title={task.content}>
															{task.content}
														</span>
													)}
												</td>
												{task.cells.map((cell, cellIndex) => (
													<td
														key={`${task.id}-${cellIndex}`}
														colSpan={colSpan}
														onClick={() => toggleCell(task.id, cellIndex)}
														title={isEditMode ? "텍스트 수정" : "클릭: 체크"}
														className={`border border-blue-300 px-1 py-1 text-center align-middle transition-colors ${
															isEditMode ? "" : "cursor-pointer select-none hover:brightness-95"
														}`}
														style={{
															background: cell.checked ? CHECKED_BG : "#FFFFFF",
															height: 52,
														}}
													>
														{isEditMode ? (
															<input
																value={cell.text}
																onChange={(e) => updateCellText(task.id, cellIndex, e.target.value)}
																onClick={(e) => e.stopPropagation()}
																placeholder="텍스트"
																className="w-full min-w-0 rounded border border-blue-200 bg-white/90 px-1 py-1 text-center text-[11px] text-blue-900 focus:border-blue-500 focus:outline-none"
															/>
														) : cell.text ? (
															<div className="whitespace-pre-wrap break-keep text-[11px] leading-tight font-medium text-blue-900/90">
																{cell.text}
															</div>
														) : null}
													</td>
												))}
												{isEditMode && (
													<td className="border border-blue-300 px-1 py-1 text-center align-middle">
														<button
															type="button"
															onClick={() => deleteRow(task.id)}
															className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
														>
															삭제
														</button>
													</td>
												)}
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
