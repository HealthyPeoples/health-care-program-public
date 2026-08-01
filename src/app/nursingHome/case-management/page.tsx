/**
 * @file App Router 페이지 — 사례관리
 *
 * @description
 * /nursingHome/case-management thin wrapper. 실제 UI는 component/nursing-home/pages/case-management 를 렌더합니다.
 *
 * @module app/nursingHome/case-management/page
 */
import CaseManagement from '../../../component/nursing-home/pages/case-management/CaseManagement'

export default function CaseManagementPage() {
  return <CaseManagement />
}

