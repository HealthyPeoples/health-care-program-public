'use client';

import { useState, useEffect } from 'react';

interface F90030Data {
  [key: string]: any;
}

export default function F90030TestPage() {
  const [data, setData] = useState<F90030Data[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState('SELECT TOP 10 * FROM [돌봄시설DB].[dbo].[F90030]');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/f90030');
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || '데이터 조회 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  const executeCustomQuery = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/f90030', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: customQuery
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || '쿼리 실행 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="container p-6 mx-auto">
      <h1 className="mb-6 text-3xl font-bold">F90030 테이블 데이터 조회</h1>
      
      <div className="mb-6">
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 mr-4 font-bold text-white bg-blue-500 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '로딩 중...' : '전체 데이터 조회'}
        </button>
      </div>

      <div className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">커스텀 쿼리 실행</h2>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded"
            placeholder="SQL 쿼리를 입력하세요"
          />
          <button
            onClick={executeCustomQuery}
            disabled={loading}
            className="px-4 py-2 font-bold text-white bg-green-500 rounded hover:bg-green-700 disabled:opacity-50"
          >
            실행
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 mb-4 text-red-700 bg-red-100 border border-red-400 rounded">
          <strong>오류:</strong> {error}
        </div>
      )}

      {data.length > 0 && (
        <div>
          <h2 className="mb-2 text-xl font-semibold">
            조회 결과 ({data.length}개 행)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(data[0]).map((key) => (
                    <th key={key} className="px-4 py-2 text-left border-b">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {Object.values(row).map((value, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-2 border-b">
                        {value !== null ? String(value) : 'NULL'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.length === 0 && !loading && !error && (
        <div className="py-8 text-center text-gray-500">
          데이터가 없습니다.
        </div>
      )}
    </div>
  );
}
