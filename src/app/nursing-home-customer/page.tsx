'use client';

import { useState, useEffect } from 'react';

interface CenterData {
  ANCD: string;
  ANNM: string;
  ANGH: string;
  ANSDT: string;
  ANEDT: string;
  ANZIP: string;
  ANADD: string;
  ANTEL: string;
  ANFAX: string;
  ANDOMAIN: string;
  ANEMAIL: string;
  ANHP: string;
  MNM: string;
  ANAMT: number;
  TAXYN: string;
  TAXNM: string;
  TAXOWN: string;
  TAXNUM: string;
  TAXADD: string;
  TAXJOB: string;
  TAXJOB1: string;
  TAXEMAIL1: string;
  TAXEMAIL2: string;
  TAXEMAIL3: string;
  DEL: string;
  ENYN: string;
  PWDD: number;
  INDT: string;
  ETC: string;
  SECYN: string;
  MAXCNT: number;
  D_LVL: number;
  TRANS_GU: string;
  TRANS_OBJ3: string;
  SNM: string;
  S_GU: string;
  RDES: string;
  B_EAMT: number;
  B_ETAMT: number;
  MH_ANCD: string;
  WK_DT_DEL_FLAG: string;
  DG_SRV_GU: string;
  MED_GU: string;
  MSG_DUE_DD: number;
  SRV_DESC: string;
  CMP_MM_FLAG: string;
  OUT_COMP_FLAG: string;
  CPY_CNTR_FLAG: string;
  CPY_CNTR_ANCD: string;
}

interface ReferenceData {
  OBJ3: string;
  OBJ1: string;
  OBJ2: string;
  OBJ3NM: string;
  ANI: string;
  INDT: string;
  ETC: string;
  URDT: string;
  ICD: string;
  DEL: string;
  INEMPNO: string;
  INEMPNM: string;
}

export default function NursingHomeCustomerPage() {
  const [centers, setCenters] = useState<CenterData[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<CenterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCenters = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/f00110');
      const result = await response.json();
      
      if (result.success) {
        setCenters(result.data);
        if (result.data.length > 0) {
          setSelectedCenter(result.data[0]);
        }
      } else {
        setError(result.error || '센터 데이터 조회 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleCenterSelect = (center: CenterData) => {
    setSelectedCenter(center);
  };

  const filteredCenters = centers.filter(center => 
    center.ANNM?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    center.ANCD?.includes(searchTerm)
  );

  useEffect(() => {
    fetchCenters();
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 왼쪽 패널 - 센터 목록 */}
      <div className="w-1/3 bg-white border-r border-gray-300">
        <div className="p-4 border-b border-gray-300">
          <h1 className="text-xl font-bold text-center">요양원 고객관리</h1>
        </div>
        
        <div className="p-4 border-b border-gray-300">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="고객명"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded"
            />
            <button className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600">
              검색
            </button>
          </div>
        </div>

        <div className="overflow-y-auto h-96">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left border-b">센터코드</th>
                <th className="px-4 py-2 text-left border-b">센터명</th>
              </tr>
            </thead>
            <tbody>
              {filteredCenters.map((center, index) => (
                <tr
                  key={index}
                  className={`cursor-pointer hover:bg-gray-100 ${
                    selectedCenter?.ANCD === center.ANCD ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => handleCenterSelect(center)}
                >
                  <td className="px-4 py-2 border-b">{center.ANCD}</td>
                  <td className="px-4 py-2 border-b">{center.ANNM}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        <div className="p-4 border-t border-gray-300">
          <div className="flex justify-center gap-2">
            <button className="px-2 py-1 border rounded">&lt;&lt;</button>
            <button className="px-2 py-1 border rounded">&lt;</button>
            <button className="px-2 py-1 text-white bg-blue-500 border rounded">1</button>
            <button className="px-2 py-1 border rounded">&gt;</button>
            <button className="px-2 py-1 border rounded">&gt;&gt;</button>
          </div>
        </div>
      </div>

      {/* 오른쪽 패널 - 센터 상세 정보 */}
      <div className="flex-1 p-6">
        {selectedCenter ? (
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="mb-4 text-lg font-semibold">기본 정보</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    장기요양기관명
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.ANNM || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    장기요양기관기호
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.ANGH || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    센터정원
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.MAXCNT || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>

            {/* 설정 및 분류 */}
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="mb-4 text-lg font-semibold">설정 및 분류</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedCenter.SECYN === 'Y'}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-gray-700">보안적용</label>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    결재레벨
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.D_LVL || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedCenter.TRANS_GU === 'Y'}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-gray-700">수금전표이관</label>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    시설구분
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="facilityType"
                        value="시설요양"
                        className="mr-1"
                      />
                      시설요양
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="facilityType"
                        value="공동생활"
                        className="mr-1"
                      />
                      공동생활
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="facilityType"
                        value="단기보호"
                        className="mr-1"
                      />
                      단기보호
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 연락처 정보 */}
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="mb-4 text-lg font-semibold">연락처 정보</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    사용기간
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={selectedCenter.ANSDT || ''}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded"
                    />
                    <span className="py-2">~</span>
                    <input
                      type="date"
                      value={selectedCenter.ANEDT || ''}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    관리자명
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.MNM || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    핸드폰번호
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.ANHP || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    전화번호
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.ANTEL || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    주소
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.ANADD || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    통장번호
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.ETC || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>

            {/* 계약 및 보안 설정 */}
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="mb-4 text-lg font-semibold">계약 및 보안 설정</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    계약만기일수
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.MSG_DUE_DD || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    &lt;= 로그인시 수급자 계약만기일 메시지 처리 기준일수
                  </p>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    결재금액
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.ANAMT || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    PW변경일수
                  </label>
                  <input
                    type="text"
                    value={selectedCenter.PWDD || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>

            {/* 액션 버튼들 */}
            <div className="flex justify-end gap-4">
              <button className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600">
                고객매핑작업
              </button>
              <button className="px-4 py-2 text-white bg-green-500 rounded hover:bg-green-600">
                사용자계정관리
              </button>
            </div>

            <div className="flex justify-center gap-4">
              <button className="px-6 py-2 text-white bg-gray-500 rounded hover:bg-gray-600">
                신규
              </button>
              <button className="px-6 py-2 text-white bg-blue-500 rounded hover:bg-blue-600">
                수정
              </button>
              <button className="px-6 py-2 text-white bg-yellow-500 rounded hover:bg-yellow-600">
                만기고객조회
              </button>
              <button className="px-6 py-2 text-white bg-red-500 rounded hover:bg-red-600">
                닫기
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            센터를 선택해주세요
          </div>
        )}
      </div>
    </div>
  );
}