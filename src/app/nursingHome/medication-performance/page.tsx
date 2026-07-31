/**
 * @file App Router 페이지 — 투약실적
 *
 * @description
 * /nursingHome/medication-performance thin wrapper. 실제 UI는 component/nursing-home/pages/medication-performance 를 렌더합니다.
 *
 * @module app/nursingHome/medication-performance/page
 */
import MedicationPerformance from '../../../component/nursing-home/pages/medication-performance/MedicationPerformance'

export default function MedicationPerformancePage() {
  return <MedicationPerformance />
}

