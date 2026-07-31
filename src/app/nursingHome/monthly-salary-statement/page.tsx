/**
 * @file App Router 페이지 — 월 급여명세서
 *
 * @description
 * /nursingHome/monthly-salary-statement thin wrapper. 실제 UI는 component/nursing-home/pages/monthly-salary-statement 를 렌더합니다.
 *
 * @module app/nursingHome/monthly-salary-statement/page
 */
import MonthlySalaryStatement from '../../../component/nursing-home/pages/monthly-salary-statement/MonthlySalaryStatement'

export default function MonthlySalaryStatementPage() {
  return <MonthlySalaryStatement />
}

