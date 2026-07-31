/**
 * @file App Router 페이지 — 욕창관리
 *
 * @description
 * /nursingHome/bedsore-management thin wrapper. 실제 UI는 component/nursing-home/pages/bedsore-management 를 렌더합니다.
 *
 * @module app/nursingHome/bedsore-management/page
 */
import BedsoreManagement from '../../../component/nursing-home/pages/bedsore-management/BedsoreManagement'

export default function BedsoreManagementPage() {
  return <BedsoreManagement />
}

