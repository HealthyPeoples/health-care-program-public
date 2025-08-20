"use client";
import React from 'react';

export default function MemberContractInfo() {
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-[1200px] p-4">
        <div className="flex gap-4">
          {/* 좌측: 계약 목록 */}
          <aside className="w-72 shrink-0">
            <div className="border border-blue-300 rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="bg-blue-100 border-b border-blue-300 px-3 py-2 text-blue-900 font-semibold">계약 목록</div>
              {/* 상단 검색/상태 */}
              <div className="px-3 py-2 border-b border-blue-100 space-y-2">
                <div className="text-xs text-blue-900/80">수급자명/계약번호 검색</div>
                <input className="w-full border border-blue-300 rounded px-2 py-1 text-sm bg-white" placeholder="예) 홍길동 / CT-2025-001" />
                <button className="w-full text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 py-1">검색</button>
              </div>
              {/* 목록 테이블 */}
              <div className="max-h-[540px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
                    <tr>
                      <th className="text-left px-2 py-2 text-blue-900 font-semibold">순번</th>
                      <th className="text-left px-2 py-2 text-blue-900 font-semibold">수급자</th>
                      <th className="text-left px-2 py-2 text-blue-900 font-semibold">계약일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { no: 1, name: '홍길동', date: '2025-07-21' },
                      { no: 2, name: '김영희', date: '2025-05-11' },
                      { no: 3, name: '이철수', date: '2025-03-02' },
                    ].map((row) => (
                      <tr key={row.no} className="border-b border-blue-50 hover:bg-blue-50 cursor-pointer">
                        <td className="px-2 py-2">{row.no}</td>
                        <td className="px-2 py-2">{row.name}</td>
                        <td className="px-2 py-2">{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </aside>

          {/* 우측: 계약 정보 */}
          <section className="flex-1">
            <div className="border border-blue-300 rounded-lg bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
                <h2 className="text-xl font-semibold text-blue-900">계약 정보</h2>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">새 계약</button>
                  <button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">저장</button>
                </div>
              </div>

              <div className="p-4 grid grid-cols-12 gap-4 text-sm">
                {/* 1열 좌/우 */}
                <div className="col-span-12 md:col-span-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">수급자명</label>
                    <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">계약일자</label>
                    <input type="date" className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">종료일자</label>
                    <input type="date" className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">요양급여</label>
                    <select className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white">
                      <option>일반</option>
                      <option>60% 감면</option>
                      <option>40% 감면</option>
                      <option>기초수급</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">총 입소비용</label>
                    <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="숫자만 입력" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">감면(%)</label>
                    <input className="w-24 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="ex) 10" />
                    <span className="text-blue-900/70">카드</span>
                    <input className="w-28 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="금액" />
                    <span className="text-blue-900/70">현금</span>
                    <input className="w-28 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="금액" />
                  </div>
                </div>

                <div className="col-span-12 md:col-span-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">방문상담</label>
                    <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="예) 1회 / 2025-07-20" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">납부계좌</label>
                    <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="은행명 / 계좌번호" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">선/후불</label>
                    <select className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white">
                      <option>선불</option>
                      <option>후불</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">기타 특이</label>
                    <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="기타 특이사항" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">비고</label>
                    <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
