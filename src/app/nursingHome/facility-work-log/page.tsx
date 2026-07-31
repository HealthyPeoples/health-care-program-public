/**
 * @file App Router 페이지 — 시설업무일지
 *
 * @description
 * /nursingHome/facility-work-log thin wrapper. 실제 UI는 component/nursing-home/pages/facility-work-log 를 렌더합니다.
 *
 * @module app/nursingHome/facility-work-log/page
 */
import FacilityWorkLog from '../../../component/nursing-home/pages/facility-work-log/FacilityWorkLog'

export default function FacilityWorkLogPage() {
  return <FacilityWorkLog />
}

