"use client";
import React from 'react';

export default function GuardianInfo() {
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-[1200px] p-4">
        <div className="flex gap-4">
          {/* 좌측: 수급자 목록 */}
          <aside className="w-72 shrink-0">
            <div className="border border-blue-300 rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="bg-blue-100 border-b border-blue-300 px-3 py-2 text-blue-900 font-semibold">수급자 목록</div>
              
              {/* 상단 검색/상태 필터 */}
              <div className="px-3 py-2 border-b border-blue-100 space-y-2">
                <div className="text-xs text-blue-900/80">이름 검색 실시간</div>
                <input 
                  className="w-full border border-blue-300 rounded px-2 py-1 text-sm bg-white" 
                  placeholder="예) 김 → 김시, 김은 / 김기 → 감기, 김기" 
                />
                
                {/* 현황선택 */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-blue-900/80">현황선택</label>
                  <select className="flex-1 border border-blue-300 rounded px-2 py-1 text-sm bg-white">
                    <option>입소중</option>
                    <option>퇴소</option>
                    <option>모두</option>
                  </select>
                </div>
                
                <div className="text-xs text-blue-900/60">조건 걷기</div>
              </div>
              
              {/* 목록 테이블 */}
              <div className="max-h-[540px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-blue-50 border-b border-blue-200">
                    <tr>
                      <th className="text-left px-2 py-2 text-blue-900 font-semibold">연번</th>
                      <th className="text-left px-2 py-2 text-blue-900 font-semibold">현황</th>
                      <th className="text-left px-2 py-2 text-blue-900 font-semibold">수급자명</th>
                      <th className="text-left px-2 py-2 text-blue-900 font-semibold">성별</th>
                      <th className="text-left px-2 py-2 text-blue-900 font-semibold">등급</th>
                      <th className="text-left px-2 py-2 text-blue-900 font-semibold">나이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { no: 1, status: '입소', name: '김00', gender: '남', grade: '5', age: '89' },
                      { no: 2, status: '퇴소', name: '박00', gender: '여', grade: '4', age: '91' },
                    ].map((row) => (
                      <tr key={row.no} className="border-b border-blue-50 hover:bg-blue-50 cursor-pointer">
                        <td className="px-2 py-2">{row.no}</td>
                        <td className="px-2 py-2">{row.status}</td>
                        <td className="px-2 py-2">{row.name}</td>
                        <td className="px-2 py-2">{row.gender}</td>
                        <td className="px-2 py-2">{row.grade}</td>
                        <td className="px-2 py-2">{row.age}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* 안정만료 정보 */}
                <div className="px-3 py-2 border-t border-blue-100 bg-blue-50">
                  <div className="text-xs text-blue-900/80">+ 안정만료</div>
                  <div className="text-xs text-blue-900/60 mt-1">27.07.25, 28.05.11</div>
                </div>
              </div>
            </div>
          </aside>

          {/* 우측: 보호자 정보 */}
          <section className="flex-1">
            <div className="border border-blue-300 rounded-lg bg-white shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-100">
                <h2 className="text-xl font-semibold text-blue-900">보호자 정보</h2>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">새 보호자</button>
                  <button className="px-3 py-1 text-sm border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">저장</button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* 수급자명 */}
                <div className="flex items-center gap-2">
                  <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">수급자명</label>
                  <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="선택된 수급자명" />
                </div>

                {/* 보호자 상세 정보 */}
                <div className="grid grid-cols-12 gap-4">
                  {/* 1열 */}
                  <div className="col-span-12 md:col-span-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">보호자명</label>
                      <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">관계</label>
                      <select className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white">
                        <option>남편</option>
                        <option>부인</option>
                        <option>아들</option>
                        <option>딸</option>
                        <option>사위</option>
                        <option>며느리</option>
                        <option>손주</option>
                        <option>기타</option>
                      </select>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">주 보호자</label>
                      <input type="checkbox" className="w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500" />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">관계 내용</label>
                      <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="예) 둘째 딸, 셋째..." />
                    </div>
                  </div>

                  {/* 2열 */}
                  <div className="col-span-12 md:col-span-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">전화번호</label>
                      <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" placeholder="010-0000-0000" />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">주소</label>
                      <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
                    </div>
                  </div>
                </div>

                {/* 구분선 */}
                <div className="border-t border-blue-200 my-4"></div>

                {/* 병원 정보 */}
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 md:col-span-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">이용병원</label>
                      <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">주치의</label>
                      <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
                    </div>
                  </div>
                  
                  <div className="col-span-12 md:col-span-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="w-28 px-2 py-1 bg-blue-100 border border-blue-300 rounded text-blue-900">병원주소</label>
                      <input className="flex-1 border border-blue-300 rounded px-2 py-1 bg-white" />
                    </div>
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
