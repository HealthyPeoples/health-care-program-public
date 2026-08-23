"use client";

/**
 * @file 직원 검색 입력 — 이름 검색 후 드롭다운에서 선택
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type EmployeeSuggest = {
	EMPNO: string | number;
	EMPNM: string;
	JOB?: string;
};

type Props = {
	value: string;
	onChange: (name: string, empno?: string) => void;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
	inputClassName?: string;
};

export function EmployeeSearchInput({
	value,
	onChange,
	disabled = false,
	placeholder = '직원 검색',
	className = '',
	inputClassName = '',
}: Props) {
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [suggestions, setSuggestions] = useState<EmployeeSuggest[]>([]);
	const [menuRect, setMenuRect] = useState<DOMRect | null>(null);

	const updateMenuRect = () => {
		const el = inputRef.current;
		if (!el) return;
		setMenuRect(el.getBoundingClientRect());
	};

	useEffect(() => {
		if (disabled || !open) return undefined;
		const q = String(value || '').trim();
		if (q.length < 1) {
			setSuggestions([]);
			setLoading(false);
			return undefined;
		}

		const timer = window.setTimeout(async () => {
			setLoading(true);
			try {
				const res = await fetch(`/api/f01010?name=${encodeURIComponent(q)}`);
				const json = await res.json();
				if (json?.success && Array.isArray(json.data)) {
					const list = json.data
						.map((row: any) => ({
							EMPNO: row.EMPNO,
							EMPNM: String(row.EMPNM ?? '').trim(),
							JOB: row.JOB != null ? String(row.JOB).trim() : '',
						}))
						.filter((row: EmployeeSuggest) => row.EMPNM);
					setSuggestions(list);
				} else {
					setSuggestions([]);
				}
			} catch (err) {
				console.error('직원 검색 오류:', err);
				setSuggestions([]);
			} finally {
				setLoading(false);
			}
		}, 250);

		return () => window.clearTimeout(timer);
	}, [value, open, disabled]);

	useEffect(() => {
		if (!open) return undefined;
		updateMenuRect();
		const onReposition = () => updateMenuRect();
		const onMouseDown = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (wrapRef.current?.contains(target)) return;
			const menu = document.getElementById('employee-search-dropdown');
			if (menu?.contains(target)) return;
			setOpen(false);
		};
		window.addEventListener('scroll', onReposition, true);
		window.addEventListener('resize', onReposition);
		document.addEventListener('mousedown', onMouseDown);
		return () => {
			window.removeEventListener('scroll', onReposition, true);
			window.removeEventListener('resize', onReposition);
			document.removeEventListener('mousedown', onMouseDown);
		};
	}, [open]);

	const pick = (emp: EmployeeSuggest) => {
		onChange(emp.EMPNM, emp.EMPNO != null ? String(emp.EMPNO) : undefined);
		setOpen(false);
		setSuggestions([]);
	};

	const menu =
		!disabled && open && typeof document !== 'undefined' && menuRect
			? createPortal(
					<div
						id="employee-search-dropdown"
						className="fixed z-[80] overflow-y-auto rounded border border-blue-300 bg-white shadow-lg max-h-44 min-w-[180px]"
						style={{
							top: menuRect.bottom + 4,
							left: Math.min(
								Math.max(8, menuRect.left),
								window.innerWidth - Math.max(menuRect.width, 180) - 8
							),
							width: Math.max(menuRect.width, 180),
						}}
						onMouseDown={(e) => e.stopPropagation()}
					>
						{loading ? (
							<div className="px-3 py-2 text-xs text-blue-900/60">검색 중...</div>
						) : suggestions.length === 0 ? (
							<div className="px-3 py-2 text-xs text-blue-900/60">검색 결과 없음</div>
						) : (
							suggestions.map((emp, index) => (
								<button
									key={`${emp.EMPNO}-${index}`}
									type="button"
									onClick={() => pick(emp)}
									className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs border-b border-blue-50 last:border-b-0 hover:bg-blue-50"
								>
									<span className="font-medium text-blue-900">{emp.EMPNM}</span>
									<span className="shrink-0 text-blue-900/60">
										{emp.JOB || (emp.EMPNO != null ? `사번 ${emp.EMPNO}` : '')}
									</span>
								</button>
							))
						)}
					</div>,
					document.body
				)
			: null;

	return (
		<div ref={wrapRef} className={`relative ${className}`}>
			<input
				ref={inputRef}
				type="text"
				value={value}
				autoComplete="off"
				placeholder={disabled ? '' : placeholder}
				disabled={disabled}
				onChange={(e) => {
					onChange(e.target.value);
					if (!disabled) {
						setOpen(true);
						updateMenuRect();
					}
				}}
				onFocus={() => {
					if (disabled) return;
					setOpen(true);
					updateMenuRect();
				}}
				onClick={(e) => e.stopPropagation()}
				className={inputClassName}
			/>
			{menu}
		</div>
	);
}
