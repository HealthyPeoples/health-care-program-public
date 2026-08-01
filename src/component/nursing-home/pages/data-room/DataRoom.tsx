"use client";

/**
 * @file 자료실 — 화면 컴포넌트 (DataRoom.tsx)
 *
 * @description
 * 요양원 자료실 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/data-room
 *
 * @module component/nursing-home/pages/data-room/DataRoom
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";

type DataRoomCategory = "전체" | "공지" | "서식" | "교육" | "기타";

interface AttachedFile {
	drfSeq?: number | null;
	fileName: string;
	sizeText: string;
	fileSize?: number;
	downloadCount: number;
}

interface DataRoomPost {
	id: string;
	drSeq?: number;
	ancd?: string;
	annm?: string;
	category: Exclude<DataRoomCategory, "전체">;
	title: string;
	description: string;
	uploader: string;
	createdAt: string;
	files: AttachedFile[];
	fileCount: number;
	downloadCount: number;
}

type FacilityOption = { ancd: string; annm: string };

const MAX_UPLOAD_FILES = 10;

function classNames(...xs: Array<string | false | null | undefined>) {
	return xs.filter(Boolean).join(" ");
}

function mapApiPost(row: Record<string, unknown>): DataRoomPost {
	const rawFiles = Array.isArray(row.files) ? row.files : [];
	const files: AttachedFile[] = rawFiles.map((f: Record<string, unknown>) => ({
		drfSeq: f.drfSeq == null || f.drfSeq === "" ? null : Number(f.drfSeq),
		fileName: String(f.fileName || ""),
		sizeText: String(f.sizeText || ""),
		fileSize: Number(f.fileSize) || 0,
		downloadCount: Number(f.downloadCount) || 0,
	}));
	return {
		id: String(row.id ?? row.drSeq ?? ""),
		drSeq: typeof row.drSeq === "number" ? row.drSeq : parseInt(String(row.drSeq ?? row.id), 10) || undefined,
		ancd: row.ancd != null ? String(row.ancd) : "",
		annm: row.annm != null ? String(row.annm) : "",
		category: String(row.category || "기타") as Exclude<DataRoomCategory, "전체">,
		title: String(row.title || ""),
		description: String(row.description || ""),
		uploader: String(row.uploader || ""),
		createdAt: String(row.createdAt || ""),
		files,
		fileCount: Number(row.fileCount) || files.length,
		downloadCount: Number(row.downloadCount) || 0,
	};
}

function parseDownloadFileName(res: Response, fallback: string): string {
	const headerName = res.headers.get("X-File-Name");
	if (headerName) {
		try {
			return decodeURIComponent(headerName);
		} catch {
			return headerName;
		}
	}
	const cd = res.headers.get("Content-Disposition") || "";
	const star = cd.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i);
	if (star?.[1]) {
		try {
			return decodeURIComponent(star[1].trim().replace(/^["']|["']$/g, ""));
		} catch {
			/* fall through */
		}
	}
	const plain = cd.match(/filename="([^"]+)"/i) || cd.match(/filename=([^;]+)/i);
	if (plain?.[1]) return plain[1].trim().replace(/^["']|["']$/g, "");
	return fallback || "download";
}

export default function DataRoom() {
	const [category, setCategory] = useState<DataRoomCategory>("전체");
	const [query, setQuery] = useState("");
	const [appliedQuery, setAppliedQuery] = useState("");
	/** 기관 필터: 'all' | ANCD 문자열. 초기 null = 세션 ANCD 로드 전 */
	const [facilityFilter, setFacilityFilter] = useState<string | null>(null);
	const [facilities, setFacilities] = useState<FacilityOption[]>([]);
	const [sessionAncd, setSessionAncd] = useState<string>("");

	const [posts, setPosts] = useState<DataRoomPost[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [listError, setListError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState("");

	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 10;

	const [isUploadOpen, setIsUploadOpen] = useState(false);
	const [isDetailOpen, setIsDetailOpen] = useState(false);

	const [uploadCategory, setUploadCategory] = useState<Exclude<DataRoomCategory, "전체">>("서식");
	const [uploadTitle, setUploadTitle] = useState("");
	const [uploadDesc, setUploadDesc] = useState("");
	const [uploadUploader, setUploadUploader] = useState("");
	const [uploadFiles, setUploadFiles] = useState<File[]>([]);

	const fetchList = useCallback(async () => {
		if (facilityFilter == null) return;
		setLoading(true);
		setListError(null);
		try {
			const qs = new URLSearchParams();
			if (category !== "전체") qs.set("category", category);
			if (appliedQuery.trim()) qs.set("q", appliedQuery.trim());
			qs.set("ancd", facilityFilter === "all" ? "all" : facilityFilter);
			const res = await fetch(`/api/data-room?${qs.toString()}`, {
				cache: "no-store",
				credentials: "include",
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "자료 목록을 불러오지 못했습니다.");
			}
			const list = Array.isArray(json.data) ? json.data.map(mapApiPost) : [];
			setPosts(list);
			if (Array.isArray(json.facilities) && json.facilities.length) {
				setFacilities(
					json.facilities.map((f: { ancd?: unknown; annm?: unknown }) => ({
						ancd: String(f.ancd ?? ""),
						annm: String(f.annm ?? f.ancd ?? ""),
					})),
				);
			}
			if (json.sessionAncd != null && String(json.sessionAncd).trim()) {
				setSessionAncd(String(json.sessionAncd).trim());
			}
		} catch (e) {
			setPosts([]);
			setListError(e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.");
		} finally {
			setLoading(false);
		}
	}, [category, appliedQuery, facilityFilter]);

	useEffect(() => {
		fetchList();
	}, [fetchList]);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch("/api/auth/user-info", { cache: "no-store", credentials: "include" });
				const json = await res.json().catch(() => ({}));
				const user = json?.data || json?.user || {};
				const nm = String(user.empnm || user.EMPNM || "").trim();
				if (nm) setUploadUploader(nm);
				const ancd = String(user.ancd ?? user.ANCD ?? "").trim();
				if (ancd) {
					setSessionAncd(ancd);
					setFacilityFilter((prev) => (prev == null ? ancd : prev));
				} else {
					setFacilityFilter((prev) => (prev == null ? "all" : prev));
				}
			} catch {
				setFacilityFilter((prev) => (prev == null ? "all" : prev));
			}
		})();
	}, []);

	const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
	const safePage = Math.min(Math.max(1, currentPage), totalPages);
	const pagedPosts = useMemo(() => {
		const start = (safePage - 1) * pageSize;
		return posts.slice(start, start + pageSize);
	}, [posts, safePage]);

	useEffect(() => {
		setCurrentPage(1);
	}, [category, appliedQuery, facilityFilter]);

	useEffect(() => {
		if (!posts.length) {
			setSelectedId("");
			return;
		}
		if (!selectedId || !posts.some((f) => f.id === selectedId)) {
			setSelectedId(posts[0].id);
		}
	}, [posts, selectedId]);

	const selectedPost = useMemo(
		() => posts.find((f) => f.id === selectedId) || null,
		[posts, selectedId],
	);

	const handleSearch = () => setAppliedQuery(query);

	const bumpDownloadCounts = (postId: string, fileKeys: AttachedFile[]) => {
		setPosts((prev) =>
			prev.map((p) => {
				if (p.id !== postId) return p;
				const files = p.files.map((f) => {
					const hit = fileKeys.some(
						(x) =>
							(x.drfSeq != null && f.drfSeq === x.drfSeq) ||
							(x.drfSeq == null && f.fileName === x.fileName),
					);
					return hit ? { ...f, downloadCount: f.downloadCount + 1 } : f;
				});
				return {
					...p,
					files,
					downloadCount: files.reduce((acc, f) => acc + f.downloadCount, 0),
				};
			}),
		);
	};

	const fetchFileBlob = async (post: DataRoomPost, file: AttachedFile) => {
		const qs = new URLSearchParams({ download: "1" });
		if (file.drfSeq != null && !Number.isNaN(Number(file.drfSeq))) {
			qs.set("drfSeq", String(file.drfSeq));
		} else if (post.drSeq != null) {
			qs.set("drSeq", String(post.drSeq));
		} else {
			throw new Error("다운로드할 파일을 찾을 수 없습니다.");
		}
		const res = await fetch(`/api/data-room?${qs.toString()}`, {
			credentials: "include",
			cache: "no-store",
		});
		if (!res.ok) {
			const json = await res.json().catch(() => ({}));
			throw new Error(json?.error || "다운로드에 실패했습니다.");
		}
		const blob = await res.blob();
		const fileName = parseDownloadFileName(res, file.fileName || "download");
		return { blob, fileName };
	};

	const triggerBrowserDownload = (blob: Blob, fileName: string) => {
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = fileName;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	};

	const handleDownloadOne = async (post: DataRoomPost, file: AttachedFile) => {
		try {
			const { blob, fileName } = await fetchFileBlob(post, file);
			triggerBrowserDownload(blob, fileName);
			bumpDownloadCounts(post.id, [file]);
		} catch (e) {
			alert(e instanceof Error ? e.message : "다운로드 중 오류가 발생했습니다.");
		}
	};

	const sanitizeZipName = (title: string) => {
		const t = String(title || "자료실")
			.replace(/[\\/:*?"<>|]/g, "_")
			.trim()
			.slice(0, 80);
		return t || "자료실";
	};

	const uniqueZipEntryName = (used: Set<string>, name: string) => {
		let base = String(name || "file").trim() || "file";
		if (!used.has(base)) {
			used.add(base);
			return base;
		}
		const dot = base.lastIndexOf(".");
		const stem = dot > 0 ? base.slice(0, dot) : base;
		const ext = dot > 0 ? base.slice(dot) : "";
		let i = 2;
		while (used.has(`${stem} (${i})${ext}`)) i += 1;
		const next = `${stem} (${i})${ext}`;
		used.add(next);
		return next;
	};

	const handleDownloadAll = async (post: DataRoomPost) => {
		if (!post.files.length) {
			alert("첨부 파일이 없습니다.");
			return;
		}
		if (post.files.length === 1) {
			await handleDownloadOne(post, post.files[0]);
			return;
		}
		setSaving(true);
		try {
			const JSZip = (await import("jszip")).default;
			const zip = new JSZip();
			const used = new Set<string>();
			for (const file of post.files) {
				const { blob, fileName } = await fetchFileBlob(post, file);
				zip.file(uniqueZipEntryName(used, fileName), blob);
			}
			const zipBlob = await zip.generateAsync({ type: "blob" });
			triggerBrowserDownload(zipBlob, `${sanitizeZipName(post.title)}.zip`);
			bumpDownloadCounts(post.id, post.files);
		} catch (e) {
			alert(e instanceof Error ? e.message : "전체 다운로드 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!selectedId) return;
		const row = posts.find((f) => f.id === selectedId);
		const drSeq = row?.drSeq ?? parseInt(selectedId, 10);
		if (!drSeq || Number.isNaN(drSeq)) return;
		if (!confirm("선택한 자료를 삭제하시겠습니까?\n첨부 파일(Blob)도 함께 삭제됩니다.")) return;
		setSaving(true);
		try {
			const res = await fetch("/api/data-room", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ drSeq }),
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "삭제에 실패했습니다.");
			}
			setIsDetailOpen(false);
			await fetchList();
		} catch (e) {
			alert(e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const resetUpload = () => {
		setUploadCategory("서식");
		setUploadTitle("");
		setUploadDesc("");
		setUploadFiles([]);
	};

	const onPickUploadFiles = (list: FileList | null) => {
		if (!list?.length) return;
		const incoming = Array.from(list);
		setUploadFiles((prev) => {
			const merged = [...prev];
			for (const f of incoming) {
				if (merged.length >= MAX_UPLOAD_FILES) break;
				if (merged.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) {
					continue;
				}
				merged.push(f);
			}
			return merged.slice(0, MAX_UPLOAD_FILES);
		});
		if (incoming.length + uploadFiles.length > MAX_UPLOAD_FILES) {
			alert(`파일은 최대 ${MAX_UPLOAD_FILES}개까지 첨부할 수 있습니다.`);
		}
	};

	const removeUploadFile = (idx: number) => {
		setUploadFiles((prev) => prev.filter((_, i) => i !== idx));
	};

	const handleCreate = async () => {
		if (!uploadTitle.trim() || uploadFiles.length === 0) {
			alert("제목과 첨부 파일(1개 이상)을 입력해 주세요.");
			return;
		}
		setSaving(true);
		try {
			const fd = new FormData();
			fd.append("title", uploadTitle.trim());
			fd.append("category", uploadCategory);
			fd.append("description", uploadDesc.trim());
			if (uploadUploader.trim()) fd.append("uploader", uploadUploader.trim());
			uploadFiles.forEach((f) => {
				fd.append("files", f, f.name);
				fd.append("file", f, f.name);
			});

			const res = await fetch("/api/data-room", {
				method: "POST",
				body: fd,
				credentials: "include",
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok || !json?.success) {
				throw new Error(json?.error || "등록에 실패했습니다.");
			}
			alert("등록되었습니다.");
			setIsUploadOpen(false);
			resetUpload();
			await fetchList();
			if (json?.data?.id) setSelectedId(String(json.data.id));
		} catch (e) {
			alert(e instanceof Error ? e.message : "등록 중 오류가 발생했습니다.");
		} finally {
			setSaving(false);
		}
	};

	const renderAttachedFiles = (post: DataRoomPost) => {
		if (!post.files.length) {
			return <div className="text-sm text-blue-900/60 py-2">첨부 파일이 없습니다.</div>;
		}
		return (
			<ul className="space-y-2">
				{post.files.map((f, idx) => (
					<li
						key={f.drfSeq != null ? `f-${f.drfSeq}` : `n-${idx}-${f.fileName}`}
						className="flex flex-wrap items-center gap-2 rounded border border-blue-200 bg-white px-3 py-2"
					>
						<div className="min-w-0 flex-1">
							<div className="text-sm font-medium text-blue-900 break-all">{f.fileName}</div>
							<div className="text-xs text-blue-900/60">
								{f.sizeText} · 다운로드 {f.downloadCount}회
							</div>
						</div>
						<button
							type="button"
							onClick={() => handleDownloadOne(post, f)}
							className="shrink-0 rounded border border-blue-400 bg-blue-200 px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-300"
						>
							다운로드
						</button>
					</li>
				))}
			</ul>
		);
	};

	return (
		<div className="relative min-h-screen bg-white text-black">
			{(loading || saving) && (
				<div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" aria-busy="true">
					<div className="flex flex-col items-center gap-3 rounded-lg border border-blue-200 bg-white px-8 py-6 shadow-lg">
						<div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
						<div className="text-sm font-medium text-blue-900">
							{saving ? "처리 중..." : "자료를 불러오는 중..."}
						</div>
					</div>
				</div>
			)}

			<div className="p-4 space-y-4">
				<div className="flex flex-wrap items-stretch gap-3">
					<div className="flex-1 rounded border border-blue-300 bg-blue-100 px-6 py-4 text-center text-2xl font-semibold text-blue-900">
						자료실
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-2 rounded border border-blue-300 bg-white px-3 py-3">
							<span className="rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900">
								기관
							</span>
							<select
								value={facilityFilter ?? ""}
								onChange={(e) => setFacilityFilter(e.target.value || "all")}
								className="min-w-[180px] rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
							>
								<option value="all">전체</option>
								{facilities.map((f) => (
									<option key={f.ancd} value={f.ancd}>
										{f.annm} ({f.ancd})
									</option>
								))}
								{sessionAncd && !facilities.some((f) => f.ancd === sessionAncd) ? (
									<option value={sessionAncd}>내 기관 ({sessionAncd})</option>
								) : null}
							</select>
						</div>

						<div className="flex items-center gap-2 rounded border border-blue-300 bg-white px-3 py-3">
							<span className="rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900">
								분류
							</span>
							<select
								value={category}
								onChange={(e) => setCategory(e.target.value as DataRoomCategory)}
								className="rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
							>
								<option value="전체">전체</option>
								<option value="공지">공지</option>
								<option value="서식">서식</option>
								<option value="교육">교육</option>
								<option value="기타">기타</option>
							</select>
						</div>

						<div className="flex items-center gap-2 rounded border border-blue-300 bg-white px-3 py-3">
							<span className="rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900">
								검색
							</span>
							<input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSearch();
								}}
								placeholder="제목/설명/파일명/등록자"
								className="w-64 sm:w-80 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 focus:border-blue-500 focus:outline-none"
							/>
							<button
								type="button"
								onClick={handleSearch}
								className="rounded border border-blue-400 bg-blue-200 px-3 py-2 text-sm font-medium text-blue-900 hover:bg-blue-300"
							>
								조회
							</button>
						</div>

						<button
							type="button"
							onClick={() => setIsUploadOpen(true)}
							className="w-28 rounded border border-blue-400 bg-blue-200 px-6 py-3 text-base font-medium text-blue-900 hover:bg-blue-300"
						>
							신규등록
						</button>
					</div>
				</div>

				{listError ? (
					<div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{listError}</div>
				) : null}

				<div className="grid grid-cols-12 gap-3">
					<div className="col-span-12 xl:col-span-7 rounded-lg border border-blue-300 bg-white overflow-hidden">
						<div className="border-b border-blue-200 bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-900 flex items-center justify-between">
							<div>자료 목록</div>
							<div className="text-xs text-blue-900/60">
								총 {posts.length}건 · {safePage}/{totalPages}페이지
							</div>
						</div>
						<div className="max-h-[640px] overflow-auto">
							<table className="w-full text-sm">
								<thead className="sticky top-0 z-10 border-b border-blue-200 bg-blue-50">
									<tr>
										<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">기관</th>
										<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">분류</th>
										<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">제목</th>
										<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">첨부</th>
										<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">등록일</th>
										<th className="border-r border-blue-200 px-3 py-2 text-left font-semibold text-blue-900">등록자</th>
										<th className="px-3 py-2 text-left font-semibold text-blue-900">다운로드</th>
									</tr>
								</thead>
								<tbody>
									{pagedPosts.length === 0 ? (
										<tr>
											<td colSpan={7} className="px-3 py-12 text-center text-blue-900/60">
												{loading || facilityFilter == null ? "불러오는 중..." : "데이터가 없습니다."}
											</td>
										</tr>
									) : (
										pagedPosts.map((p) => {
											const isSelected = p.id === selectedId;
											const attachLabel =
												p.fileCount <= 0
													? "-"
													: p.fileCount === 1
														? p.files[0]?.fileName || "1개"
														: `${p.fileCount}개 파일`;
											const orgLabel = p.annm ? `${p.annm}` : p.ancd || "-";
											return (
												<tr
													key={p.id}
													onClick={() => setSelectedId(p.id)}
													onDoubleClick={() => setIsDetailOpen(true)}
													className={classNames(
														"cursor-pointer border-b border-blue-50 hover:bg-blue-50/60",
														isSelected && "bg-blue-100",
													)}
												>
													<td className="border-r border-blue-100 px-3 py-2" title={p.ancd || ""}>
														{orgLabel}
													</td>
													<td className="border-r border-blue-100 px-3 py-2">{p.category}</td>
													<td className="border-r border-blue-100 px-3 py-2">{p.title}</td>
													<td className="border-r border-blue-100 px-3 py-2 truncate max-w-[180px]" title={attachLabel}>
														{attachLabel}
													</td>
													<td className="border-r border-blue-100 px-3 py-2">{p.createdAt}</td>
													<td className="border-r border-blue-100 px-3 py-2">{p.uploader}</td>
													<td className="px-3 py-2">{p.downloadCount}</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>

						<div className="border-t border-blue-200 bg-blue-50/40 px-3 py-2 flex items-center justify-center">
							<div className="flex items-center gap-2">
								<button type="button" onClick={() => setCurrentPage(1)} disabled={safePage === 1} className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-900 hover:bg-blue-50 disabled:opacity-50">
									처음
								</button>
								<button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-900 hover:bg-blue-50 disabled:opacity-50">
									이전
								</button>
								<div className="text-xs text-blue-900">
									{safePage} / {totalPages}
								</div>
								<button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-900 hover:bg-blue-50 disabled:opacity-50">
									다음
								</button>
								<button type="button" onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages} className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-900 hover:bg-blue-50 disabled:opacity-50">
									마지막
								</button>
							</div>
						</div>
					</div>

					<div className="col-span-12 xl:col-span-5 rounded-lg border border-blue-300 bg-white overflow-hidden">
						<div className="border-b border-blue-200 bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-900 flex items-center justify-between">
							<div>상세 정보</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => selectedId && setIsDetailOpen(true)}
									disabled={!selectedId}
									className="rounded border border-blue-400 bg-blue-200 px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
								>
									상세보기
								</button>
								<button
									type="button"
									onClick={handleDelete}
									disabled={
										!selectedId ||
										saving ||
										!selectedPost ||
										(sessionAncd !== "" && selectedPost.ancd !== "" && selectedPost.ancd !== sessionAncd)
									}
									className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
									title={
										selectedPost && sessionAncd && selectedPost.ancd !== sessionAncd
											? "다른 기관 자료는 삭제할 수 없습니다"
											: undefined
									}
								>
									삭제
								</button>
							</div>
						</div>

						<div className="p-3 space-y-2">
							{!selectedPost ? (
								<div className="py-16 text-center text-blue-900/60">항목을 선택하세요.</div>
							) : (
								<>
									<div className="grid grid-cols-12 gap-2 items-center">
										<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
											기관
										</span>
										<input
											readOnly
											value={
												selectedPost.annm
													? `${selectedPost.annm}${selectedPost.ancd ? ` (${selectedPost.ancd})` : ""}`
													: selectedPost.ancd || "-"
											}
											className="col-span-9 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900"
										/>
									</div>
									<div className="grid grid-cols-12 gap-2 items-center">
										<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
											분류
										</span>
										<input readOnly value={selectedPost.category} className="col-span-9 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900" />
									</div>
									<div className="grid grid-cols-12 gap-2 items-center">
										<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
											제목
										</span>
										<input readOnly value={selectedPost.title} className="col-span-9 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900" />
									</div>
									<div className="grid grid-cols-12 gap-2 items-center">
										<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
											등록일
										</span>
										<input readOnly value={selectedPost.createdAt} className="col-span-4 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900" />
										<span className="col-span-2 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
											등록자
										</span>
										<input readOnly value={selectedPost.uploader} className="col-span-3 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900" />
									</div>
									<div className="grid grid-cols-12 gap-2">
										<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center self-start">
											설명
										</span>
										<textarea readOnly value={selectedPost.description} rows={5} className="col-span-9 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900 resize-none" />
									</div>
									<div className="pt-2 border-t border-blue-200 space-y-2">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div className="text-sm font-semibold text-blue-900">
												첨부 파일 ({selectedPost.fileCount}개)
											</div>
											<button
												type="button"
												disabled={!selectedPost.files.length || saving}
												onClick={() => handleDownloadAll(selectedPost)}
												className="rounded border border-blue-400 bg-blue-200 px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
											>
												전체 다운로드
											</button>
										</div>
										{renderAttachedFiles(selectedPost)}
									</div>
								</>
							)}
						</div>
					</div>
				</div>
			</div>

			{isDetailOpen && selectedPost && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-3xl rounded-lg border border-blue-300 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
						<div className="flex items-center justify-between border-b border-blue-200 bg-blue-100 px-4 py-3 shrink-0">
							<div className="text-base font-semibold text-blue-900">자료 상세</div>
							<button
								type="button"
								onClick={() => setIsDetailOpen(false)}
								className="rounded border border-blue-400 bg-blue-200 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
							>
								닫기
							</button>
						</div>
						<div className="p-4 space-y-3 overflow-y-auto">
							<div className="grid grid-cols-12 gap-2 items-center">
								<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
									제목
								</span>
								<div className="col-span-9 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
									{selectedPost.title}
								</div>
							</div>
							<div className="grid grid-cols-12 gap-2 items-center">
								<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
									등록정보
								</span>
								<div className="col-span-9 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
									{selectedPost.createdAt} · {selectedPost.uploader} · 다운로드 합계 {selectedPost.downloadCount}회
								</div>
							</div>
							<div className="grid grid-cols-12 gap-2">
								<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center self-start">
									설명
								</span>
								<div className="col-span-9 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900 whitespace-pre-wrap min-h-[100px]">
									{selectedPost.description || "-"}
								</div>
							</div>
							<div className="space-y-2 pt-2 border-t border-blue-100">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="text-sm font-semibold text-blue-900">
										첨부 파일 ({selectedPost.fileCount}개)
									</div>
									<button
										type="button"
										disabled={!selectedPost.files.length || saving}
										onClick={() => handleDownloadAll(selectedPost)}
										className="rounded border border-blue-400 bg-blue-200 px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
									>
										전체 다운로드
									</button>
								</div>
								{renderAttachedFiles(selectedPost)}
							</div>
						</div>
					</div>
				</div>
			)}

			{isUploadOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-2xl rounded-lg border border-blue-300 bg-white shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
						<div className="flex items-center justify-between border-b border-blue-200 bg-blue-100 px-4 py-3 shrink-0">
							<div className="text-base font-semibold text-blue-900">자료 등록</div>
							<button
								type="button"
								onClick={() => {
									setIsUploadOpen(false);
									resetUpload();
								}}
								className="rounded border border-blue-400 bg-blue-200 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
							>
								닫기
							</button>
						</div>
						<div className="p-4 space-y-3 overflow-y-auto">
							<div className="grid grid-cols-12 gap-2 items-center">
								<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
									분류
								</span>
								<select
									value={uploadCategory}
									onChange={(e) => setUploadCategory(e.target.value as Exclude<DataRoomCategory, "전체">)}
									className="col-span-9 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900"
								>
									<option value="공지">공지</option>
									<option value="서식">서식</option>
									<option value="교육">교육</option>
									<option value="기타">기타</option>
								</select>
							</div>
							<div className="grid grid-cols-12 gap-2 items-center">
								<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
									제목
								</span>
								<input
									value={uploadTitle}
									onChange={(e) => setUploadTitle(e.target.value)}
									maxLength={200}
									className="col-span-9 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900"
								/>
							</div>
							<div className="grid grid-cols-12 gap-2 items-center">
								<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
									등록자
								</span>
								<input
									value={uploadUploader}
									onChange={(e) => setUploadUploader(e.target.value)}
									maxLength={100}
									className="col-span-9 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900"
								/>
							</div>
							<div className="grid grid-cols-12 gap-2">
								<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center self-start">
									설명
								</span>
								<textarea
									value={uploadDesc}
									onChange={(e) => setUploadDesc(e.target.value)}
									maxLength={2000}
									rows={5}
									className="col-span-9 rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 resize-none"
								/>
							</div>
							<div className="grid grid-cols-12 gap-2 items-start">
								<span className="col-span-3 rounded border border-blue-300 bg-blue-100 px-3 py-2 text-sm font-medium text-blue-900 text-center">
									파일
								</span>
								<div className="col-span-9 space-y-2">
									<input
										type="file"
										multiple
										onChange={(e) => {
											onPickUploadFiles(e.target.files);
											e.target.value = "";
										}}
										className="w-full rounded border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900"
									/>
									<p className="text-xs text-blue-900/70">
										최대 {MAX_UPLOAD_FILES}개 · 장당 50MB · 실행 파일 제외 · 컨테이너 `data-room`
									</p>
									{uploadFiles.length > 0 ? (
										<ul className="space-y-1">
											{uploadFiles.map((f, i) => (
												<li
													key={`${f.name}-${f.size}-${i}`}
													className="flex items-center justify-between gap-2 rounded border border-blue-100 bg-blue-50/50 px-2 py-1.5 text-sm"
												>
													<span className="min-w-0 truncate text-blue-900" title={f.name}>
														{i + 1}. {f.name}
													</span>
													<button
														type="button"
														onClick={() => removeUploadFile(i)}
														className="shrink-0 rounded border border-red-300 bg-white px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
													>
														제거
													</button>
												</li>
											))}
										</ul>
									) : null}
								</div>
							</div>
						</div>
						<div className="flex items-center justify-end gap-2 border-t border-blue-200 bg-blue-50/40 px-4 py-3 shrink-0">
							<button
								type="button"
								onClick={handleCreate}
								disabled={!uploadTitle.trim() || uploadFiles.length === 0 || saving}
								className="rounded border border-blue-400 bg-blue-200 px-6 py-2.5 text-sm font-medium text-blue-900 hover:bg-blue-300 disabled:opacity-50"
							>
								{saving ? "저장 중..." : "저장"}
							</button>
							<button
								type="button"
								onClick={() => {
									setIsUploadOpen(false);
									resetUpload();
								}}
								className="rounded border border-blue-400 bg-blue-200 px-6 py-2.5 text-sm font-medium text-blue-900 hover:bg-blue-300"
							>
								취소
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
