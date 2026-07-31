/**
 * @file App Router 페이지 — 월 급여자료
 *
 * @description
 * /nursingHome/monthly-salary-data thin wrapper. 실제 UI는 component/nursing-home/pages/monthly-salary-data 를 렌더합니다.
 *
 * @module app/nursingHome/monthly-salary-data/page
 */
import MonthlySalaryData from '../../../component/nursing-home/pages/monthly-salary-data/MonthlySalaryData'

export default function MonthlySalaryDataPage() {
  return <MonthlySalaryData />
}

