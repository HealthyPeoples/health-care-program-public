"use client";
import React from 'react';

export default function EmployeeBasicInfo() {
	return (
		<div className="min-h-screen bg-white text-black">
			<div className="mx-auto max-w-[1200px] p-4">
				<div className="flex gap-4">
					{/* 좌측: 사원 목록 */}
					<aside className="w-72 shrink-0">
						<div className="border border-blue-300 rounded-lg overflow-hidden bg-white shadow-sm">
							<div className="bg-blue-100 border-b border-blue-300 px-3 py-2 text-blue-900 font-semibold">사원 목록</div>
							{/* 상단 상태/검색 영역 */}
							<div className="px-3 py-2 border-b border-blue-100 space-y-2">
								<div className="text-xs text-blue-900/80">이름/사번/부서 검색</div>
								<input className="w-full border border-blue-300 rounded px-2 py-1 text-sm bg-white" placeholder="예) 홍길동 / E001 / 간호팀" />
								<button className="w-full text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 py-1">검색</button>
							</div>
							{/* 목록 테이블 */}
							<div className="max-h-[540px] overflow-auto">
								<table className="w-full text-sm">
									<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
										<tr>
											<th className="text-left px-2 py-2 text-blue-900 font-semibold">이름</th>
											<th className="text-left px-2 py-2 text-blue-900 font-semibold">부서</th>
										</tr>
									</thead>
									<tbody>
										{[
											{ name: '김간호', dept: '간호팀' },
											{ name: '이요양', dept: '요양팀' },
											{ name: '박치료', dept: '치료팀' },
											{ name: '최행정', dept: '행정팀' },
											{ name: '정프로그램', dept: '프로그램팀' },
										].map((row, idx) => (
										<tr key={idx} className="border-b border-blue-50 hover:bg-blue-50 cursor-pointer">
											<td className="px-2 py-2">{row.name}</td>
											<td className="px-2 py-2">{row.dept}</td>
										</tr>
									))}
									</tbody>
								</table>
							</div>
						</div>
					</aside>

					{/* 우측: 사원정보 상세 영역 */}
					<section className="flex-1 space-y-4">
						{/* 사원정보 카드 */}
						<div className="border border-blue-300 rounded-lg bg-white shadow-sm">
							<div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
								<h2 className="text-xl font-semibold text-blue-900">사원 기본정보</h2>
								<div className="flex items-center gap-2">
									<button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">주소검색</button>
									<button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">저장</button>
								</div>
							</div>

							<div className="p-4">
								<div className="grid grid-cols-12 gap-4">
									{/* 사진 영역 */}
									<div className="col-span-12 md:col-span-3">
										<div className="border border-blue-300 rounded-lg h-36 bg-white flex items-center justify-center text-blue-900/70">사진</div>
										<div className="flex gap-2 mt-2">
											<button className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">촬영</button>
											<button className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">첨부</button>
										</div>
									</div>

									{/* 입력 필드 영역 */}
									<div className="col-span-12 md:col-span-9 grid grid-cols-12 gap-3">
										{/* 1행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">사원명</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">사번</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="ex) E001" />
										</div>

										{/* 2행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">주민번호</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="ex) 900101-1******" />
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">연락처</label>
											<input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="ex) 010-0000-0000" />
										</div>

										{/* 3행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">성별</label>
											<select className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white">
												<option>남</option>
												<option>여</option>
											</select>
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">부서</label>
											<select className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white">
												<option>간호팀</option>
												<option>요양팀</option>
												<option>치료팀</option>
												<option>행정팀</option>
												<option>프로그램팀</option>
											</select>
										</div>

										{/* 4행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">입사일</label>
											<input type="date" className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
										</div>
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">직급</label>
											<select className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white">
												<option>사원</option>
												<option>주임</option>
												<option>대리</option>
												<option>과장</option>
												<option>차장</option>
											</select>
										</div>

										{/* 5행 */}
										<div className="col-span-12 md:col-span-6 flex items-center gap-2">
											<label className="w-24 px-2 py-1 text-sm bg-blue-100 border border-blue-300 rounded text-blue-900">주소</label>
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

						{/* 하단 2컬럼 카드: 자격정보 / 근무정보 */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* 자격정보 */}
							<div className="border border-blue-300 rounded-lg bg-white shadow-sm">
								<div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
									<h3 className="text-lg font-semibold text-blue-900">자격정보</h3>
									<button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">자격 관리</button>
								</div>
								<div className="p-4 space-y-2 text-sm">
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">자격종류</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">취득일자</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">발급기관</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">만료일자</span><span className="flex-1 border-b border-blue-200" /></div>
								</div>
							</div>

							{/* 근무정보 */}
							<div className="border border-blue-300 rounded-lg bg-white shadow-sm">
								<div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
									<h3 className="text-lg font-semibold text-blue-900">근무정보</h3>
									<button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">근무 관리</button>
								</div>
								<div className="p-4 space-y-2 text-sm">
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">근무형태</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">근무시간</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">담당업무</span><span className="flex-1 border-b border-blue-200" /></div>
									<div className="flex items-center gap-2"><span className="w-24 text-blue-900/80">상태</span><span className="flex-1 border-b border-blue-200" /></div>
								</div>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
    );
}
