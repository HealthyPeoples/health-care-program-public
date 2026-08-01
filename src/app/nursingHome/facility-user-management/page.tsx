/**
 * @file App Router 페이지 — 시설사용자관리
 *
 * @description
 * /nursingHome/facility-user-management thin wrapper. 실제 UI는 component/nursing-home/pages/facility-user-management 를 렌더합니다.
 *
 * @module app/nursingHome/facility-user-management/page
 */
import FacilityUserManagement from '../../../component/nursing-home/pages/facility-user-management/FacilityUserManagement'

export default function FacilityUserManagementPage() {
  return <FacilityUserManagement />
}

