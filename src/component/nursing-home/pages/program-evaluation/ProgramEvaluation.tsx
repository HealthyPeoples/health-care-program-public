"use client";

/**
 * @file 프로그램평가 — 화면 컴포넌트 (ProgramEvaluation.tsx)
 *
 * @description
 * 총평/특이사항 샘플(F14039) 등록 화면입니다. 수급자 목록 없이 프로그램 단위로 관리합니다.
 *
 * @module component/nursing-home/pages/program-evaluation/ProgramEvaluation
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { openPrintWindow } from '../../utils/v30030rPrint';

type FormMode = 'idle' | 'create' | 'edit';
type SampleFlag = '1' | '2';

type ProgramOption = {
	pgseq: number;
	name: string;
};

type SampleRow = {
	PGSEQ: number;
	SMP_FLAG: SampleFlag;
	SMP_SEQ: number;
	SMP_DSC: string;
};

const PAGE_SIZE = 5;

const FLAG_LABEL: Record<SampleFlag, string> = {
	'1': '총평',
	'2': '특이사항',
};

function flagLabel(flag: string) {
	return flag === '1' || flag === '2' ? FLAG_LABEL[flag] : flag;
}

function esc(v: unknown) {
	return String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export default function ProgramEvaluation() {
	const [programs, setPrograms] = useState<ProgramOption[]>([]);
	const [loadingPrograms, setLoadingPrograms] = useState(false);
	const [filterPgseq, setFilterPgseq] = useState('');
	const [filterFlag, setFilterFlag] = useState<SampleFlag>('1');

	const [appliedPgseq, setAppliedPgseq] = useState<number | null>(null);
	const [appliedFlag, setAppliedFlag] = useState<SampleFlag>('1');
	const [rows, setRows] = useState<SampleRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [searched, setSearched] = useState(false);

	const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
	const [formMode, setFormMode] = useState<FormMode>('idle');
	const [content, setContent] = useState('');
	const [seqInput, setSeqInput] = useState('');
	const [page, setPage] = useState(1);
	const [saving, setSaving] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<SampleRow | 'all' | null>(null);
	const [flagCounts, setFlagCounts] = useState({ '1': 0, '2': 0 });

	const selectedProgram = useMemo(
		() => programs.find((p) => String(p.pgseq) === filterPgseq) ?? null,
		[programs, filterPgseq]
	);
	const appliedProgram = useMemo(
		() => programs.find((p) => p.pgseq === appliedPgseq) ?? null,
		[programs, appliedPgseq]
	);

	const selectedRow = useMemo(
		() => rows.find((r) => r.SMP_SEQ === selectedSeq) ?? null,
		[rows, selectedSeq]
	);

	const canEditFields = formMode === 'create' || formMode === 'edit';

	const sortedRows = useMemo(
		() => [...rows].sort((a, b) => a.SMP_SEQ - b.SMP_SEQ),
		[rows]
	);
	const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const pagedRows = useMemo(() => {
		const start = (currentPage - 1) * PAGE_SIZE;
		return sortedRows.slice(start, start + PAGE_SIZE);
	}, [sortedRows, currentPage]);

	const nextSeqHint = useMemo(() => {
		const max = rows.reduce((m, r) => Math.max(m, Number(r.SMP_SEQ) || 0), 0);
		return String(max + 1);
	}, [rows]);

	const refreshFlagCounts = useCallback(async (pgseq: number) => {
		try {
			const [summaryRes, noteRes] = await Promise.all([
				fetch(`/api/f14039?pgseq=${pgseq}&smp_flag=1`, { cache: 'no-store' }),
				fetch(`/api/f14039?pgseq=${pgseq}&smp_flag=2`, { cache: 'no-store' }),
			]);
			const [summaryJson, noteJson] = await Promise.all([summaryRes.json(), noteRes.json()]);
			setFlagCounts({
				'1': Number(summaryJson?.count ?? summaryJson?.data?.length) || 0,
				'2': Number(noteJson?.count ?? noteJson?.data?.length) || 0,
			});
		} catch {
			setFlagCounts({ '1': 0, '2': 0 });
		}
	}, []);

	useEffect(() => {
		let alive = true;
		(async () => {
			setLoadingPrograms(true);
			try {
				const res = await fetch('/api/f14040', { cache: 'no-store' });
				const json = await res.json();
				if (!res.ok || !json?.success) throw new Error(json?.error || '프로그램 목록 조회에 실패했습니다.');
				const list: ProgramOption[] = (Array.isArray(json.data) ? json.data : [])
					.filter((r: { DEL?: string }) => String(r.DEL ?? '').trim().toUpperCase() !== 'D')
					.map((r: { PGSEQ?: number; PGNM?: string }) => ({
						pgseq: Number(r.PGSEQ ?? 0),
						name: String(r.PGNM ?? '').trim() || '(프로그램명 없음)',
					}))
					.filter((p: ProgramOption) => Number.isFinite(p.pgseq) && p.pgseq > 0);
				if (!alive) return;
				setPrograms(list);
			} catch (e) {
				console.error(e);
				if (alive) {
					setPrograms([]);
					alert(e instanceof Error ? e.message : '프로그램 목록 조회 중 오류가 발생했습니다.');
				}
			} finally {
				if (alive) setLoadingPrograms(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

	const resetDetail = useCallback(() => {
		setSelectedSeq(null);
		setFormMode('idle');
		setContent('');
		setSeqInput('');
	}, []);

	const fetchSamples = useCallback(async (pgseq: number, flag: SampleFlag, preferSeq?: number | null) => {
		setLoading(true);
		try {
			const qs = new URLSearchParams({
				pgseq: String(pgseq),
				smp_flag: flag,
			});
			const res = await fetch(`/api/f14039?${qs.toString()}`, { cache: 'no-store' });
			const json = await res.json();
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || '샘플 조회에 실패했습니다.');
			}
			const list: SampleRow[] = (Array.isArray(json.data) ? json.data : []).map((r: SampleRow) => ({
				PGSEQ: Number(r.PGSEQ),
				SMP_FLAG: (r.SMP_FLAG === '2' ? '2' : '1') as SampleFlag,
				SMP_SEQ: Number(r.SMP_SEQ),
				SMP_DSC: String(r.SMP_DSC ?? ''),
			}));
			const ordered = [...list].sort((a, b) => a.SMP_SEQ - b.SMP_SEQ);
			setRows(ordered);
			setAppliedPgseq(pgseq);
			setAppliedFlag(flag);
			setSearched(true);

			if (ordered.length === 0) {
				setPage(1);
				resetDetail();
				return;
			}
			const pick =
				preferSeq != null && ordered.some((r) => r.SMP_SEQ === preferSeq)
					? preferSeq
					: ordered[0].SMP_SEQ;
			const row = ordered.find((r) => r.SMP_SEQ === pick) || ordered[0];
			const idx = ordered.findIndex((r) => r.SMP_SEQ === row.SMP_SEQ);
			setPage(Math.floor(Math.max(0, idx) / PAGE_SIZE) + 1);
			setSelectedSeq(row.SMP_SEQ);
			setFormMode('idle');
			setContent(row.SMP_DSC);
			setSeqInput(String(row.SMP_SEQ));
		} catch (e) {
			console.error(e);
			setRows([]);
			resetDetail();
			alert(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.');
		} finally {
			setLoading(false);
		}
	}, [resetDetail]);

	useEffect(() => {
		if (!filterPgseq) {
			setAppliedPgseq(null);
			setAppliedFlag(filterFlag);
			setRows([]);
			setSearched(false);
			setPage(1);
			setFlagCounts({ '1': 0, '2': 0 });
			resetDetail();
			return;
		}
		void fetchSamples(Number(filterPgseq), filterFlag);
		void refreshFlagCounts(Number(filterPgseq));
	}, [filterPgseq, filterFlag, fetchSamples, resetDetail, refreshFlagCounts]);

	const handleSearch = () => {
		if (!filterPgseq) {
			alert('프로그램 명을 선택해주세요.');
			return;
		}
		void fetchSamples(Number(filterPgseq), filterFlag);
	};

	const handleClose = () => {
		if (formMode !== 'idle' && !confirm('작성 중인 내용이 저장되지 않습니다. 닫을까요?')) {
			return;
		}
		setFilterPgseq('');
		setFilterFlag('1');
		setAppliedPgseq(null);
		setAppliedFlag('1');
		setRows([]);
		setSearched(false);
		resetDetail();
	};

	const handleSelectRow = (row: SampleRow) => {
		if (formMode !== 'idle') return;
		setSelectedSeq(row.SMP_SEQ);
		setContent(row.SMP_DSC);
	};

	const handleAdd = () => {
		if (!searched || appliedPgseq == null) {
			alert('먼저 프로그램과 구분을 선택해주세요.');
			return;
		}
		setSelectedSeq(null);
		setFormMode('create');
		setContent('');
		setSeqInput(nextSeqHint);
	};

	const handleEdit = (row?: SampleRow) => {
		if (!searched || appliedPgseq == null) {
			alert('먼저 프로그램과 구분을 선택해주세요.');
			return;
		}
		const target = row ?? selectedRow;
		if (!target) {
			alert('수정할 샘플을 목록에서 선택해주세요.');
			return;
		}
		setSelectedSeq(target.SMP_SEQ);
		setFormMode('edit');
		setContent(target.SMP_DSC);
		setSeqInput(String(target.SMP_SEQ));
	};

	const handleCancelEdit = () => {
		if (saving) return;
		if (selectedRow) {
			setContent(selectedRow.SMP_DSC);
			setSeqInput(String(selectedRow.SMP_SEQ));
			setFormMode('idle');
			return;
		}
		setFormMode('idle');
		setContent('');
		setSeqInput('');
	};

	const handleSave = async () => {
		if (appliedPgseq == null) {
			alert('먼저 검색해주세요.');
			return;
		}
		const text = content.trim();
		if (!text) {
			alert('총평 / 특이사항 내용을 입력해주세요.');
			return;
		}
		const seq = parseInt(seqInput.trim(), 10);
		if (!Number.isFinite(seq) || seq <= 0) {
			alert('연번(SMP_SEQ)은 1 이상의 숫자로 입력해주세요.');
			return;
		}

		const isCreate = formMode === 'create';
		const duplicated = rows.some((r) => {
			if (Number(r.SMP_SEQ) !== seq) return false;
			if (isCreate) return true;
			return Number(r.SMP_SEQ) !== Number(selectedSeq);
		});
		if (duplicated) {
			alert(`해당 프로그램의 ${flagLabel(appliedFlag)}에 이미 ${seq}번 연번이 있습니다.`);
			return;
		}

		setSaving(true);
		try {
			const res = await fetch('/api/f14039', {
				method: isCreate ? 'POST' : 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					PGSEQ: appliedPgseq,
					SMP_FLAG: appliedFlag,
					SMP_DSC: text,
					SMP_SEQ: seq,
					...(isCreate ? {} : { ORIG_SMP_SEQ: selectedSeq }),
				}),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || '저장에 실패했습니다.');
			}
			alert(isCreate ? '추가되었습니다.' : '수정되었습니다.');
			const prefer = Number(json?.data?.SMP_SEQ) || seq;
			setFormMode('idle');
			await fetchSamples(appliedPgseq, appliedFlag, prefer);
			if (appliedPgseq != null) await refreshFlagCounts(appliedPgseq);
		} catch (e) {
			console.error(e);
			alert(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.');
		} finally {
			setSaving(false);
		}
	};

	const openDeleteOne = (row: SampleRow) => {
		if (appliedPgseq == null) {
			alert('먼저 프로그램과 구분을 선택해주세요.');
			return;
		}
		if (formMode !== 'idle') {
			alert('추가/수정 중에는 삭제할 수 없습니다. 취소 후 다시 시도해주세요.');
			return;
		}
		setDeleteTarget(row);
	};

	const openDeleteAll = () => {
		if (appliedPgseq == null) {
			alert('먼저 프로그램과 구분을 선택해주세요.');
			return;
		}
		if (rows.length === 0) {
			alert('삭제할 샘플이 없습니다.');
			return;
		}
		if (formMode !== 'idle') {
			alert('추가/수정 중에는 삭제할 수 없습니다. 취소 후 다시 시도해주세요.');
			return;
		}
		setDeleteTarget('all');
	};

	const closeDeleteModal = () => {
		if (saving) return;
		setDeleteTarget(null);
	};

	const confirmDelete = async () => {
		if (appliedPgseq == null || deleteTarget == null) return;

		setSaving(true);
		try {
			const qs = new URLSearchParams({
				pgseq: String(appliedPgseq),
				smp_flag: appliedFlag,
			});
			if (deleteTarget === 'all') {
				qs.set('all', '1');
			} else {
				qs.set('smp_seq', String(deleteTarget.SMP_SEQ));
			}
			const res = await fetch(`/api/f14039?${qs.toString()}`, { method: 'DELETE' });
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || '삭제에 실패했습니다.');
			}
			setDeleteTarget(null);
			await fetchSamples(appliedPgseq, appliedFlag);
			if (appliedPgseq != null) await refreshFlagCounts(appliedPgseq);
		} catch (e) {
			console.error(e);
			alert(e instanceof Error ? e.message : '삭제 중 오류가 발생했습니다.');
		} finally {
			setSaving(false);
		}
	};

	const handlePrint = async () => {
		if (!searched || appliedPgseq == null) {
			alert('먼저 프로그램을 선택해주세요.');
			return;
		}

		const mapRows = (list: unknown[]): SampleRow[] =>
			(Array.isArray(list) ? list : []).map((r) => {
				const row = r as SampleRow;
				return {
					PGSEQ: Number(row.PGSEQ),
					SMP_FLAG: (row.SMP_FLAG === '2' ? '2' : '1') as SampleFlag,
					SMP_SEQ: Number(row.SMP_SEQ),
					SMP_DSC: String(row.SMP_DSC ?? ''),
				};
			});

		let printRows: SampleRow[] = [];
		try {
			const [summaryRes, noteRes] = await Promise.all([
				fetch(`/api/f14039?pgseq=${appliedPgseq}&smp_flag=1`, { cache: 'no-store' }),
				fetch(`/api/f14039?pgseq=${appliedPgseq}&smp_flag=2`, { cache: 'no-store' }),
			]);
			const [summaryJson, noteJson] = await Promise.all([summaryRes.json(), noteRes.json()]);
			const summaries = mapRows(summaryJson?.data).sort((a, b) => a.SMP_SEQ - b.SMP_SEQ);
			const notes = mapRows(noteJson?.data).sort((a, b) => a.SMP_SEQ - b.SMP_SEQ);
			printRows = [...summaries, ...notes];
		} catch (e) {
			console.error(e);
			alert('출력 데이터를 불러오지 못했습니다.');
			return;
		}

		const name = appliedProgram?.name || '';
		const ROWS_PER_PAGE = 12;
		const pages = printRows.length === 0 ? [[]] : [];
		if (printRows.length > 0) {
			for (let i = 0; i < printRows.length; i += ROWS_PER_PAGE) {
				pages.push(printRows.slice(i, i + ROWS_PER_PAGE));
			}
		}

		const pageHtml = pages
			.map((pageRows, pageIdx) => {
				const body =
					pageRows.length === 0
						? `<tr><td class="gu"></td><td class="dsc">등록된 샘플이 없습니다.</td></tr>`
						: pageRows
								.map(
									(r) =>
										`<tr><td class="gu">${esc(flagLabel(r.SMP_FLAG))}</td><td class="dsc">${esc(r.SMP_DSC)}</td></tr>`
								)
								.join('');
				return `
  <section class="sheet">
    <h1>평가 및 특이사항 입력 샘플</h1>
    <div class="prog"><b>프로그램명: ${esc(name)}</b></div>
    <table>
      <thead>
        <tr><th class="gu">구분</th><th class="dsc">내용</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    <div class="page-no">페이지: ${pageIdx + 1}</div>
  </section>`;
			})
			.join('');

		openPrintWindow(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>평가 및 특이사항 입력 샘플</title>
<style>
  @page { size: A4 portrait; margin: 16mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "Malgun Gothic", Gulim, sans-serif; color: #111; }
  .sheet {
    position: relative;
    min-height: 257mm;
    page-break-after: always;
  }
  .sheet:last-child { page-break-after: auto; }
  h1 {
    margin: 0 0 18px;
    font-size: 20px;
    font-weight: 700;
    text-align: center;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .prog { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td {
    border-top: 1px solid #111;
    border-bottom: 1px solid #111;
    border-left: none;
    border-right: none;
    padding: 8px 6px;
    vertical-align: top;
    text-align: left;
    font-weight: 400;
  }
  th { font-weight: 700; }
  th.gu, td.gu { width: 88px; white-space: nowrap; }
  td.dsc { white-space: pre-wrap; word-break: break-word; }
  .page-no {
    position: absolute;
    right: 0;
    bottom: 0;
    font-size: 13px;
  }
</style>
</head>
<body>
${pageHtml}
</body>
</html>`);
	};

	const actionDisabled = saving || loading || !searched;

	return (
		<div className="flex flex-col min-h-screen w-full max-w-full min-w-0 overflow-x-hidden text-black bg-white">
			<div className="flex flex-col xl:h-[calc(100vh-56px)] min-h-0">
				<header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-blue-200 bg-blue-50">
					<div className="flex flex-wrap items-center gap-3 min-w-0">
						<h1 className="text-base font-semibold text-blue-900 whitespace-nowrap">
							총평/특이사항 Sample 등록
						</h1>
						<label className="flex items-center gap-2 min-w-0">
							<span className="text-sm font-medium text-blue-900 whitespace-nowrap">프로그램 명</span>
							<select
								value={filterPgseq}
								onChange={(e) => setFilterPgseq(e.target.value)}
								disabled={loadingPrograms}
								className="min-w-[12rem] max-w-[20rem] px-2 py-1.5 text-sm bg-white border border-blue-300 rounded disabled:bg-gray-100"
							>
								<option value="">{loadingPrograms ? '불러오는 중...' : '프로그램 선택'}</option>
								{programs.map((p) => (
									<option key={p.pgseq} value={String(p.pgseq)}>
										{p.name}
									</option>
								))}
							</select>
						</label>
						<fieldset className="flex items-center gap-3">
							<legend className="sr-only">Sample구분</legend>
							<span className="text-sm font-medium text-blue-900">Sample구분</span>
							<label className="inline-flex items-center gap-1.5 text-sm text-blue-900">
								<input
									type="radio"
									name="smp-flag"
									checked={filterFlag === '1'}
									onChange={() => setFilterFlag('1')}
								/>
								총평{filterPgseq ? ` (${flagCounts['1']}건)` : ''}
							</label>
							<label className="inline-flex items-center gap-1.5 text-sm text-blue-900">
								<input
									type="radio"
									name="smp-flag"
									checked={filterFlag === '2'}
									onChange={() => setFilterFlag('2')}
								/>
								특이사항{filterPgseq ? ` (${flagCounts['2']}건)` : ''}
							</label>
							<button
								type="button"
								onClick={handleAdd}
								disabled={actionDisabled || canEditFields}
								className="px-3 py-1.5 text-sm font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
							>
								프로그램 샘플 추가
							</button>
						</fieldset>
					</div>
					<div className="flex items-center gap-2 ml-auto">
						<button
							type="button"
							onClick={openDeleteAll}
							disabled={actionDisabled || rows.length === 0 || canEditFields}
							className="min-w-[5.5rem] px-3 py-1.5 text-sm font-medium border border-red-300 rounded bg-red-50 hover:bg-red-100 text-red-800 disabled:opacity-40"
						>
							전체 삭제
						</button>
						<button
							type="button"
							onClick={handlePrint}
							disabled={!searched || loading}
							className="min-w-[5.5rem] px-3 py-1.5 text-sm font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
						>
							출력
						</button>
					</div>
				</header>

				<div className="flex-1 min-h-0 overflow-auto p-4">
					<div className="flex flex-col h-full min-h-[32rem] border border-blue-200 rounded-lg overflow-hidden bg-white">
						<div className="flex items-center justify-between px-3 py-2 border-b border-blue-200 bg-blue-50">
							<h2 className="text-sm font-semibold text-blue-900">Sample내용</h2>
							{searched && (
								<p className="text-xs text-blue-900/70">
									{appliedProgram?.name || selectedProgram?.name || '-'} · {flagLabel(appliedFlag)} · {rows.length}건
								</p>
							)}
						</div>

						<div className="flex-1 min-h-[14rem] overflow-auto">
							<table className="w-full text-sm">
								<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
									<tr>
										<th className="w-16 px-3 py-2 font-semibold text-center text-blue-900 border-r border-blue-200">
											연번
										</th>
										<th className="px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">Sample내용</th>
										<th className="w-36 px-3 py-2 font-semibold text-center text-blue-900">관리</th>
									</tr>
								</thead>
								<tbody>
									{!searched ? (
										<tr>
											<td colSpan={3} className="px-3 py-10 text-center text-blue-900/60">
												프로그램과 구분을 선택해 주세요.
											</td>
										</tr>
									) : loading ? (
										<tr>
											<td colSpan={3} className="px-3 py-10 text-center text-blue-900/60">
												로딩 중...
											</td>
										</tr>
									) : rows.length === 0 ? (
										<tr>
											<td colSpan={3} className="px-3 py-10 text-center text-blue-900/60">
												등록된 샘플이 없습니다. 추가를 눌러 등록하세요.
											</td>
										</tr>
									) : (
										pagedRows.map((row) => (
											<tr
												key={`${row.PGSEQ}-${row.SMP_FLAG}-${row.SMP_SEQ}`}
												onClick={() => handleSelectRow(row)}
												className={`border-b border-blue-50 hover:bg-blue-50 ${
													selectedSeq === row.SMP_SEQ ? 'bg-blue-100' : ''
												}`}
											>
												<td className="px-3 py-2.5 text-center border-r border-blue-100 text-blue-900">
													{row.SMP_SEQ}
												</td>
												<td className="px-3 py-2.5 text-blue-900 break-words whitespace-pre-wrap border-r border-blue-100">
													{row.SMP_DSC || '-'}
												</td>
												<td className="px-2 py-2 text-center whitespace-nowrap">
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															handleEdit(row);
														}}
														disabled={saving || canEditFields}
														className="px-2 py-1 mr-1 text-xs font-medium border border-blue-400 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 disabled:opacity-40"
													>
														수정
													</button>
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															openDeleteOne(row);
														}}
														disabled={saving || canEditFields}
														className="px-2 py-1 text-xs font-medium border border-red-300 rounded bg-red-50 hover:bg-red-100 text-red-800 disabled:opacity-40"
													>
														삭제
													</button>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
						{searched && sortedRows.length > PAGE_SIZE && (
							<div className="flex items-center justify-center gap-1 px-3 py-2 border-t border-blue-200 bg-blue-50/70">
								<button
									type="button"
									onClick={() => setPage(1)}
									disabled={currentPage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 hover:bg-blue-50"
								>
									&lt;&lt;
								</button>
								<button
									type="button"
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									disabled={currentPage === 1}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 hover:bg-blue-50"
								>
									&lt;
								</button>
								{Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
									<button
										key={pageNum}
										type="button"
										onClick={() => setPage(pageNum)}
										className={`px-2 py-1 text-xs border rounded ${
											currentPage === pageNum
												? 'bg-blue-500 text-white border-blue-500'
												: 'border-blue-300 hover:bg-blue-50'
										}`}
									>
										{pageNum}
									</button>
								))}
								<button
									type="button"
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
									disabled={currentPage === totalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 hover:bg-blue-50"
								>
									&gt;
								</button>
								<button
									type="button"
									onClick={() => setPage(totalPages)}
									disabled={currentPage === totalPages}
									className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 hover:bg-blue-50"
								>
									&gt;&gt;
								</button>
							</div>
						)}
					</div>
				</div>
			</div>

			{deleteTarget != null && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-md overflow-hidden bg-white border border-blue-300 rounded-lg shadow-xl">
						<div className="px-4 py-3 border-b border-blue-200 bg-blue-50">
							<h3 className="text-base font-semibold text-blue-900">삭제 확인</h3>
						</div>
						<div className="px-4 py-5 text-sm text-blue-900">
							{deleteTarget === 'all'
								? `${appliedProgram?.name || '선택한 프로그램'}의 ${flagLabel(appliedFlag)}이 삭제됩니다`
								: `${appliedProgram?.name || '선택한 프로그램'}의 ${deleteTarget.SMP_SEQ}번 내용을 삭제합니다`}
						</div>
						<div className="flex justify-end gap-2 px-4 py-3 border-t border-blue-200 bg-blue-50/60">
							<button
								type="button"
								onClick={() => void confirmDelete()}
								disabled={saving}
								className="px-4 py-1.5 text-sm font-medium border border-red-300 rounded bg-red-50 hover:bg-red-100 text-red-800 disabled:opacity-40"
							>
								{saving ? '삭제중' : '삭제'}
							</button>
							<button
								type="button"
								onClick={closeDeleteModal}
								disabled={saving}
								className="px-4 py-1.5 text-sm font-medium border border-gray-400 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-40"
							>
								취소
							</button>
						</div>
					</div>
				</div>
			)}

			{canEditFields && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-lg overflow-hidden bg-white border border-blue-300 rounded-lg shadow-xl">
						<div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-blue-200 bg-blue-50">
							<h3 className="text-base font-semibold text-blue-900">
								{formMode === 'create' ? `${flagLabel(appliedFlag)} 추가` : `${flagLabel(appliedFlag)} 수정`}
							</h3>
							<button
								type="button"
								onClick={handleCancelEdit}
								disabled={saving}
								className="px-2 py-1 text-xs font-medium text-blue-900 border border-blue-300 rounded bg-white hover:bg-blue-50 disabled:opacity-40"
							>
								닫기
							</button>
						</div>
						<div className="p-4 space-y-3">
							<div className="grid grid-cols-2 gap-2 text-sm">
								<div className="px-3 py-2 border border-blue-200 rounded bg-blue-50 text-blue-900">
									<span className="block text-xs text-blue-900/60">프로그램</span>
									{appliedProgram?.name || '-'}
								</div>
								<div className="px-3 py-2 border border-blue-200 rounded bg-blue-50 text-blue-900">
									<span className="block text-xs text-blue-900/60">구분</span>
									{flagLabel(appliedFlag)}
								</div>
							</div>
							<div>
								<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="sample-seq">
									연번 (SMP_SEQ)
								</label>
								<input
									id="sample-seq"
									type="number"
									min={1}
									value={seqInput}
									onChange={(e) => setSeqInput(e.target.value.replace(/[^\d]/g, ''))}
									disabled={saving}
									className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
								/>
							</div>
							<div>
								<label className="block mb-1.5 text-sm font-medium text-blue-900" htmlFor="sample-dsc">
									총평 / 특이사항
								</label>
								<textarea
									id="sample-dsc"
									value={content}
									onChange={(e) => setContent(e.target.value.slice(0, 200))}
									disabled={saving}
									maxLength={200}
									rows={6}
									autoFocus
									placeholder={`${flagLabel(appliedFlag)} 샘플 내용을 입력하세요`}
									className="w-full px-3 py-2 text-sm bg-white border border-blue-300 rounded resize-y focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
								/>
								<p className="mt-1 text-xs text-right text-blue-900/55">{content.length}/200</p>
							</div>
						</div>
						<div className="flex justify-end gap-2 px-4 py-3 border-t border-blue-200 bg-blue-50/60">
							<button
								type="button"
								onClick={() => void handleSave()}
								disabled={saving}
								className="px-4 py-1.5 text-sm font-medium border border-green-400 rounded bg-green-100 hover:bg-green-200 text-green-900 disabled:opacity-40"
							>
								{saving ? '저장중' : '저장'}
							</button>
							<button
								type="button"
								onClick={handleCancelEdit}
								disabled={saving}
								className="px-4 py-1.5 text-sm font-medium border border-gray-400 rounded bg-gray-100 hover:bg-gray-200 text-gray-800 disabled:opacity-40"
							>
								취소
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
