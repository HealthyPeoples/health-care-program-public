"use client";

/**
 * @file 간식일괄등록 — 화면 컴포넌트 (SnackBulkRegistration.tsx)
 *
 * @description
 * 요양원 간식일괄등록 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/snack-bulk-registration
 *
 * @module component/nursing-home/pages/snack-bulk-registration/SnackBulkRegistration
 */
import { useState } from 'react';

const todayYmd = () => {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const day = String(today.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

export default function SnackBulkRegistration() {
	const [mealDate, setMealDate] = useState(todayYmd());
	const [morningSnack, setMorningSnack] = useState('');
	const [afternoonSnack, setAfternoonSnack] = useState('');
	const [eveningSnack, setEveningSnack] = useState('');
	const [saving, setSaving] = useState(false);

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
			// 해당일 일 급여실적(F14020) 존재 여부 확인
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
					DGVOL: eveningSnack.trim()
				})
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
		} catch (e) {
			console.error(e);
			alert(e instanceof Error ? e.message : '간식 일괄등록 중 오류가 발생했습니다.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="min-h-screen text-black bg-white">
			<div className="mx-auto max-w-[720px] p-4">
				<div className="bg-white border border-blue-300 rounded-lg shadow-sm">
					<div className="flex items-center justify-between px-4 py-3 bg-blue-100 border-b border-blue-200">
						<div>
							<h2 className="text-xl font-semibold text-blue-900">간식내역 일괄 등록</h2>
							<p className="mt-0.5 text-xs text-blue-900/70">
								선택한 일자에 입소 중인 수급자의 오전/오후/저녁 간식을 일괄 반영합니다.
							</p>
						</div>
					</div>

					<div className="p-6 space-y-4">
						<div className="flex items-center gap-2">
							<label className="w-28 shrink-0 px-2 py-1 text-sm text-blue-900 bg-blue-100 border border-blue-300 rounded">
								식사일자
							</label>
							<input
								type="date"
								value={mealDate}
								onChange={(e) => setMealDate(e.target.value)}
								className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded"
								disabled={saving}
							/>
						</div>

						<div className="flex items-center gap-2">
							<label className="w-28 shrink-0 px-2 py-1 text-sm text-blue-900 bg-blue-100 border border-blue-300 rounded">
								오전 간식
							</label>
							<input
								type="text"
								value={morningSnack}
								onChange={(e) => setMorningSnack(e.target.value)}
								className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded"
								placeholder="예) 우유"
								disabled={saving}
							/>
						</div>

						<div className="flex items-center gap-2">
							<label className="w-28 shrink-0 px-2 py-1 text-sm text-blue-900 bg-blue-100 border border-blue-300 rounded">
								오후 간식
							</label>
							<input
								type="text"
								value={afternoonSnack}
								onChange={(e) => setAfternoonSnack(e.target.value)}
								className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded"
								placeholder="예) 과일"
								disabled={saving}
							/>
						</div>

						<div className="flex items-center gap-2">
							<label className="w-28 shrink-0 px-2 py-1 text-sm text-blue-900 bg-blue-100 border border-blue-300 rounded">
								저녁 간식
							</label>
							<input
								type="text"
								value={eveningSnack}
								onChange={(e) => setEveningSnack(e.target.value)}
								className="flex-1 px-2 py-1 bg-white border border-blue-300 rounded"
								placeholder="예) 요구르트"
								disabled={saving}
							/>
						</div>

						<div className="pt-2">
							<button
								type="button"
								onClick={handleSubmit}
								disabled={saving}
								className="w-full px-4 py-2 text-sm font-medium text-blue-900 bg-blue-200 border border-blue-400 rounded hover:bg-blue-300 disabled:opacity-50"
							>
								{saving ? '등록 중...' : '간식일괄등록'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
