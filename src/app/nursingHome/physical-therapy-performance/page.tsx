/**
 * @file App Router 페이지 — 물리치료실적
 *
 * @description
 * /nursingHome/physical-therapy-performance thin wrapper. 실제 UI는 component/nursing-home/pages/physical-therapy-performance 를 렌더합니다.
 *
 * @module app/nursingHome/physical-therapy-performance/page
 */
import PhysicalTherapyPerformance from '../../../component/nursing-home/pages/physical-therapy-performance/PhysicalTherapyPerformance'

export default function PhysicalTherapyPerformancePage() {
  return <PhysicalTherapyPerformance />
}

