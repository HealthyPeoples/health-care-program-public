/**
 * @file App Router 페이지 — 수급자현황조회
 *
 * @description
 * /nursingHome/beneficiary-status-inquiry thin wrapper. 실제 UI는 component/nursing-home/pages/beneficiary-status-inquiry 를 렌더합니다.
 *
 * @module app/nursingHome/beneficiary-status-inquiry/page
 */
import BeneficiaryStatusInquiry from '../../../component/nursing-home/pages/beneficiary-status-inquiry/BeneficiaryStatusInquiry'

export default function BeneficiaryStatusInquiryPage() {
  return <BeneficiaryStatusInquiry />
}

