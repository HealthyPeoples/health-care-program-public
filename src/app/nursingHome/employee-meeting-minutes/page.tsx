/**
 * @file App Router 페이지 — 직원회의록
 *
 * @description
 * /nursingHome/employee-meeting-minutes thin wrapper. 실제 UI는 component/nursing-home/pages/employee-meeting-minutes 를 렌더합니다.
 *
 * @module app/nursingHome/employee-meeting-minutes/page
 */
import EmployeeMeetingMinutes from '../../../component/nursing-home/pages/employee-meeting-minutes/EmployeeMeetingMinutes'

export default function EmployeeMeetingMinutesPage() {
  return <EmployeeMeetingMinutes />
}

