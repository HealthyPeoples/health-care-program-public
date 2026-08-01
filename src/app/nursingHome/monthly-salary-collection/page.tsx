/**
 * @file App Router 페이지 — 월 급여수납
 *
 * @description
 * /nursingHome/monthly-salary-collection thin wrapper. 실제 UI는 component/nursing-home/pages/monthly-salary-collection 를 렌더합니다.
 *
 * @module app/nursingHome/monthly-salary-collection/page
 */
import MonthlySalaryCollection from '../../../component/nursing-home/pages/monthly-salary-collection/MonthlySalaryCollection'

export default function MonthlySalaryCollectionPage() {
  return <MonthlySalaryCollection />
}

