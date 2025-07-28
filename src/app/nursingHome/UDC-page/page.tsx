"use client"

import { useState } from 'react';
import CodeRegisterModal from '../../../component/common/CodeRegisterModal';
import CodeEditModal from '../../../component/common/CodeEditModal';

export default function UDCPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  return (
    <div className="bg-white min-h-screen flex flex-col items-center py-6 text-black">
      {/* 상단 바 */}
      <div className="w-[900px] bg-blue-100 border border-blue-300 rounded-lg p-4 mb-4 shadow flex flex-col">
        <div className="flex items-center mb-2">
          <span className="text-2xl font-bold bg-blue-200 px-4 py-1 rounded mr-4 border border-blue-300 text-blue-900">일반코드관리</span>
          <input
            className="ml-2 border border-blue-300 rounded px-2 py-1 w-32 bg-white text-black"
            placeholder="코드구분"
          />
          <button
            className="ml-2 px-4 py-1 border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900"
            // 검색 버튼은 아무 동작 없음
          >검색</button>
          <button
            className="ml-2 px-4 py-1 border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900"
            onClick={() => setModalOpen(true)}
          >신규</button>
          <button
            className="ml-2 px-4 py-1 border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900"
            onClick={() => setEditModalOpen(true)}
          >수정</button>
          <button className="ml-2 px-4 py-1 border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">삭제</button>
          {/* <button className="ml-2 px-4 py-1 border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">사용자코드등록</button> */}
          {/* <button className="ml-2 px-4 py-1 border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">닫기</button> */}
        </div>
        {/* 테이블 */}
        <div className="overflow-auto border border-blue-300 rounded bg-white" style={{ height: 350 }}>
          <table className="min-w-full text-sm text-black">
            <thead>
              <tr className="bg-blue-200 border-b border-blue-300">
                <th className="px-2 py-1 border-r border-blue-300">코드구분</th>
                <th className="px-2 py-1 border-r border-blue-300">설명</th>
                <th className="px-2 py-1 border-r border-blue-300">비고</th>
                <th className="px-2 py-1">DEL</th>
              </tr>
            </thead>
            <tbody>
              {/* 예시 데이터 */}
              {[
                { code: 'AA', desc: '환자정보_요양등급', note: '', del: 'D' },
                { code: 'AB', desc: '보호자_환자와의관계', note: '', del: '' },
                { code: 'AC', desc: '서비스계약_수급자부담율구분', note: '', del: '' },
                { code: 'AD', desc: '상담일지_상담방법', note: '', del: '' },
                { code: 'AE', desc: '하루일과표_서비스구분', note: '', del: '' },
                { code: 'AF', desc: '시설구분(요양,공생)', note: '', del: '' },
                { code: 'AG', desc: '서비스구분', note: '', del: '' },
                { code: 'AH', desc: '메세지구분', note: '', del: '' },
                { code: 'AI', desc: '근무구분', note: '', del: '' },
                { code: 'AJ', desc: '근무시기', note: '', del: '' },
                { code: 'AK', desc: '성별', note: '', del: '' },
                { code: 'AL', desc: '촉탁의 진료구분(1.초진, 2.재진)', note: '', del: '' },
                { code: 'AM', desc: '확인구분', note: '', del: '' },
                { code: 'AN', desc: '치료프로그램 진행구분', note: '', del: '' },
                { code: 'AP', desc: '치료프로그램 구분', note: '', del: '' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-blue-100">
                  <td className="px-2 py-1 border-r border-blue-100">{row.code}</td>
                  <td className="px-2 py-1 border-r border-blue-100">{row.desc}</td>
                  <td className="px-2 py-1 border-r border-blue-100">{row.note}</td>
                  <td className="px-2 py-1">{row.del}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <CodeRegisterModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <CodeEditModal open={editModalOpen} onClose={() => setEditModalOpen(false)} />
    </div>
  );
}