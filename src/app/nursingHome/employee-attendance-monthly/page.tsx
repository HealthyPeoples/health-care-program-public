/**
 * @file App Router 페이지 — 직원근태(월간)
 *
 * @description
 * /nursingHome/employee-attendance-monthly thin wrapper. 실제 UI는 component/nursing-home/pages/employee-attendance-monthly 를 렌더합니다.
 *
 * @module app/nursingHome/employee-attendance-monthly/page
 */
import EmployeeAttendanceMonthly from '../../../component/nursing-home/pages/employee-attendance-monthly/EmployeeAttendanceMonthly'

export default function EmployeeAttendanceMonthlyPage() {
  return <EmployeeAttendanceMonthly />
}

