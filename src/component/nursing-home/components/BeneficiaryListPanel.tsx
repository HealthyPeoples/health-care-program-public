"use client";

/**
 * @file BeneficiaryListPanel.tsx
 *
 * @description
 * src/component/nursing-home/components/BeneficiaryListPanel.tsx 모듈입니다.
 *
 * @module component/nursing-home/components/BeneficiaryListPanel
 */
import React, { useEffect, useMemo, useState } from "react";
import { formatCareGradeLabel } from "../utils/careGrade";
import { useTabRefresh } from "../hooks/useTabRefresh";
import {
  NO_ROOM_VALUE,
  attachLatestRoomNoByPnum,
  availableFloorsFromMembers,
  extractMemberFloor,
  normalizeRoomNo,
} from "../utils/roomNoFloor";

export interface BeneficiaryMember {
  ANCD: string;
  PNUM: string;
  P_NM?: string;
  P_SEX?: string;
  P_GRD?: string;
  P_BRDT?: string;
  P_ST?: string;
  ROOM_NO?: unknown;
  P_FLOOR?: unknown;
  [key: string]: unknown;
}

type Props = {
  title?: string;
  selectedMember: BeneficiaryMember | null;
  onSelect: (m: BeneficiaryMember) => void;
  className?: string;
};

function calculateAge(birthDate: unknown) {
  const s = String(birthDate ?? "").trim();
  if (s.length < 4) return "-";
  const year = parseInt(s.substring(0, 4), 10);
  if (Number.isNaN(year)) return "-";
  return String(new Date().getFullYear() - year);
}

