import React from 'react';

interface CodeRegisterModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CodeRegisterModal({ open, onClose }: CodeRegisterModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-blue-400 w-[600px] p-4 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 상단 타이틀 */}
        <div className="bg-blue-200 border border-blue-400 rounded text-center py-4 mb-4 text-2xl font-semibold text-blue-900">일반 코드 등록</div>
        {/* 입력 폼 */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center">
            <label className="w-24 bg-blue-100 border border-blue-400 px-2 py-1 text-base text-blue-900">코드구분</label>
            <input className="flex-1 border border-blue-400 px-2 py-1 ml-2 rounded bg-white text-black" />
          </div>
          <div className="flex items-center">
            <label className="w-24 bg-blue-100 border border-blue-400 px-2 py-1 text-base text-blue-900">설 명</label>
            <input className="flex-1 border border-blue-400 px-2 py-1 ml-2 rounded bg-white text-black" />
          </div>
          <div className="flex items-center">
            <label className="w-24 bg-blue-100 border border-blue-400 px-2 py-1 text-base text-blue-900">비 고</label>
            <input className="flex-1 border border-blue-400 px-2 py-1 ml-2 rounded bg-white text-black" />
          </div>
        </div>
        {/* 버튼 영역 */}
        <div className="flex gap-2 mt-4">
          <button className="flex-1 py-2 bg-blue-300 border border-blue-400 rounded text-lg text-blue-900" disabled>저장</button>
          <button className="w-40 py-2 bg-blue-100 border border-blue-400 rounded text-lg text-blue-900" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
} 