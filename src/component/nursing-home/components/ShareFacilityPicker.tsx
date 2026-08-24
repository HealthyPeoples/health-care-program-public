"use client";

/**
 * @file ShareFacilityPicker.tsx
 *
 * @description
 * 자료실·공지 등록 시 공유 기관(자체 / 선택 / 전체)을 고르는 공통 컴포넌트입니다.
 *
 * @module component/nursing-home/components/ShareFacilityPicker
 */
import React from "react";

export type FacilityOption = { ancd: string; annm: string };
export type ShareScope = "1" | "2" | "3";

export type ShareFacilityValue = {
	scope: ShareScope;
	ancds: string[];
};

export const DEFAULT_SHARE_OWN: ShareFacilityValue = { scope: "1", ancds: [] };
export const DEFAULT_SHARE_ALL: ShareFacilityValue = { scope: "3", ancds: [] };

export function formatShareLabel(
	scope: string | null | undefined,
	ancds: Array<string | number> | null | undefined,
	facilities: FacilityOption[] = [],
): string {
	const s = String(scope || "1").trim().slice(0, 1);
	if (s === "3") return "전체 기관";
	if (s === "2") {
		const names = (ancds || []).map((a) => {
			const key = String(a ?? "").trim();
			const f = facilities.find((x) => x.ancd === key);
			return f ? f.annm : key;
		}).filter(Boolean);
		return names.length ? names.join(", ") : "선택 기관";
	}
	return "자체(등록 기관만)";
}

type Props = {
	facilities: FacilityOption[];
	sessionAncd?: string;
	value: ShareFacilityValue;
	onChange?: (next: ShareFacilityValue) => void;
	disabled?: boolean;
	readOnly?: boolean;
	inputName?: string;
};

export default function ShareFacilityPicker({
	facilities,
	sessionAncd = "",
	value,
	onChange,
	disabled = false,
	readOnly = false,
	inputName = "share-scope",
}: Props) {
	const locked = disabled || readOnly || !onChange;
	const others = facilities.filter((f) => f.ancd && f.ancd !== sessionAncd);

	const setScope = (scope: ShareScope) => {
		if (locked) return;
		onChange?.({ scope, ancds: scope === "2" ? value.ancds : [] });
	};

	const toggleAncd = (ancd: string) => {
		if (locked) return;
		const has = value.ancds.includes(ancd);
		const ancds = has ? value.ancds.filter((x) => x !== ancd) : [...value.ancds, ancd];
		onChange?.({ scope: "2", ancds });
	};

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-4">
				<label className="inline-flex items-center gap-1.5 text-sm text-blue-900">
					<input
						type="radio"
						name={inputName}
						checked={value.scope === "1"}
						disabled={locked}
						onChange={() => setScope("1")}
					/>
					자체
				</label>
				<label className="inline-flex items-center gap-1.5 text-sm text-blue-900">
					<input
						type="radio"
						name={inputName}
						checked={value.scope === "2"}
						disabled={locked}
						onChange={() => setScope("2")}
					/>
					선택 기관
				</label>
				<label className="inline-flex items-center gap-1.5 text-sm text-blue-900">
					<input
						type="radio"
						name={inputName}
						checked={value.scope === "3"}
						disabled={locked}
						onChange={() => setScope("3")}
					/>
					전체 기관
				</label>
			</div>

			{value.scope === "2" ? (
				<div className="max-h-40 overflow-auto rounded border border-blue-200 bg-white">
					{others.length === 0 ? (
						<div className="px-3 py-2 text-xs text-blue-900/60">선택할 다른 기관이 없습니다.</div>
					) : (
						<ul className="divide-y divide-blue-50">
							{others.map((f) => (
								<li key={f.ancd}>
									<label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-blue-900 hover:bg-blue-50/60">
										<input
											type="checkbox"
											checked={value.ancds.includes(f.ancd)}
											disabled={locked}
											onChange={() => toggleAncd(f.ancd)}
										/>
										<span>
											{f.annm} ({f.ancd})
										</span>
									</label>
								</li>
							))}
						</ul>
					)}
				</div>
			) : null}

			<p className="text-xs text-blue-900/70">등록 기관은 항상 조회할 수 있습니다. 선택된 기관만 목록에 표시됩니다.</p>
		</div>
	);
}
