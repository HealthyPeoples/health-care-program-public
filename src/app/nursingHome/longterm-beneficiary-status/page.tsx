/**
 * @file App Router 페이지 — 장기요양수급자현황
 *
 * @description
 * /nursingHome/longterm-beneficiary-status thin wrapper. 실제 UI는 component/nursing-home/pages/longterm-beneficiary-status 를 렌더합니다.
 *
 * @module app/nursingHome/longterm-beneficiary-status/page
 */
import LongtermBeneficiaryStatus from '../../../component/nursing-home/pages/longterm-beneficiary-status/LongtermBeneficiaryStatus'

export default function LongtermBeneficiaryStatusPage() {
  return <LongtermBeneficiaryStatus />
}