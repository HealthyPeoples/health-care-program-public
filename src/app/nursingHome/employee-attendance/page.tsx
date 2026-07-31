/**
 * @file App Router 페이지 — 직원근태
 *
 * @description
 * /nursingHome/employee-attendance thin wrapper. 실제 UI는 component/nursing-home/pages/employee-attendance 를 렌더합니다.
 *
 * @module app/nursingHome/employee-attendance/page
 */
import EmployeeAttendance from '../../../component/nursing-home/pages/employee-attendance/EmployeeAttendance'

export default function EmployeeAttendancePage() {
  return <EmployeeAttendance />
}

