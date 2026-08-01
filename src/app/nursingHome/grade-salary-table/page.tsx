/**
 * @file App Router 페이지 — 등급별급여표
 *
 * @description
 * /nursingHome/grade-salary-table thin wrapper. 실제 UI는 component/nursing-home/pages/grade-salary-table 를 렌더합니다.
 *
 * @module app/nursingHome/grade-salary-table/page
 */
import GradeSalaryTable from '../../../component/nursing-home/pages/grade-salary-table/GradeSalaryTable'

export default function GradeSalaryTablePage() {
  return <GradeSalaryTable />
}

