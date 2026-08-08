"use client";

/**
 * @file 간식일괄등록 — 화면 컴포넌트 (SnackBulkRegistration.tsx)
 *
 * @description
 * F14020 기준 오전/오후/저녁 간식(MGVOL/AGVOL/DGVOL) 일괄 등록과
 * 일자별 수급자별 등록 현황 조회를 제공 합니다.
 *
 * @module component/nursing-home/pages/snack-bulk-registration/SnackBulkRegistration
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

type SnackRow = {
	PNUM: string;
	P_NM: string;
	SVDT: string;
	MGVOL: string;
	AGVOL: string;
	DGVOL: string;
	MGST: string;
	AGST: string;
	DGST: string;
	P_ST: string;
};

type ListFilter = 'all' | 'registered' | 'empty';

const LIST_PAGE_SIZE = 5;

const todayYmd = () => {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const day = String(today.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

const toYmd = (raw: unknown) => {
	if (raw == null || raw === '') return '';
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		const y = raw.getFullYear();
		const m = String(raw.getMonth() + 1).padStart(2, '0');
		const d = String(raw.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(raw).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	const digits = s.replace(/\D/g, '');
	if (digits.length >= 8) {
		return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
	}
	return s;
};

const str = (v: unknown) => String(v ?? '').trim();

/** 가장 많이 등록된 간식명 */
function mostCommonSnack(values: string[]) {
	const counts = new Map<string, number>();
	for (const v of values) {
		const key = str(v);
		if (!key) continue;
		counts.set(key, (counts.get(key) || 0) + 1);
	}
	let best = '';
	let bestN = 0;
	counts.forEach((n, k) => {
		if (n > bestN) {
			best = k;
			bestN = n;
		}
	});
	return { name: best, count: bestN };
}

function mapApiToSnackRow(item: any): SnackRow {
	return {
		PNUM: str(item.PNUM),
		P_NM: str(item.P_NM) || '-',
		SVDT: toYmd(item.SVDT),
		MGVOL: str(item.MGVOL),
		AGVOL: str(item.AGVOL),
		DGVOL: str(item.DGVOL),
		MGST: str(item.MGST) || '1',
		AGST: str(item.AGST) || '1',
		DGST: str(item.DGST) || '1',
		P_ST: str(item.P_ST),
	};
}

function hasAnySnack(row: SnackRow) {
	return !!(row.MGVOL || row.AGVOL || row.DGVOL);
}

function SnackCell({ name, status }: { name: string; status: string }) {
	const checked = status === '1';
	if (!name) {
		return <span className="text-blue-900/40">-</span>;
	}
	return (
		<span className="inline-flex flex-col items-start gap-0.5">
			<span className="font-medium text-blue-900 break-words">{name}</span>
			<span
				className={`text-[11px] ${
					checked ? 'text-emerald-700' : 'text-amber-700'
				}`}
			>
				{checked ? '제공(체크)' : '미제공(미체크)'}
			</span>
		</span>
	);
}

