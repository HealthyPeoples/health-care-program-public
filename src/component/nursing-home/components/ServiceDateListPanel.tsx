"use client";

/**
 * @file 서비스제공일자 목록 패널
 */
import { formatDateDisplay } from '../utils/f14020Daily';

type ServiceDateListPanelProps = {
	selectedMember: boolean;
	serviceDates: string[];
	selectedDateIndex: number | null;
	loading?: boolean;
	page: number;
	itemsPerPage?: number;
	onSelectDate: (index: number) => void;
	onPageChange: (page: number) => void;
};

export function ServiceDateListPanel({
	selectedMember,
	serviceDates,
	selectedDateIndex,
	loading = false,
	page,
	itemsPerPage = 10,
	onSelectDate,
	onPageChange
}: ServiceDateListPanelProps) {
	const totalPages = Math.max(1, Math.ceil(serviceDates.length / itemsPerPage));
	const startIndex = (page - 1) * itemsPerPage;
	const currentItems = serviceDates.slice(startIndex, startIndex + itemsPerPage);

	return (
		<div className="flex flex-col w-full lg:w-[220px] min-w-0 shrink-0 px-3 py-3 border border-blue-300 rounded-lg bg-blue-50 max-h-[30vh] lg:max-h-none min-h-0 overflow-hidden">
			<div className="mb-2 shrink-0">
				<label className="text-sm font-medium text-blue-900">서비스제공일자</label>
			</div>
			<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
				<div className="flex-1 min-h-0 overflow-y-auto">
					{loading ? (
						<div className="px-2 py-1 text-sm text-blue-900/60">로딩 중...</div>
					) : serviceDates.length === 0 ? (
						<div className="px-2 py-1 text-sm text-blue-900/60">
							{selectedMember ? '서비스제공일자가 없습니다' : '수급자를 선택해주세요'}
						</div>
					) : (
						currentItems.map((date, localIndex) => {
							const globalIndex = startIndex + localIndex;
							return (
								<div
									key={`${date}-${globalIndex}`}
									onClick={() => onSelectDate(globalIndex)}
									className={`px-2 py-1.5 text-sm cursor-pointer hover:bg-blue-100 rounded ${
										selectedDateIndex === globalIndex ? 'bg-blue-200 font-semibold' : ''
									}`}
								>
									{formatDateDisplay(date)}
								</div>
							);
						})
					)}
				</div>
				{serviceDates.length > itemsPerPage && (
					<div className="p-2 mt-2">
						<div className="flex items-center justify-center gap-1">
							<button
								type="button"
								onClick={() => onPageChange(1)}
								disabled={page === 1}
								className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
							>
								&lt;&lt;
							</button>
							<button
								type="button"
								onClick={() => onPageChange(Math.max(1, page - 1))}
								disabled={page === 1}
								className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
							>
								&lt;
							</button>
							{(() => {
								const pagesToShow = Math.min(5, totalPages);
								const startPage = Math.max(1, Math.min(totalPages - 4, page - 2));
								return Array.from({ length: pagesToShow }, (_, i) => {
									const pageNum = startPage + i;
									if (pageNum > totalPages) return null;
									return (
										<button
											type="button"
											key={pageNum}
											onClick={() => onPageChange(pageNum)}
											className={`px-2 py-1 text-xs border rounded ${
												page === pageNum
													? 'bg-blue-500 text-white border-blue-500'
													: 'border-blue-300 hover:bg-blue-50'
											}`}
										>
											{pageNum}
										</button>
									);
								});
							})()}
							<button
								type="button"
								onClick={() => onPageChange(Math.min(totalPages, page + 1))}
								disabled={page >= totalPages}
								className="px-2 py-1 text-xs border border-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50"
							>
								&gt;
							</button>
							<button
								type="button"
								onClick={() => onPageChange(totalPages)}
								disabled={page >= totalPages}
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
