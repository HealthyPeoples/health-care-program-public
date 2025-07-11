"use client";
import { useState } from 'react';
import { NursingHomeHeader } from '../../nursing-home/organisms/NursingHomeHeader'

export const MemberInfo = () => {
  const [selectedName, setSelectedName] = useState('길덕남');

  const members = [
    { name: '길덕남', gender: '여', birth: '1933-09-15', status: '입소', level: '3등급', code: 'L1903102859-102', endDate: '2026-03-28' },
    { name: '김간난', gender: '여', birth: '1954-07-07', status: '입소', level: '3등급', code: 'L0010320081', endDate: '2027-03-31' },
    { name: '김광분', gender: '여', birth: '1954-04-15', status: '입소', level: '1등급', code: 'L2004040575', endDate: '2026-10-16' },
    { name: '김성숙', gender: '여', birth: '1925-11-20', status: '입소', level: '4등급', code: 'L1903184431', endDate: '2026-11-09' },
  ];

  const selected = members.find(m => m.name === selectedName);

  return (
    <div className="p-4 space-y-6 text-sm text-black dark:text-white">
      <NursingHomeHeader />
      <h1 className="p-2 text-xl font-bold bg-gray-200 rounded dark:bg-gray-800">수급자기본정보</h1>

      {/* 상단 검색 바 */}
      <div className="flex items-center gap-2">
        <select className="p-1 border" value={selectedName} onChange={(e) => setSelectedName(e.target.value)}>
          {members.map(m => <option key={m.name}>{m.name}</option>)}
        </select>
        <button className="px-4 py-1 border">검색</button>
        <button className="px-4 py-1 border">수급지출력</button>
        <button className="px-4 py-1 border">닫기</button>
      </div>

      {/* 수급자 테이블 */}
      <table className="w-full text-center border">
        <thead className="bg-gray-100 dark:bg-gray-700">
          <tr>
            <th className="border">수급자</th>
            <th className="border">성별</th>
            <th className="border">생일</th>
            <th className="border">상태</th>
            <th className="border">요양등급</th>
            <th className="border">장기요양인정번호</th>
            <th className="border">만료일자</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.name} className="hover:bg-gray-100 dark:hover:bg-gray-800">
              <td className="px-2 border">{m.name}</td>
              <td className="px-2 border">{m.gender}</td>
              <td className="px-2 border">{m.birth}</td>
              <td className="px-2 border">{m.status}</td>
              <td className="px-2 border">{m.level}</td>
              <td className="px-2 border">{m.code}</td>
              <td className="px-2 border">{m.endDate}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 상세정보 */}
      <div className="p-4 space-y-4 border">
        <div className="flex gap-4">
          <input placeholder="집 전화번호" className="w-1/3 p-1 border" />
          <input placeholder="핸드폰 번호" className="w-1/3 p-1 border" />
          <input placeholder="집 주소" className="w-1/3 p-1 border" />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>계약일자</span>
            <input type="date" value="2024-04-08" className="p-1 border" readOnly />
          </div>
          <div className="flex items-center gap-2">
            <span>입소일자</span>
            <input type="date" value="2024-04-08" className="p-1 border" readOnly />
          </div>
          <div className="flex items-center gap-2">
            <span>퇴소일자</span>
            <input type="date" className="p-1 border" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input placeholder="간호지시서번호" className="p-1 border" />
          <input placeholder="간호지시서정보" value="양수삼성병원재정간호사" className="p-1 border" />
          <input placeholder="이용병원" value="한울정신의학과의원" className="p-1 border" />
          <input placeholder="담당주치의" value="손정현" className="p-1 border" />
          <input placeholder="주치의연락처" value="010-3462-7033" className="col-span-2 p-1 border" />
        </div>

        <div className="flex justify-between mt-4">
          <button className="px-4 py-2 bg-gray-300">추가</button>
          <button className="px-4 py-2 bg-gray-400">수정</button>
          <button className="px-4 py-2 text-white bg-gray-500">수급자카드 출력</button>
        </div>
      </div>
    </div>
  );
}
