/**
 * @file App Router 페이지 — 시설업무일지 결재
 *
 * @description
 * /nursingHome/facility-work-log-approval thin wrapper. 실제 UI는 component/nursing-home/pages/facility-work-log-approval 를 렌더합니다.
 *
 * @module app/nursingHome/facility-work-log-approval/page
 */
import FacilityWorkLogApproval from '../../../component/nursing-home/pages/facility-work-log-approval/FacilityWorkLogApproval'

export default function FacilityWorkLogApprovalPage() {
  return <FacilityWorkLogApproval />
}

