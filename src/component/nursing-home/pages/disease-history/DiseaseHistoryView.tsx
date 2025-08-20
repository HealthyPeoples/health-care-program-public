"use client";
import React from 'react';

export default function DiseaseHistoryView() {
	return (
		<div className="min-h-screen bg-white text-black">
			<div className="mx-auto max-w-[1400px] p-4">
				{/* 상단 헤더 영역 */}
				<div className="flex items-center justify-between mb-6">
					{/* 제목 */}
					<h1 className="text-2xl font-bold text-green-600">활력증상</h1>
					
					{/* 날짜 네비게이션 */}
					<div className="flex items-center gap-4">
						<button className="flex items-center gap-2 px-3 py-2 text-sm border border-orange-400 rounded bg-white hover:bg-orange-50 text-orange-600">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
							</svg>
							이전일
						</button>
						
						<div className="flex items-center gap-2">
							<input type="number" placeholder="년" className="w-16 px-2 py-2 text-center border border-gray-300 rounded" />
							<span className="text-gray-600">년</span>
							<input type="number" placeholder="월" className="w-12 px-2 py-2 text-center border border-gray-300 rounded" />
							<span className="text-gray-600">월</span>
							<input type="number" placeholder="일" className="w-12 px-2 py-2 text-center border border-gray-300 rounded" />
							<span className="text-gray-600">일</span>
						</div>
						
						<button className="flex items-center gap-2 px-3 py-2 text-sm border border-orange-400 rounded bg-white hover:bg-orange-50 text-orange-600">
							다음일
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
							</svg>
						</button>
						
						<button className="p-2 border border-orange-400 rounded bg-white hover:bg-orange-50 text-orange-600">
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
						</button>
					</div>
					
					{/* 액션 버튼 */}
					<div className="flex items-center gap-2">
						<button className="px-4 py-2 text-sm border border-orange-400 rounded bg-white hover:bg-orange-50 text-orange-600">저장</button>
						<button className="px-4 py-2 text-sm border border-orange-400 rounded bg-white hover:bg-orange-50 text-orange-600">출력</button>
					</div>
				</div>

				{/* 메인 컨텐츠 영역 */}
				<div className="flex gap-6">
					{/* 좌측: 수급자 목록 */}
					<aside className="w-80 shrink-0">
						<div className="border border-blue-300 rounded-lg overflow-hidden bg-white shadow-sm">
							<div className="bg-blue-100 border-b border-blue-300 px-3 py-2 text-blue-900 font-semibold">수급자 목록</div>
							
							{/* 목록 테이블 */}
							<div className="max-h-[600px] overflow-auto">
								<table className="w-full text-sm">
									<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
										<tr>
											<th className="text-left px-3 py-2 text-blue-900 font-semibold">연번</th>
											<th className="text-left px-3 py-2 text-blue-900 font-semibold">수급자명</th>
											<th className="text-left px-3 py-2 text-blue-900 font-semibold">성별</th>
											<th className="text-left px-3 py-2 text-blue-900 font-semibold">생년월일</th>
										</tr>
									</thead>
									<tbody>
										{[
											{ no: 1, name: '홍길동', gender: '남', birth: '1940-01-15' },
											{ no: 2, name: '김영희', gender: '여', birth: '1935-05-22' },
											{ no: 3, name: '이철수', gender: '남', birth: '1942-08-10' },
											{ no: 4, name: '박민수', gender: '남', birth: '1938-12-03' },
											{ no: 5, name: '최자영', gender: '여', birth: '1945-03-18' },
										].map((row, idx) => (
										<tr key={idx} className={`border-b border-blue-50 hover:bg-blue-50 cursor-pointer ${idx < 2 ? 'bg-blue-100' : ''}`}>
											<td className="px-3 py-2 font-medium">{row.no}</td>
											<td className="px-3 py-2">{row.name}</td>
											<td className="px-3 py-2">{row.gender}</td>
											<td className="px-3 py-2">{row.birth}</td>
										</tr>
									))}
									</tbody>
								</table>
							</div>
						</div>
					</aside>

					{/* 우측: 활력증상 데이터 입력 영역 */}
					<section className="flex-1">
						<div className="border border-blue-300 rounded-lg overflow-hidden bg-white shadow-sm">
							<div className="bg-blue-100 border-b border-blue-300 px-3 py-2 text-blue-900 font-semibold">활력증상 데이터</div>
							
							{/* 활력증상 테이블 */}
							<div className="max-h-[600px] overflow-auto">
								<table className="w-full text-sm">
									<thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
										<tr>
											<th className="text-left px-3 py-2 text-blue-900 font-semibold">혈압</th>
											<th className="text-left px-3 py-2 text-blue-900 font-semibold">맥박</th>
											<th className="text-left px-3 py-2 text-blue-900 font-semibold">체온</th>
											<th className="text-left px-3 py-2 text-blue-900 font-semibold">혈당</th>
											<th className="text-left px-3 py-2 text-blue-900 font-semibold">체중</th>
											<th className="text-left px-3 py-2 text-blue-900 font-semibold">간호대역</th>
										</tr>
									</thead>
									<tbody>
										{[
											{ bp: '120/80', pulse: '72', temp: '36.5', bs: '95', weight: '65.2', nursing: '편집' },
											{ bp: '135/85', pulse: '68', temp: '36.8', bs: '102', weight: '58.7', nursing: '편집' },
											{ bp: '', pulse: '', temp: '', bs: '', weight: '', nursing: '' },
											{ bp: '', pulse: '', temp: '', bs: '', weight: '', nursing: '' },
											{ bp: '', pulse: '', temp: '', bs: '', weight: '', nursing: '' },
										].map((row, idx) => (
										<tr key={idx} className={`border-b border-blue-50 ${idx < 2 ? 'bg-blue-50' : ''}`}>
											<td className="px-3 py-2">
												<input 
													type="text" 
													value={row.bp} 
													placeholder="120/80"
													className="w-full px-2 py-1 border border-gray-300 rounded bg-white" 
												/>
											</td>
											<td className="px-3 py-2">
												<input 
													type="text" 
													value={row.pulse} 
													placeholder="72"
													className="w-full px-2 py-1 border border-gray-300 rounded bg-white" 
												/>
											</td>
											<td className="px-3 py-2">
												<input 
													type="text" 
													value={row.temp} 
													placeholder="36.5"
													className="w-full px-2 py-1 border border-gray-300 rounded bg-white" 
												/>
											</td>
											<td className="px-3 py-2">
												<input 
													type="text" 
													value={row.bs} 
													placeholder="95"
													className="w-full px-2 py-1 border border-gray-300 rounded bg-white" 
												/>
											</td>
											<td className="px-3 py-2">
												<input 
													type="text" 
													value={row.weight} 
													placeholder="65.2"
													className="w-full px-2 py-1 border border-gray-300 rounded bg-white" 
												/>
											</td>
											<td className="px-3 py-2">
												{idx < 2 ? (
													<button className="px-3 py-1 text-sm border border-orange-400 rounded bg-white hover:bg-orange-50 text-orange-600">
														편집
													</button>
												) : (
													<span className="text-gray-400">-</span>
												)}
											</td>
										</tr>
									))}
									</tbody>
								</table>
							</div>
						</div>
					</section>
				</div>

				{/* 하단 액션 버튼 */}
				<div className="flex justify-center mt-6 gap-4">
					<button className="px-6 py-2 text-sm border border-orange-400 rounded bg-white hover:bg-orange-50 text-orange-600">저장</button>
					<button className="px-6 py-2 text-sm border border-orange-400 rounded bg-white hover:bg-orange-50 text-orange-600">전체 삭제</button>
				</div>
			</div>
		</div>
    );
}
