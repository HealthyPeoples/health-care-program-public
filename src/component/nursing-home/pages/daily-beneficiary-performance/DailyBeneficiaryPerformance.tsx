"use client";
import React from 'react';

export default function DailyBeneficiaryPerformance() {
	return (
		<div className="min-h-screen bg-white text-black">
			<div className="mx-auto max-w-[1200px] p-4">
				<div className="flex gap-4">
					{/* 좌측: 수급자 목록 */}
					<aside className="w-72 shrink-0">
						<div className="border border-blue-300 rounded-lg overflow-hidden bg-white shadow-sm">
							<div className="bg-blue-100 border-b border-blue-300 px-3 py-2 text-blue-900 font-semibold">수급자 목록</div>
							{/* 상단 상태/검색 영역 */}
							<div className="px-3 py-2 border-b border-blue-100 space-y-2">
								<div className="text-xs text-blue-900/80">이름/전화/생년월일 검색</div>
								<input className="w-full border border-blue-300 rounded px-2 py-1 text-sm bg-white" placeholder="예) 홍길동 / 010- / 50-01-01" />
								<button className="w-full text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 py-1">검색</button>
							</div>
							{/* 목록 테이블 */}
							<div className="max-h-[540px] overflow-auto">
								<table className="w-full text-sm">
									<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
										<tr>
											<th className="text-left px-2 py-2 text-blue-900 font-semibold">이름</th>
											<th className="text-left px-2 py-2 text-blue-900 font-semibold">등급</th>
										</tr>
									</thead>
									<tbody>
										{[
											{ name: '홍길동', grade: '1등급' },
											{ name: '김영희', grade: '2등급' },
											{ name: '이철수', grade: '3등급' },
											{ name: '박민수', grade: '4등급' },
											{ name: '최자영', grade: '5등급' },
										].map((row, idx) => (
										<tr key={idx} className="border-b border-blue-50 hover:bg-blue-50 cursor-pointer">
											<td className="px-2 py-2">{row.name}</td>
											<td className="px-2 py-2">{row.grade}</td>
										</tr>
									))}
									</tbody>
								</table>
							</div>
						</div>
					</aside>

					{/* 우측: 급여실적 상세 영역 */}
					<section className="flex-1 space-y-4">
						{/* 급여실적 카드 */}
						<div className="border border-blue-300 rounded-lg bg-white shadow-sm">
							<div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
								<h2 className="text-xl font-semibold text-blue-900">일 수급자급여실적 등록</h2>
								<div className="flex items-center gap-2">
									<button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">저장</button>
								</div>
							</div>

							<div className="p-4">
								<div className="grid grid-cols-12 gap-4">
									{/* 입력 필드 영역 */}
									<div className="col-span-12 grid grid-cols-12 gap-3">
										{/* 1행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">수급자명</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">등록일자</label>
											<input type="date" className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
										</div>

										{/* 2행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">서비스종류</label>
											<select className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white">
												<option>일반요양</option>
												<option>특별요양</option>
												<option>단기보호</option>
											</select>
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">서비스시간</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="ex) 8시간" />
										</div>

										{/* 3행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">급여금액</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">본인부담</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
										</div>

										{/* 4행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">담당자</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">비고</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* 하단 2컬럼 카드: 서비스 상세 / 급여 이력 */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* 서비스 상세 */}
							<div className="border border-blue-300 rounded-lg bg-white shadow-sm">
								<div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
									<h3 className="text-lg font-semibold text-blue-900">서비스 상세</h3>
									<button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">상세보기</button>
								</div>
								<div className="p-4 space-y-2 text-sm">
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">기본서비스</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">추가서비스</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">특별서비스</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">총서비스</span><span className="flex-1 border-b border-blue-200" /></div>
								</div>
							</div>

							{/* 급여 이력 */}
							<div className="border border-blue-300 rounded-lg bg-white shadow-sm">
								<div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
									<h3 className="text-lg font-semibold text-blue-900">급여 이력</h3>
									<button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">이력 관리</button>
								</div>
								<div className="p-4 space-y-2 text-sm">
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">등록일자</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">서비스종류</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">급여금액</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">등록자</span><span className="flex-1 border-b border-blue-200" /></div>
								</div>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
    );
}
