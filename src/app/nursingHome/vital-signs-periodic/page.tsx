/**
 * @file App Router 페이지 — 활력징후(정기)
 *
 * @description
 * /nursingHome/vital-signs-periodic thin wrapper. 실제 UI는 component/nursing-home/pages/vital-signs-periodic 를 렌더합니다.
 *
 * @module app/nursingHome/vital-signs-periodic/page
 */
import VitalSignsPeriodicView from '../../../component/nursing-home/pages/vital-signs-periodic/VitalSignsPeriodic'

export default function VitalSignsPeriodicPage() {
  return <VitalSignsPeriodicView />
}

