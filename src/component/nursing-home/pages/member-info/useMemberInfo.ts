"use client";

import { useEffect, useRef, useState } from 'react';
import {
	NO_ROOM_VALUE,
	attachLatestRoomNoByPnum,
	availableFloorsFromMembers,
	extractMemberFloor,
	normalizeRoomNo,
} from '../../utils/roomNoFloor';
import { buildMemberForEdit, type MemberData } from './MemberInfoUtils';
import {
	buildRecipientCardPrintHtml,
	buildV10010AListPrintHtml,
	openPrintPreviewWindow,
	type V10010APrintRow,
} from './MemberInfoPrint';

export type { MemberData } from './MemberInfoUtils';

export function useMemberInfo() {
	const [members, setMembers] = useState<MemberData[]>([]);
	const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedStatus, setSelectedStatus] = useState<string>('입소');
	const [selectedGrade, setSelectedGrade] = useState<string>('');
	const [selectedFloor, setSelectedFloor] = useState<string>('');
	const [isEditing, setIsEditing] = useState(false);
	const [editedMember, setEditedMember] = useState<MemberData | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [newMember, setNewMember] = useState<MemberData>({});
	const [newMemberDetailAddr, setNewMemberDetailAddr] = useState('');
	const [editedMemberDetailAddr, setEditedMemberDetailAddr] = useState('');
	const [institutions, setInstitutions] = useState<Array<{ANCD: string, ANNM: string}>>([]);
	const hasUnsavedChanges = useRef(false);

	const fetchMembers = async (nameSearch?: string) => {
		setLoading(true);
		setError(null);
		
		try {
			// 이름 검색 파라미터 추가
			const url = nameSearch && nameSearch.trim() !== '' 
				? `/api/f10010?name=${encodeURIComponent(nameSearch.trim())}`
				: '/api/f10010';
			
			const response = await fetch(url);
			const result = await response.json();
			
			if (result.success) {
				const list = Array.isArray(result.data) ? (result.data as MemberData[]) : [];
				const mergedMembers = await attachLatestRoomNoByPnum<MemberData>(list);

				setMembers(mergedMembers);
				setSelectedMember((prev) => {
					if (!prev) return null;
					const found = mergedMembers.find(
						(m) =>
							String(m.ANCD) === String(prev.ANCD) && String(m.PNUM) === String(prev.PNUM)
					);
					return found ?? null;
				});
			} else {
				setError(result.error || '수급자 데이터 조회 실패');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : '알 수 없는 오류');
		} finally {
			setLoading(false);
		}
	};

	const handleMemberSelect = (member: MemberData) => {
		if (isCreating) {
			if (Object.keys(newMember).length > 1 || newMemberDetailAddr.trim() !== '') {
				if (confirm('입력한 내용이 저장되지 않았습니다. 정말 이동하시겠습니까?')) {
					setIsCreating(false);
					setNewMember({});
					setNewMemberDetailAddr('');
					setSelectedMember(member);
					setIsEditing(false);
					setEditedMember(null);
					setEditedMemberDetailAddr('');
				}
			} else {
				setIsCreating(false);
				setNewMember({});
				setNewMemberDetailAddr('');
				setSelectedMember(member);
				setIsEditing(false);
				setEditedMember(null);
				setEditedMemberDetailAddr('');
			}
		} else if (hasUnsavedChanges.current) {
			if (confirm('수정된 내용이 저장되지 않았습니다. 정말 이동하시겠습니까?')) {
				hasUnsavedChanges.current = false;
				setIsEditing(false);
				setEditedMember(null);
				setSelectedMember(member);
			}
		} else {
			setSelectedMember(member);
			setIsEditing(false);
			setEditedMember(null);
		}
	};

	const handleEditClick = () => {
		if (selectedMember) {
			setIsEditing(true);
			setEditedMember(buildMemberForEdit({ ...selectedMember, selectedANCD: selectedMember.ANCD }));
			setEditedMemberDetailAddr('');
			hasUnsavedChanges.current = false;
		}
	};

	const handleSave = async () => {
		if (!editedMember || !selectedMember) return;
		
		setLoading(true);
		try {
			// 주소와 상세주소 합치기
			const fullAddress = editedMember.P_ADDR?.trim() 
				? (editedMember.P_ADDR.trim() + (editedMemberDetailAddr.trim() ? ' ' + editedMemberDetailAddr.trim() : ''))
				: null;

			// 날짜 형식 변환 함수
			const formatDate = (dateStr: string | undefined): string | null => {
				if (!dateStr || dateStr.trim() === '') return null;
				try {
					// YYYY-MM-DD 형식을 검증하고 SQL Server 형식으로 변환
					const date = new Date(dateStr);
					if (isNaN(date.getTime())) return null;
					// YYYY-MM-DD HH:mm:ss 형식으로 변환
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, '0');
					const day = String(date.getDate()).padStart(2, '0');
					return `${year}-${month}-${day} 00:00:00`;
				} catch (err) {
					return null;
				}
			};

			// 선택한 기관의 ANCD 가져오기 (수정 시 변경 가능)
			const selectedANCD = editedMember.selectedANCD || selectedMember.ANCD;
			
			// UPDATE 쿼리 생성
			const updateQuery = `
				UPDATE [돌봄시설DB].[dbo].[F10010]
				SET 
					[ANCD] = @NEW_ANCD,
					[P_NM] = @P_NM,
					[P_BRDT] = @P_BRDT,
					[P_NO] = @P_NO,
					[P_SEX] = @P_SEX,
					[P_ZIP] = @P_ZIP,
					[P_ADDR] = @P_ADDR,
					[P_TEL] = @P_TEL,
					[P_HP] = @P_HP,
					[P_GRD] = @P_GRD,
					[P_YYNO] = @P_YYNO,
					[P_YYDT] = @P_YYDT,
					[P_ST] = @P_ST,
					[P_CINFO] = @P_CINFO,
					[P_CTDT] = @P_CTDT,
					[P_SDT] = @P_SDT,
					[P_EDT] = @P_EDT,
					[HCANUM] = @HCANUM,
					[HCAINFO] = @HCAINFO,
					[HSPT] = @HSPT,
					[DTNM] = @DTNM,
					[DTTEL] = @DTTEL,
					[ETC] = @ETC,
					[P_YYSDT] = @P_YYSDT,
					[P_YYEDT] = @P_YYEDT,
					[P_FLOOR] = @P_FLOOR
				WHERE [ANCD] = @OLD_ANCD AND [PNUM] = @PNUM
			`;
			
			const params = {
				OLD_ANCD: selectedMember.ANCD,
				NEW_ANCD: selectedANCD,
				PNUM: selectedMember.PNUM,
				P_NM: editedMember.P_NM?.trim() || null,
				P_BRDT: formatDate(editedMember.P_BRDT),
				P_NO: editedMember.P_NO?.trim() || null,
				P_SEX: editedMember.P_SEX || null,
				P_ZIP: editedMember.P_ZIP?.trim() || null,
				P_ADDR: fullAddress,
				P_TEL: editedMember.P_TEL?.trim() || null,
				P_HP: editedMember.P_HP?.trim() || null,
				P_GRD: String(editedMember.P_GRD ?? '').trim() || null,
				P_YYNO: editedMember.P_YYNO?.trim() || null,
				P_YYDT: formatDate(editedMember.P_YYDT),
				P_ST: editedMember.P_ST || null,
				P_CINFO: editedMember.P_CINFO?.trim() || null,
				P_CTDT: formatDate(editedMember.P_CTDT),
				P_SDT: formatDate(editedMember.P_SDT),
				P_EDT: formatDate(editedMember.P_EDT),
				HCANUM: editedMember.HCANUM?.trim() || null,
				HCAINFO: editedMember.HCAINFO?.trim() || null,
				HSPT: editedMember.HSPT?.trim() || null,
				DTNM: editedMember.DTNM?.trim() || null,
				DTTEL: editedMember.DTTEL?.trim() || null,
				ETC: editedMember.ETC?.trim() || null,
				P_YYSDT: formatDate(editedMember.P_YYSDT),
				P_YYEDT: formatDate(editedMember.P_YYEDT),
				P_FLOOR: editedMember.P_FLOOR && editedMember.P_FLOOR !== '' ? parseInt(editedMember.P_FLOOR) : null
			};

			const response = await fetch('/api/f10010', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: updateQuery, params })
			});

			const result = await response.json();

			if (result && result.success) {
				alert('저장되었습니다.');
				// 목록 새로고침하여 최신 데이터 가져오기
				await fetchMembers();
				// 수정된 멤버를 다시 선택
				const updatedMember = {
					...editedMember,
					P_ADDR: fullAddress,
					ANCD: selectedMember.ANCD,
					PNUM: selectedMember.PNUM
				};
				setSelectedMember(updatedMember);
				setIsEditing(false);
				setEditedMember(null);
				setEditedMemberDetailAddr('');
				hasUnsavedChanges.current = false;
			} else {
				const errorMessage = result?.error || result?.details || '알 수 없는 오류';
				console.error('수정 실패:', result);
				alert(`저장 실패: ${errorMessage}`);
			}
		} catch (err) {
			console.error('저장 중 오류:', err);
			alert('저장 중 오류가 발생했습니다.');
		} finally {
			setLoading(false);
		}
	};

	const handleCancel = () => {
		if (hasUnsavedChanges.current) {
			if (confirm('수정된 내용이 저장되지 않았습니다. 정말 취소하시겠습니까?')) {
				setIsEditing(false);
				setEditedMember(null);
				setEditedMemberDetailAddr('');
				hasUnsavedChanges.current = false;
			}
		} else {
			setIsEditing(false);
			setEditedMember(null);
			setEditedMemberDetailAddr('');
		}
	};

	const handleDelete = async () => {
		if (!selectedMember) return;
		
		if (confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
			setLoading(true);
			try {
				// DELETE 쿼리 생성
				const deleteQuery = `
					DELETE FROM [돌봄시설DB].[dbo].[F10010]
					WHERE [ANCD] = @ANCD AND [PNUM] = @PNUM
				`;

				const params = {
					ANCD: selectedMember.ANCD,
					PNUM: selectedMember.PNUM
				};

				const response = await fetch('/api/f10010', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ query: deleteQuery, params })
				});

				const result = await response.json();

				if (result && result.success) {
					alert('삭제되었습니다.');
					// 목록 새로고침
					await fetchMembers();
					setSelectedMember(null);
					setIsEditing(false);
					setEditedMember(null);
					setEditedMemberDetailAddr('');
					hasUnsavedChanges.current = false;
				} else {
					const errorMessage = result?.error || result?.details || '알 수 없는 오류';
					console.error('삭제 실패:', result);
					alert(`삭제 실패: ${errorMessage}`);
				}
			} catch (err) {
				console.error('삭제 중 오류:', err);
				alert('삭제 중 오류가 발생했습니다.');
			} finally {
				setLoading(false);
			}
		}
	};

	const handleFieldChange = (field: string, value: any) => {
		hasUnsavedChanges.current = true;
		setEditedMember((prev) => (prev ? { ...prev, [field]: value } : null));
	};

	const handleNewMemberFieldChange = (field: string, value: any) => {
		setNewMember((prev) => ({ ...prev, [field]: value }));
	};

	// 연락처는 P_HP/P_TEL 동시 반영
	const handleNewMemberPhoneChange = (value: string) => {
		setNewMember((prev) => ({ ...prev, P_HP: value, P_TEL: value }));
	};

	const handleEditedMemberPhoneChange = (value: string) => {
		hasUnsavedChanges.current = true;
		setEditedMember((prev) => (prev ? { ...prev, P_HP: value, P_TEL: value } : null));
	};

	const handleNewMemberDetailAddrChange = (value: string) => {
		setNewMemberDetailAddr(value);
	};

	const handleEditedMemberDetailAddrChange = (value: string) => {
		setEditedMemberDetailAddr(value);
		hasUnsavedChanges.current = true;
	};

	// ANCD별 최대 PNUM 조회 및 새 PNUM 생성
	const getNextPNUM = async (ancd: string): Promise<string> => {
		try {
			const response = await fetch('/api/f10010', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: `SELECT ISNULL(MAX(CAST(PNUM AS INT)), 0) + 1 AS NEXT_PNUM 
							FROM [돌봄시설DB].[dbo].[F10010] 
							WHERE ANCD = @ancd`,
					params: { ancd }
				})
			});
			const result = await response.json();
			if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
				return String(result.data[0].NEXT_PNUM);
			}
			// 데이터가 없거나 실패한 경우 기본값 반환
			return '1';
		} catch (err) {
			console.error('PNUM 생성 오류:', err);
			// 오류 발생 시 기본값 반환
			return '1';
		}
	};

	const handleCreateClick = () => {
		setIsCreating(true);
		setNewMember({});
		setNewMemberDetailAddr('');
		setSelectedMember(null);
		setIsEditing(false);
		setEditedMember(null);
		setEditedMemberDetailAddr('');
		hasUnsavedChanges.current = false;
	};

	const handleCreateCancel = () => {
		if (Object.keys(newMember).length > 1 || newMemberDetailAddr.trim() !== '') {
			if (confirm('입력한 내용이 저장되지 않았습니다. 정말 취소하시겠습니까?')) {
				setIsCreating(false);
				setNewMember({});
				setNewMemberDetailAddr('');
			}
		} else {
			setIsCreating(false);
			setNewMember({});
			setNewMemberDetailAddr('');
		}
	};

	const handleCreateSave = async () => {
		if (!newMember.P_NM || newMember.P_NM.trim() === '') {
			alert('수급자명을 입력해주세요.');
			return;
		}

		setLoading(true);
		try {
			// 선택한 기관의 ANCD 가져오기
			const selectedANCD = newMember.selectedANCD || (institutions.length > 0 ? institutions[0].ANCD : '190000');
			if (!selectedANCD) {
				alert('기관을 선택해주세요.');
				setLoading(false);
				return;
			}
			
			// PNUM 자동 생성
			const nextPNUM = await getNextPNUM(selectedANCD);
			
			// 현재 날짜/시간
			const now = new Date();
			const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');

			// INSERT 쿼리 생성
			const insertQuery = `
				INSERT INTO [돌봄시설DB].[dbo].[F10010] (
					[ANCD], [PNUM], [P_NM], [P_BRDT], [P_NO], [P_SEX], 
					[P_ZIP], [P_ADDR], [P_TEL], [P_HP], [P_GRD], 
					[P_YYNO], [P_YYDT], [P_ST], [P_CINFO], 
					[P_CTDT], [P_SDT], [P_EDT], 
					[HCANUM], [HCAINFO], [HSPT], [DTNM], [DTTEL], 
					[INDT], [ETC], [P_YYSDT], [P_YYEDT], [P_FLOOR]
				) VALUES (
					@ANCD, @PNUM, @P_NM, @P_BRDT, @P_NO, @P_SEX,
					@P_ZIP, @P_ADDR, @P_TEL, @P_HP, @P_GRD,
					@P_YYNO, @P_YYDT, @P_ST, @P_CINFO,
					@P_CTDT, @P_SDT, @P_EDT,
					@HCANUM, @HCAINFO, @HSPT, @DTNM, @DTTEL,
					@INDT, @ETC, @P_YYSDT, @P_YYEDT, @P_FLOOR
				)
			`;

			// 날짜 형식 변환 함수
			const formatDate = (dateStr: string | undefined): string | null => {
				if (!dateStr || dateStr.trim() === '') return null;
				try {
					// YYYY-MM-DD 형식을 검증하고 SQL Server 형식으로 변환
					const date = new Date(dateStr);
					if (isNaN(date.getTime())) return null;
					// YYYY-MM-DD HH:mm:ss 형식으로 변환
					const year = date.getFullYear();
					const month = String(date.getMonth() + 1).padStart(2, '0');
					const day = String(date.getDate()).padStart(2, '0');
					return `${year}-${month}-${day} 00:00:00`;
				} catch (err) {
					return null;
				}
			};

			// 주소와 상세주소 합치기
			const fullAddress = newMember.P_ADDR?.trim() 
				? (newMember.P_ADDR.trim() + (newMemberDetailAddr.trim() ? ' ' + newMemberDetailAddr.trim() : ''))
				: null;

			const params = {
				ANCD: selectedANCD,
				PNUM: nextPNUM,
				P_NM: newMember.P_NM?.trim() || null,
				P_BRDT: formatDate(newMember.P_BRDT),
				P_NO: newMember.P_NO?.trim() || null,
				P_SEX: newMember.P_SEX || null,
				P_ZIP: newMember.P_ZIP?.trim() || null,
				P_ADDR: fullAddress,
				P_TEL: newMember.P_TEL?.trim() || null,
				P_HP: newMember.P_HP?.trim() || null,
				P_GRD: String(newMember.P_GRD ?? '').trim() || null,
				P_YYNO: newMember.P_YYNO?.trim() || null,
				P_YYDT: formatDate(newMember.P_YYDT),
				P_ST: newMember.P_ST || null,
				P_CINFO: newMember.P_CINFO?.trim() || null,
				P_CTDT: formatDate(newMember.P_CTDT),
				P_SDT: formatDate(newMember.P_SDT),
				P_EDT: formatDate(newMember.P_EDT),
				HCANUM: newMember.HCANUM?.trim() || null,
				HCAINFO: newMember.HCAINFO?.trim() || null,
				HSPT: newMember.HSPT?.trim() || null,
				DTNM: newMember.DTNM?.trim() || null,
				DTTEL: newMember.DTTEL?.trim() || null,
				INDT: nowStr,
				ETC: newMember.ETC?.trim() || null,
				P_YYSDT: formatDate(newMember.P_YYSDT),
				P_YYEDT: formatDate(newMember.P_YYEDT),
				P_FLOOR: newMember.P_FLOOR && newMember.P_FLOOR !== '' ? parseInt(newMember.P_FLOOR) : null
			};

			const response = await fetch('/api/f10010', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: insertQuery, params })
			});

			const result = await response.json();

			if (result && result.success) {
				alert('수급자가 생성되었습니다.');
				setIsCreating(false);
				setNewMember({});
				setNewMemberDetailAddr('');
				// 목록 새로고침
				await fetchMembers();
			} else {
				const errorMessage = result?.error || result?.details || '알 수 없는 오류';
				console.error('수급자 생성 실패:', result);
				alert(`수급자 생성 실패: ${errorMessage}`);
			}
		} catch (err) {
			console.error('수급자 생성 오류:', err);
			alert('수급자 생성 중 오류가 발생했습니다.');
		} finally {
			setLoading(false);
		}
	};

	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	const availableFloors = availableFloorsFromMembers(members);

	const noRoomCount = members.filter((m) => normalizeRoomNo(m?.ROOM_NO) === '').length;

	// 클라이언트 측 추가 필터링 (서버에서 이미 이름으로 필터링됨)
	// 모든 필터 조건을 AND로 결합하여 적용
	const filteredMembers = members.filter(member => {
		// 상태 필터링
		if (selectedStatus) {
			const memberStatus = String(member.P_ST || '').trim();
			if (selectedStatus === '입소' && memberStatus !== '1') {
				return false;
			}
			if (selectedStatus === '퇴소' && memberStatus !== '9') {
				return false;
			}
		}
		
		// 등급 필터링
		if (selectedGrade) {
			const memberGrade = String(member.P_GRD || '').trim();
			const selectedGradeTrimmed = String(selectedGrade).trim();
			if (memberGrade !== selectedGradeTrimmed) {
				return false;
			}
		}
		
		// 층수 필터링
		if (selectedFloor) {
			if (selectedFloor === NO_ROOM_VALUE) {
				if (normalizeRoomNo(member?.ROOM_NO) !== '') return false;
			} else {
				const memberFloor = extractMemberFloor(member);
				const selectedFloorNum = Number(String(selectedFloor).trim());
				if (!Number.isFinite(selectedFloorNum) || memberFloor !== selectedFloorNum) {
					return false;
				}
			}
		}
		
		// 검색어 필터링 (검색어가 있을 때만 적용)
		if (searchTerm && searchTerm.trim() !== '') {
			const searchLower = searchTerm.toLowerCase().trim();
			const matchesSearch = (
				member.P_NM?.toLowerCase().includes(searchLower) ||
				member.P_TEL?.includes(searchTerm) ||
				member.P_HP?.includes(searchTerm) ||
				String(member.ANCD || '').includes(searchTerm) ||
				String(member.PNUM || '').includes(searchTerm)
			);
			if (!matchesSearch) {
				return false;
			}
		}
		
		// 모든 필터 조건을 통과한 경우만 true 반환
		return true;
	}).sort((a, b) => {
		// 이름 가나다순 정렬
		const nameA = (a.P_NM || '').trim();
		const nameB = (b.P_NM || '').trim();
		return nameA.localeCompare(nameB, 'ko');
	});

	// 페이지네이션 계산
	const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const currentMembers = filteredMembers.slice(startIndex, endIndex);

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	// 필터 변경 시 첫 페이지로
	const handleStatusChange = (value: string) => {
		setSelectedStatus(value);
		setCurrentPage(1);
	};

	const handleGradeChange = (value: string) => {
		setSelectedGrade(value);
		setCurrentPage(1);
	};

	const handleFloorChange = (value: string) => {
		setSelectedFloor(value);
		setCurrentPage(1);
	};

	const handleSearchTermChange = (value: string) => {
		setSearchTerm(value);
	};

	const handleSearch = () => {
		setCurrentPage(1);
		fetchMembers(searchTerm);
	};

	// F00110 테이블에서 기관 목록 가져오기
	const fetchInstitutions = async () => {
		try {
			const response = await fetch('/api/f00110');
			const result = await response.json();
			if (result.success && result.data) {
				// ANCD와 ANNM만 추출
				const institutionList = result.data.map((item: any) => ({
					ANCD: item.ANCD,
					ANNM: item.ANNM || ''
				})).filter((item: any) => item.ANCD && item.ANNM); // ANCD와 ANNM이 있는 것만
				setInstitutions(institutionList);
			}
		} catch (err) {
			console.error('기관 목록 조회 오류:', err);
		}
	};

	useEffect(() => {
		fetchMembers();
		fetchInstitutions();
	}, []);

	// 다음 주소 API 스크립트 로드
	useEffect(() => {
		const script = document.createElement('script');
		script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
		script.async = true;
		document.body.appendChild(script);

		return () => {
			document.body.removeChild(script);
		};
	}, []);

	// 주소 검색 함수
	const handleAddressSearch = (isNewMember: boolean = false) => {
		if (typeof window === 'undefined' || !(window as any).daum || !(window as any).daum.Postcode) {
			alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
			return;
		}

		new (window as any).daum.Postcode({
			oncomplete: function(data: any) {
				const zipCode = data.zonecode;
				const address = data.address;
				const extraAddress = data.addressType === 'R' ? data.bname + data.buildingName : '';

				if (isNewMember) {
					setNewMember((prev) => ({
						...prev,
						P_ZIP: zipCode,
						P_ADDR: address + (extraAddress ? ' ' + extraAddress : '')
					}));
					setNewMemberDetailAddr(''); // 상세주소 초기화
				} else {
					setEditedMember((prev) => {
						if (!prev) return null;
						return {
							...prev,
							P_ZIP: zipCode,
							P_ADDR: address + (extraAddress ? ' ' + extraAddress : '')
						};
					});
					setEditedMemberDetailAddr(''); // 상세주소 초기화
					hasUnsavedChanges.current = true;
				}
			}
		}).open();
	};

	// 화면 이탈 시 알림
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (hasUnsavedChanges.current) {
				e.preventDefault();
				e.returnValue = '';
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	}, []);

	// 검색어가 변경될 때 페이지를 1로 초기화
	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm]);

	// 필터 변경 시 페이지 초기화
	useEffect(() => {
		setCurrentPage(1);
	}, [selectedStatus, selectedGrade, selectedFloor]);

	const handlePrintRecipientCard = async () => {
		if (!selectedMember) return;

		const pnum = String(selectedMember.PNUM ?? '').trim();
		if (!pnum) {
			alert('선택된 수급자 번호가 없습니다.');
			return;
		}

		try {
			const res = await fetch(`/api/v10010c?pnum=${encodeURIComponent(pnum)}`);
			const json = await res.json();
			if (!json.success) {
				alert(json.error || 'V10010C(수급자카드) 조회에 실패했습니다.');
				return;
			}
			const card = json.data;
			if (!card) {
				alert('선택한 수급자의 카드 데이터를 찾을 수 없습니다.');
				return;
			}

			const instName =
				institutions.find((i) => String(i.ANCD) === String(selectedMember.ANCD))?.ANNM ||
				String(selectedMember.ANCD ?? '');

			const html = buildRecipientCardPrintHtml(selectedMember, card, instName);
			openPrintPreviewWindow(html);
		} catch (e) {
			console.error(e);
			alert(e instanceof Error ? e.message : '수급자카드 출력 중 오류가 발생했습니다.');
		}
	};

	const handlePrintAllMembers = async () => {
		try {
			const statusParam =
				selectedStatus === '입소' || selectedStatus === '퇴소'
					? `?status=${encodeURIComponent(selectedStatus)}`
					: '';
			const res = await fetch(`/api/v10010a${statusParam}`);
			const json = await res.json();
			if (!json.success) {
				alert(json.error || 'V10010A(수급자 목록) 조회에 실패했습니다.');
				return;
			}
			let list: V10010APrintRow[] = Array.isArray(json.data) ? json.data : [];

			const nameQ = String(searchTerm || '').trim().toLowerCase();
			if (nameQ) {
				list = list.filter((r) => String(r.name || '').toLowerCase().includes(nameQ));
			}
			if (selectedGrade) {
				list = list.filter((r) => {
					const g = String(r.grade || '');
					if (selectedGrade === '9') return g.includes('인지');
					return g.includes(`${selectedGrade}등급`) || g.startsWith(selectedGrade);
				});
			}

			if (list.length === 0) {
				alert('출력할 수급자 데이터가 없습니다.');
				return;
			}

			const instName =
				institutions.find((i) => String(i.ANCD) === String(selectedMember?.ANCD ?? ''))?.ANNM ||
				institutions[0]?.ANNM ||
				'';
			const html = buildV10010AListPrintHtml(list, instName);
			openPrintPreviewWindow(html);
		} catch (e) {
			console.error(e);
			alert(e instanceof Error ? e.message : '수급자 전체 출력 중 오류가 발생했습니다.');
		}
	};

	return {
		members,
		selectedMember,
		loading,
		error,
		searchTerm,
		selectedStatus,
		selectedGrade,
		selectedFloor,
		isEditing,
		editedMember,
		isCreating,
		newMember,
		newMemberDetailAddr,
		editedMemberDetailAddr,
		institutions,
		availableFloors,
		noRoomCount,
		noRoomValue: NO_ROOM_VALUE,
		filteredMembers,
		currentMembers,
		currentPage,
		totalPages,
		fetchMembers,
		handleMemberSelect,
		handleEditClick,
		handleSave,
		handleCancel,
		handleDelete,
		handleFieldChange,
		handleNewMemberFieldChange,
		handleNewMemberPhoneChange,
		handleEditedMemberPhoneChange,
		handleNewMemberDetailAddrChange,
		handleEditedMemberDetailAddrChange,
		handleCreateClick,
		handleCreateCancel,
		handleCreateSave,
		handlePageChange,
		handleStatusChange,
		handleGradeChange,
		handleFloorChange,
		handleSearchTermChange,
		handleSearch,
		handleAddressSearch,
		handlePrintRecipientCard,
		handlePrintAllMembers,
	};
}
