/**
 * @file App Router 페이지 — 활력징후
 *
 * @description
 * /nursingHome/vital-signs thin wrapper. 실제 UI는 component/nursing-home/pages/vital-signs 를 렌더합니다.
 *
 * @module app/nursingHome/vital-signs/page
 */
import VitalSignsView from '../../../component/nursing-home/pages/vital-signs/VitalSigns'

export default function VitalSignsPage() {
  return <VitalSignsView />
}