export default function SnackBulkRegistration() {
	const [mealDate, setMealDate] = useState(todayYmd());
	const [morningSnack, setMorningSnack] = useState('');
	const [afternoonSnack, setAfternoonSnack] = useState('');
	const [eveningSnack, setEveningSnack] = useState('');
	const [saving, setSaving] = useState(false);

	/** 조회 패널 일자 (변경 시 자동 조회) */
	const [queryDate, setQueryDate] = useState(todayYmd());
	const [rows, setRows] = useState<SnackRow[]>([]);
	const [loadingList, setLoadingList] = useState(false);
	const [listError, setListError] = useState('');
	const [listFilter, setListFilter] = useState<ListFilter>('all');
	const [nameQuery, setNameQuery] = useState('');
	const [currentPage, setCurrentPage] = useState(1);

	const fetchSnackList = useCallback(async (svdt: string) => {
		if (!svdt) {
			setRows([]);
			return;
		}
		setLoadingList(true);
		setListError('');
		try {
			const res = await fetch(`/api/f14020?svdt=${encodeURIComponent(svdt)}`, {
				cache: 'no-store',
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || '간식 등록 현황 조회 실패');
			}
			const list = (Array.isArray(json.data) ? json.data : [])
				.map(mapApiToSnackRow)
				.sort((a: SnackRow, b: SnackRow) =>
					a.P_NM.localeCompare(b.P_NM, 'ko')
				);
			setRows(list);
		} catch (e) {
			console.error(e);
			setRows([]);
			setListError(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다.');
		} finally {
			setLoadingList(false);
		}
	}, []);

	useEffect(() => {
		void fetchSnackList(queryDate);
	}, [queryDate, fetchSnackList]);

	const summary = useMemo(() => {
		const morning = mostCommonSnack(rows.map((r) => r.MGVOL));
		const afternoon = mostCommonSnack(rows.map((r) => r.AGVOL));
		const evening = mostCommonSnack(rows.map((r) => r.DGVOL));
		const morningFilled = rows.filter((r) => r.MGVOL).length;
		const afternoonFilled = rows.filter((r) => r.AGVOL).length;
		const eveningFilled = rows.filter((r) => r.DGVOL).length;
		const anyFilled = rows.filter(hasAnySnack).length;
		return {
			total: rows.length,
			anyFilled,
			morning,
			afternoon,
			evening,
			morningFilled,
			afternoonFilled,
			eveningFilled,
		};
	}, [rows]);

	const filteredRows = useMemo(() => {
		const q = nameQuery.trim().toLowerCase();
		return rows.filter((r) => {
			if (listFilter === 'registered' && !hasAnySnack(r)) return false;
			if (listFilter === 'empty' && hasAnySnack(r)) return false;
			if (q && !r.P_NM.toLowerCase().includes(q)) return false;
			return true;
		});
	}, [rows, listFilter, nameQuery]);

	const totalPages = Math.max(1, Math.ceil(filteredRows.length / LIST_PAGE_SIZE));
	const startIndex = (currentPage - 1) * LIST_PAGE_SIZE;
	const endIndex = startIndex + LIST_PAGE_SIZE;
	const paginatedRows = filteredRows.slice(startIndex, endIndex);

	useEffect(() => {
		setCurrentPage(1);
	}, [queryDate, listFilter, nameQuery]);

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages);
		}
	}, [currentPage, totalPages]);

	const handlePageChange = (page: number) => {
		setCurrentPage(Math.min(Math.max(1, page), totalPages));
	};

	const handleSubmit = async () => {
		if (!mealDate) {
			alert('식사일자를 선택해주세요.');
			return;
		}
		if (
			morningSnack.trim() === '' &&
			afternoonSnack.trim() === '' &&
			eveningSnack.trim() === ''
		) {
			alert('오전/오후/저녁 간식 중 하나 이상 입력해주세요.');
			return;
		}

		setSaving(true);
		try {
			const checkRes = await fetch(`/api/f14020?svdt=${encodeURIComponent(mealDate)}`);
			const checkJson = await checkRes.json().catch(() => ({}));
			if (!checkRes.ok || !checkJson?.success) {
				throw new Error(checkJson?.error || '급여실적 조회 실패');
			}
			const records = Array.isArray(checkJson.data) ? checkJson.data : [];
			if (records.length === 0) {
				alert('간식을 등록할 수급자 급여 실적이 없습니다');
				return;
			}

			const confirmed = window.confirm(
				`${mealDate} 일자에 입소 중인 수급자의 간식 정보를 일괄 등록하시겠습니까?`
			);
			if (!confirmed) return;

			const res = await fetch('/api/f14020', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'bulkSnack',
					svdt: mealDate,
					MGVOL: morningSnack.trim(),
					AGVOL: afternoonSnack.trim(),
					DGVOL: eveningSnack.trim(),
				}),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || '간식 일괄등록 실패');
			}
			const count = Number(json.updated) || 0;
			if (count === 0) {
				alert('간식을 등록할 수급자 급여 실적이 없습니다');
			} else {
				alert(`${count}명의 수급자에게 간식이 일괄 등록되었습니다.`);
			}
			// 등록한 일자로 우측 현황 동기화 (같으면 재조회, 다르면 queryDate 변경으로 자동 조회)
			if (mealDate === queryDate) {
				await fetchSnackList(mealDate);
			} else {
				setQueryDate(mealDate);
			}
		} catch (e) {
			console.error(e);
			alert(e instanceof Error ? e.message : '간식 일괄등록 중 오류가 발생했습니다.');
		} finally {
			setSaving(false);
		}
	};

	const fillFromSummary = () => {
		if (summary.morning.name) setMorningSnack(summary.morning.name);
		if (summary.afternoon.name) setAfternoonSnack(summary.afternoon.name);
		if (summary.evening.name) setEveningSnack(summary.evening.name);
	};

	return (
		<div className="min-h-screen w-full max-w-full min-w-0 overflow-x-hidden text-black bg-white">
			{/* 넓은 화면: 좌 등록 / 우 현황, 좁으면 세로 배치 */}
			<div className="mx-auto w-full max-w-[1400px] min-w-0 p-3 sm:p-4">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
					{/* 등록 폼 (좌측) */}
					<section className="w-full min-w-0 bg-white border border-blue-300 rounded-lg shadow-sm lg:w-[360px] lg:shrink-0 xl:w-[400px]">
						<div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 bg-blue-100 border-b border-blue-200">
							<div>
								<h2 className="text-xl font-semibold text-blue-900">간식내역 일괄 등록</h2>
								<p className="mt-0.5 text-xs text-blue-900/70">
									선택한 일자(F14020) 입소 수급자에게 오전/오후/저녁 간식명을 일괄 반영합니다.
								</p>
							</div>
						</div>

						<div className="p-4 sm:p-5 space-y-3">
							<div className="flex items-center gap-2">
								<label className="w-24 shrink-0 px-2 py-1 text-sm text-blue-900 bg-blue-100 border border-blue-300 rounded">
									식사일자
								</label>
								<input
									type="date"
									value={mealDate}
									onChange={(e) => setMealDate(e.target.value)}
									className="flex-1 min-w-0 px-2 py-1 bg-white border border-blue-300 rounded"
									disabled={saving}
								/>
							</div>

							<div className="flex items-center gap-2">
								<label className="w-24 shrink-0 px-2 py-1 text-sm text-blue-900 bg-blue-100 border border-blue-300 rounded">
									오전 간식
								</label>
								<input
									type="text"
									value={morningSnack}
									onChange={(e) => setMorningSnack(e.target.value)}
									className="flex-1 min-w-0 px-2 py-1 bg-white border border-blue-300 rounded"
									placeholder="예) 우유"
									disabled={saving}
								/>
							</div>

							<div className="flex items-center gap-2">
								<label className="w-24 shrink-0 px-2 py-1 text-sm text-blue-900 bg-blue-100 border border-blue-300 rounded">
									오후 간식
								</label>
								<input
									type="text"
									value={afternoonSnack}
									onChange={(e) => setAfternoonSnack(e.target.value)}
									className="flex-1 min-w-0 px-2 py-1 bg-white border border-blue-300 rounded"
									placeholder="예) 과일"
									disabled={saving}
								/>
							</div>

							<div className="flex items-center gap-2">
								<label className="w-24 shrink-0 px-2 py-1 text-sm text-blue-900 bg-blue-100 border border-blue-300 rounded">
									저녁 간식
								</label>
								<input
									type="text"
									value={eveningSnack}
									onChange={(e) => setEveningSnack(e.target.value)}
									className="flex-1 min-w-0 px-2 py-1 bg-white border border-blue-300 rounded"
									placeholder="예) 요구르트"
									disabled={saving}
								/>
							</div>

							<div className="flex flex-col gap-2 pt-1">
								<button
									type="button"
									onClick={handleSubmit}
									disabled={saving}
									className="w-full px-4 py-2 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50"
								>
									{saving ? '등록 중...' : '간식일괄등록'}
								</button>
								<button
									type="button"
									onClick={fillFromSummary}
									disabled={saving || summary.anyFilled === 0}
									className="w-full px-4 py-2 text-sm font-medium text-blue-900 bg-white border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
									title="우측(또는 아래) 현황에서 가장 많이 등록된 간식명으로 입력란을 채웁니다"
								>
									현황 값으로 채우기
								</button>
							</div>
						</div>
					</section>

					{/* 등록 현황 조회 (우측, 좁으면 아래) */}
					<section className="w-full min-w-0 bg-white border border-blue-300 rounded-lg shadow-sm lg:flex-1">
						<div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 bg-blue-100 border-b border-blue-200">
							<div>
								<h2 className="text-lg font-semibold text-blue-900">일자별 간식 등록 현황</h2>
								<p className="mt-0.5 text-xs text-blue-900/70">
									일자를 바꾸면 해당 일자 수급자별 간식 등록 내역이 바로 조회됩니다.
								</p>
							</div>
						</div>

						{/* 일자 선택 시 자동 조회 */}
						<div className="flex flex-wrap items-end gap-2 px-3 py-3 sm:px-4 border-b border-blue-100 bg-white">
							<div className="flex flex-col gap-1 min-w-[160px]">
								<label className="text-xs font-medium text-blue-900/80">조회 일자</label>
								<input
									type="date"
									value={queryDate}
									onChange={(e) => setQueryDate(e.target.value)}
									className="px-2 py-1.5 text-sm bg-white border border-blue-300 rounded"
									disabled={loadingList}
								/>
							</div>
							<button
								type="button"
								onClick={() => setQueryDate(todayYmd())}
								disabled={loadingList}
								className="px-3 py-1.5 text-sm text-blue-900 bg-white border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-50"
							>
								오늘
							</button>
							<span className="text-xs text-blue-900/60 self-center ml-auto tabular-nums">
								{loadingList ? '조회 중...' : `조회결과 기준일: ${queryDate || '-'}`}
							</span>
						</div>

						{/* 요약 */}
						<div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-4 sm:p-4 border-b border-blue-100">
							<div className="rounded border border-blue-200 bg-blue-50/60 px-3 py-2">
								<div className="text-xs text-blue-900/70">실적 수급자</div>
								<div className="mt-0.5 text-base font-semibold text-blue-900">
									{summary.total}명
									<span className="ml-2 text-xs font-normal text-blue-900/70">
										(간식등록 {summary.anyFilled}명)
									</span>
								</div>
							</div>
							<div className="rounded border border-blue-200 bg-white px-3 py-2">
								<div className="text-xs text-blue-900/70">오전 간식</div>
								<div className="mt-0.5 text-sm font-semibold text-blue-900 break-words">
									{summary.morning.name || '(미등록)'}
								</div>
								<div className="text-[11px] text-blue-900/60">
									등록 {summary.morningFilled}/{summary.total}명
								</div>
							</div>
							<div className="rounded border border-blue-200 bg-white px-3 py-2">
								<div className="text-xs text-blue-900/70">오후 간식</div>
								<div className="mt-0.5 text-sm font-semibold text-blue-900 break-words">
									{summary.afternoon.name || '(미등록)'}
								</div>
								<div className="text-[11px] text-blue-900/60">
									등록 {summary.afternoonFilled}/{summary.total}명
								</div>
							</div>
							<div className="rounded border border-blue-200 bg-white px-3 py-2">
								<div className="text-xs text-blue-900/70">저녁 간식</div>
								<div className="mt-0.5 text-sm font-semibold text-blue-900 break-words">
									{summary.evening.name || '(미등록)'}
								</div>
								<div className="text-[11px] text-blue-900/60">
									등록 {summary.eveningFilled}/{summary.total}명
								</div>
							</div>
						</div>

						{/* 필터 */}
						<div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4 border-b border-blue-100">
							<div className="flex rounded border border-blue-300 overflow-hidden text-sm">
								{(
									[
										['all', '전체'],
										['registered', '간식등록'],
										['empty', '미등록'],
									] as const
								).map(([value, label]) => (
									<button
										key={value}
										type="button"
										onClick={() => setListFilter(value)}
										className={`px-3 py-1.5 ${
											listFilter === value
												? 'bg-blue-200 text-blue-900 font-medium'
												: 'bg-white text-blue-900/80 hover:bg-blue-50'
										}`}
									>
										{label}
									</button>
								))}
							</div>
							<input
								type="text"
								value={nameQuery}
								onChange={(e) => setNameQuery(e.target.value)}
								placeholder="수급자명 검색"
								className="px-2 py-1.5 text-sm bg-white border border-blue-300 rounded min-w-[140px]"
							/>
							<span className="text-xs text-blue-900/60 ml-auto">
								표시 {filteredRows.length}명
							</span>
						</div>

						<div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
							<table className="w-full min-w-[640px] text-sm">
								<thead className="bg-blue-50 border-b border-blue-200 sticky top-0 z-10">
									<tr>
										<th className="px-2 py-2 font-semibold text-center text-blue-900 border-r border-blue-200 w-12">
											No
										</th>
										<th className="px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200 w-28">
											일자
										</th>
										<th className="px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200 w-36">
											수급자
										</th>
										<th className="px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">
											오전 간식
										</th>
										<th className="px-3 py-2 font-semibold text-left text-blue-900 border-r border-blue-200">
											오후 간식
										</th>
										<th className="px-3 py-2 font-semibold text-left text-blue-900">
											저녁 간식
										</th>
									</tr>
								</thead>
								<tbody>
									{loadingList ? (
										<tr>
											<td colSpan={6} className="px-3 py-8 text-center text-blue-900/60">
												로딩 중...
											</td>
										</tr>
									) : listError ? (
										<tr>
											<td colSpan={6} className="px-3 py-8 text-center text-red-700">
												{listError}
											</td>
										</tr>
									) : filteredRows.length === 0 ? (
										<tr>
											<td colSpan={6} className="px-3 py-8 text-center text-blue-900/60">
												{rows.length === 0
													? '해당 일자 급여실적(F14020)이 없습니다. 일 수급자급여실적에서 전체추가 후 등록하세요.'
													: '조건에 맞는 수급자가 없습니다.'}
											</td>
										</tr>
									) : (
										paginatedRows.map((row, idx) => (
											<tr
												key={`${row.PNUM}-${row.SVDT}-${startIndex + idx}`}
												className="border-b border-blue-50 hover:bg-blue-50/50"
											>
												<td className="px-2 py-2.5 text-center text-blue-900/80 border-r border-blue-100">
													{startIndex + idx + 1}
												</td>
												<td className="px-3 py-2.5 whitespace-nowrap border-r border-blue-100">
													{row.SVDT || queryDate}
												</td>
												<td className="px-3 py-2.5 font-medium text-blue-900 border-r border-blue-100">
													{row.P_NM}
												</td>
												<td className="px-3 py-2.5 border-r border-blue-100 align-top">
													<SnackCell name={row.MGVOL} status={row.MGST} />
												</td>
												<td className="px-3 py-2.5 border-r border-blue-100 align-top">
													<SnackCell name={row.AGVOL} status={row.AGST} />
												</td>
												<td className="px-3 py-2.5 align-top">
													<SnackCell name={row.DGVOL} status={row.DGST} />
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>

						{!loadingList && !listError && filteredRows.length > 0 && (
							<div className="p-3 border-t border-blue-200 bg-white">
								<div className="flex items-center justify-center gap-1">
									<button
										type="button"
										onClick={() => handlePageChange(1)}
										disabled={currentPage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;&lt;
									</button>
									<button
										type="button"
										onClick={() => handlePageChange(currentPage - 1)}
										disabled={currentPage === 1}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&lt;
									</button>
									{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
										const pageNum =
											Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
										return (
											<button
												key={pageNum}
												type="button"
												onClick={() => handlePageChange(pageNum)}
												className={`px-2 py-1 text-xs border rounded ${
													currentPage === pageNum
														? 'bg-blue-500 text-white border-blue-500'
														: 'border-blue-300 hover:bg-blue-50'
												}`}
											>
												{pageNum}
											</button>
										);
									})}
									<button
										type="button"
										onClick={() => handlePageChange(currentPage + 1)}
										disabled={currentPage === totalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;
									</button>
									<button
										type="button"
										onClick={() => handlePageChange(totalPages)}
										disabled={currentPage === totalPages}
										className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
									>
										&gt;&gt;
									</button>
									<span className="ml-4 text-xs text-blue-900 tabular-nums">
										{`${startIndex + 1}-${Math.min(endIndex, filteredRows.length)} / ${filteredRows.length}`}
									</span>
								</div>
							</div>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}
