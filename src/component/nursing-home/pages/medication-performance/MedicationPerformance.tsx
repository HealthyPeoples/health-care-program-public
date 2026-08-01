"use client";

/**
 * @file 투약실적 — 화면 컴포넌트 (MedicationPerformance.tsx)
 *
 * @description
 * 요양원 투약실적 기능의 화면 컴포넌트입니다. 폴더: component/nursing-home/pages/medication-performance
 *
 * @module component/nursing-home/pages/medication-performance/MedicationPerformance
 */
import MedicationRegistration from "../medication-registration/MedicationRegistration";

/** 약물복용실적 등록 — 기존 수급자 복용약물 등록 화면을 사용 */
export default function MedicationPerformance() {
	return <MedicationRegistration />;
}
