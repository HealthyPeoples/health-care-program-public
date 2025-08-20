"use client";
import React from 'react';

export default function ProgramPlanRegistration() {
	return (
		<div className="min-h-screen bg-white text-black">
			<div className="mx-auto max-w-[1200px] p-4">
				<div className="flex gap-4">
					{/* 좌측: 프로그램 목록 */}
					<aside className="w-72 shrink-0">
						<div className="border border-blue-300 rounded-lg overflow-hidden bg-white shadow-sm">
							<div className="bg-blue-100 border-b border-blue-300 px-3 py-2 text-blue-900 font-semibold">프로그램 목록</div>
							{/* 상단 상태/검색 영역 */}
							<div className="px-3 py-2 border-b border-blue-100 space-y-2">
								<div className="text-xs text-blue-900/80">프로그램명/분류 검색</div>
								<input className="w-full border border-blue-300 rounded px-2 py-1 text-sm bg-white" placeholder="예) 인지활동 / 운동프로그램" />
								<button className="w-full text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 py-1">검색</button>
							</div>
							{/* 목록 테이블 */}
							<div className="max-h-[540px] overflow-auto">
								<table className="w-full text-sm">
									<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
										<tr>
											<th className="text-left px-2 py-2 text-blue-900 font-semibold">프로그램명</th>
											<th className="text-left px-2 py-2 text-blue-900 font-semibold">분류</th>
										</tr>
									</thead>
									<tbody>
										{[
											{ name: '인지활동', category: '인지프로그램' },
											{ name: '신체운동', category: '운동프로그램' },
											{ name: '음악치료', category: '예술프로그램' },
											{ name: '원예치료', category: '자연치료' },
											{ name: '요리활동', category: '생활프로그램' },
										].map((row, idx) => (
										<tr key={idx} className="border-b border-blue-50 hover:bg-blue-50 cursor-pointer">
											<td className="px-2 py-2">{row.name}</td>
											<td className="px-2 py-2">{row.category}</td>
										</tr>
									))}
									</tbody>
								</table>
							</div>
						</div>
					</aside>

					{/* 우측: 프로그램 계획서 상세 영역 */}
					<section className="flex-1 space-y-4">
						{/* 프로그램 계획서 카드 */}
						<div className="border border-blue-300 rounded-lg bg-white shadow-sm">
							<div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
								<h2 className="text-xl font-semibold text-blue-900">프로그램 계획서</h2>
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
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">프로그램명</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">프로그램분류</label>
											<select className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white">
												<option>인지프로그램</option>
												<option>운동프로그램</option>
												<option>예술프로그램</option>
												<option>자연치료</option>
												<option>생활프로그램</option>
											</select>
										</div>

										{/* 2행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">대상자수</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="ex) 10명" />
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">운영기간</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="ex) 2024.01.01 ~ 2024.12.31" />
										</div>

										{/* 3행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">운영시간</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="ex) 14:00 ~ 15:00" />
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">운영요일</label>
											<select className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white">
												<option>월요일</option>
												<option>화요일</option>
												<option>수요일</option>
												<option>목요일</option>
												<option>금요일</option>
												<option>토요일</option>
												<option>일요일</option>
											</select>
										</div>

										{/* 4행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">담당자</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">예산</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="ex) 1,000,000원" />
										</div>

										{/* 5행 */}
										<div className="col-span-12 flex items-start gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">프로그램목표</label>
											<textarea className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white h-20" placeholder="프로그램의 목표를 입력하세요" />
										</div>

										{/* 6행 */}
										<div className="col-span-12 flex items-start gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">운영내용</label>
											<textarea className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white h-20" placeholder="프로그램의 운영내용을 입력하세요" />
										</div>
									</div>
								</div>
							</div>
						</div>

						{/* 하단 2컬럼 카드: 참여대상자 / 예산내역 */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* 참여대상자 */}
							<div className="border border-blue-300 rounded-lg bg-white shadow-sm">
								<div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
									<h3 className="text-lg font-semibold text-blue-900">참여대상자</h3>
									<button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">대상자 관리</button>
								</div>
								<div className="p-4 space-y-2 text-sm">
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">수급자명</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">참여일정</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">참여상태</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">특이사항</span><span className="flex-1 border-b border-blue-200" /></div>
								</div>
							</div>

							{/* 예산내역 */}
							<div className="border border-blue-300 rounded-lg bg-white shadow-sm">
								<div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
									<h3 className="text-lg font-semibold text-blue-900">예산내역</h3>
									<button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">예산 관리</button>
								</div>
								<div className="p-4 space-y-2 text-sm">
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">항목</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">금액</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">사용일자</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">비고</span><span className="flex-1 border-b border-blue-200" /></div>
								</div>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
    );
}