export default function BeneficiaryListPanel({
  title = "수급자 목록",
  selectedMember,
  onSelect,
  className,
}: Props) {
  const [memberList, setMemberList] = useState<BeneficiaryMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("입소");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedFloor, setSelectedFloor] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchMembers = async (nameSearch?: string) => {
    setLoading(true);
    try {
      const url =
        nameSearch && nameSearch.trim() !== ""
          ? `/api/f10010?name=${encodeURIComponent(nameSearch.trim())}`
          : "/api/f10010";

      const response = await fetch(url);
      const result = await response.json();
      if (!result.success) return;

      const list = (result.data || []) as BeneficiaryMember[];
      const mergedMembers = await attachLatestRoomNoByPnum(list);
      setMemberList(mergedMembers);
    } catch (err) {
      console.error("수급자 목록 조회 오류:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // 탭 재활성화 시 수급자 목록만 다시 조회 (선택/필터 상태 유지)
  useTabRefresh(() => {
    void fetchMembers(searchTerm.trim() || undefined);
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchMembers(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, selectedGrade, selectedFloor, searchTerm]);

  const floorOptions = useMemo(() => availableFloorsFromMembers(memberList), [memberList]);

  const filteredMembers = useMemo(() => {
    return memberList
      .filter((member) => {
        if (selectedStatus) {
          const memberStatus = String(member.P_ST || "").trim();
          if (selectedStatus === "입소" && memberStatus !== "1") return false;
          if (selectedStatus === "퇴소" && memberStatus !== "9") return false;
        }

        if (selectedGrade) {
          const memberGrade = String(member.P_GRD || "").trim();
          if (memberGrade !== String(selectedGrade).trim()) return false;
        }

        if (selectedFloor) {
          if (selectedFloor === NO_ROOM_VALUE) {
            if (normalizeRoomNo(member?.ROOM_NO) !== "") return false;
          } else {
            const memberFloor = extractMemberFloor(member);
            const selectedFloorNum = Number(String(selectedFloor).trim());
            if (!Number.isFinite(selectedFloorNum) || memberFloor !== selectedFloorNum) return false;
          }
        }

        if (searchTerm && searchTerm.trim() !== "") {
          const searchLower = searchTerm.toLowerCase().trim();
          if (!String(member.P_NM ?? "").toLowerCase().includes(searchLower)) return false;
        }

        return true;
      })
      .sort((a, b) => String(a.P_NM ?? "").trim().localeCompare(String(b.P_NM ?? "").trim(), "ko"));
  }, [memberList, searchTerm, selectedFloor, selectedGrade, selectedStatus]);

  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentMembers = filteredMembers.slice(startIndex, endIndex);

  return (
    <div className={`flex flex-col min-h-0 w-full p-3 sm:p-4 bg-white border-r border-blue-200 ${className ?? ""}`}>
      <div className="mb-3 shrink-0">
        <h3 className="mb-2 text-sm font-semibold text-blue-900">{title}</h3>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
          <div className="space-y-1 col-span-2 xl:col-span-1">
            <div className="text-xs text-blue-900/80">이름 검색</div>
            <input
              className="w-full min-w-0 px-2 py-1 text-xs bg-white border border-blue-300 rounded"
              placeholder="예) 홍길동"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-blue-900/80">현황</div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full min-w-0 px-2 py-1 text-xs text-blue-900 bg-white border border-blue-300 rounded"
            >
              <option value="">현황 전체</option>
              <option value="입소">입소</option>
              <option value="퇴소">퇴소</option>
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-blue-900/80">등급</div>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full min-w-0 px-2 py-1 text-xs text-blue-900 bg-white border border-blue-300 rounded"
            >
              <option value="">등급 전체</option>
              <option value="1">1등급</option>
              <option value="2">2등급</option>
              <option value="3">3등급</option>
              <option value="4">4등급</option>
              <option value="5">5등급</option>
              <option value="9">인지지원</option>
            </select>
          </div>
          <div className="space-y-1 col-span-2 sm:col-span-1 xl:col-span-1">
            <div className="text-xs text-blue-900/80">층수</div>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-full min-w-0 px-2 py-1 text-xs text-blue-900 bg-white border border-blue-300 rounded"
            >
              <option value="">층수 전체</option>
              <option value={NO_ROOM_VALUE}>방번호 없음</option>
              {floorOptions.map((floor) => (
                <option key={floor} value={String(floor)}>
                  {floor}층
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white border border-blue-300 rounded-lg">
        <div className="min-h-[220px] max-h-[min(540px,55vh)] flex-1 overflow-auto">
          <table className="w-full min-w-[320px] text-xs">
            <thead className="sticky top-0 border-b border-blue-200 bg-blue-50">
              <tr>
                <th className="px-2 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">연번</th>
                <th className="px-2 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">현황</th>
                <th className="px-2 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">수급자명</th>
                <th className="px-2 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">등급</th>
                <th className="px-2 py-1.5 font-semibold text-center text-blue-900 border-r border-blue-200">층</th>
                <th className="px-2 py-1.5 font-semibold text-center text-blue-900">나이</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-blue-900/60">
                    로딩 중...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-blue-900/60">
                    수급자 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                currentMembers.map((member, index) => (
                  <tr
                    key={`${member.ANCD}-${member.PNUM}-${index}`}
                    onClick={() => onSelect(member)}
                    className={`border-b border-blue-50 hover:bg-blue-50 cursor-pointer ${
                      selectedMember?.ANCD === member.ANCD && selectedMember?.PNUM === member.PNUM ? "bg-blue-100" : ""
                    }`}
                  >
                    <td className="px-2 py-1.5 text-center border-r border-blue-100">{startIndex + index + 1}</td>
                    <td className="px-2 py-1.5 text-center border-r border-blue-100">
                      {String(member.P_ST ?? "").trim() === "1" ? "입소" : String(member.P_ST ?? "").trim() === "9" ? "퇴소" : "-"}
                    </td>
                    <td className="px-2 py-1.5 text-center border-r border-blue-100 break-words">
                      {String(member.P_NM ?? "-")}
                    </td>
                    <td className="px-2 py-1.5 text-center border-r border-blue-100">{formatCareGradeLabel(String(member.P_GRD ?? ""))}</td>
                    <td className="px-2 py-1.5 text-center border-r border-blue-100">
                      {extractMemberFloor(member) !== null ? `${extractMemberFloor(member)}층` : "-"}
                    </td>
                    <td className="px-2 py-1.5 text-center">{calculateAge(member.P_BRDT)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-2 bg-white border-t border-blue-200 shrink-0">
            <div className="flex flex-wrap items-center justify-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
              >
                &lt;&lt;
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
              >
                &lt;
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 py-1 text-xs border rounded ${
                      currentPage === pageNum ? "bg-blue-500 text-white border-blue-500" : "border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              }).filter(Boolean)}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
              >
                &gt;
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
              >
                &gt;&gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

