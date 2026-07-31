/**
 * @file App Router 페이지 — 직원연차
 *
 * @description
 * /nursingHome/employee-annual-leave thin wrapper. 실제 UI는 component/nursing-home/pages/employee-annual-leave 를 렌더합니다.
 *
 * @module app/nursingHome/employee-annual-leave/page
 */
import EmployeeAnnualLeave from '../../../component/nursing-home/pages/employee-annual-leave/EmployeeAnnualLeave'

export default function EmployeeAnnualLeavePage() {
  return <EmployeeAnnualLeave />
}

