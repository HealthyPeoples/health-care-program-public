"use client"

import { useState, useEffect } from 'react';
import CodeRegisterModal from '../../../component/common/CodeRegisterModal';
import CodeEditModal from '../../../component/common/CodeEditModal';

export default function UserCodeRegistrationPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/user-code-list")
      .then(res => res.json())
      .then(data => {
        setTableData(data?.resultList || []);
      });
  }, []);

  return (
    <div className="bg-white min-h-screen flex flex-col items-center py-6 text-black">
      {/* 상단 바 */}
      <div className="w-[900px] bg-blue-100 border border-blue-300 rounded-lg p-4 mb-4 shadow flex flex-col">
        <div className="flex items-center mb-2">
          <span className="text-2xl font-bold bg-blue-200 px-4 py-1 rounded mr-4 border border-blue-300 text-blue-900">사용자 코드 관리</span>
          <input
            className="ml-2 border border-blue-300 rounded px-2 py-1 w-32 bg-white text-black"
            placeholder="코드구분"
            defaultValue="AA"
          />
          <button
            className="ml-2 px-4 py-1 border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900"
            onClick={() => setModalOpen(true)}
          >신규</button>
          <button
            className="ml-2 px-4 py-1 border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900"
            onClick={() => setEditModalOpen(true)}
          >수정</button>
          <button className="ml-2 px-4 py-1 border border-blue-400 rounded bg-blue-200 hover:bg-blue-300 text-blue-900">삭제</button>
        </div>
        {/* 테이블 */}
        <div className="overflow-auto border border-blue-300 rounded bg-white" style={{ height: 350 }}>
          <table className="min-w-full text-sm text-black">
            <thead>
              <tr className="bg-blue-200 border-b border-blue-300">
                <th className="px-2 py-1 border-r border-blue-300 text-blue-900">코드구분</th>
                <th className="px-2 py-1 border-r border-blue-300 text-blue-900">코드</th>
                <th className="px-2 py-1 border-r border-blue-300 text-blue-900">설명1</th>
                <th className="px-2 py-1 border-r border-blue-300 text-blue-900">조회순위</th>
                <th className="px-2 py-1 border-r border-blue-300 text-blue-900">DEL</th>
                <th className="px-2 py-1 border-r border-blue-300 text-blue-900">설명2</th>
                <th className="px-2 py-1 text-blue-900">비고</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr key={i} className="border-b border-blue-100">
                  <td className="px-2 py-1 border-r border-blue-100">{row.CODE_TYPE || row.codeType}</td>
                  <td className="px-2 py-1 border-r border-blue-100">{row.CODE || row.code}</td>
                  <td className="px-2 py-1 border-r border-blue-100">{row.CODE_NAME1 || row.desc1}</td>
                  <td className="px-2 py-1 border-r border-blue-100">{row.SEQ || row.order}</td>
                  <td className="px-2 py-1 border-r border-blue-100">{row.DEL || row.del}</td>
                  <td className="px-2 py-1 border-r border-blue-100">{row.CODE_NAME2 || row.desc2}</td>
                  <td className="px-2 py-1">{row.REMARK || row.note}</td>
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