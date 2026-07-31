/**
 * @file App Router 페이지 — 직원기본정보
 *
 * @description
 * /nursingHome/employee-basic-info thin wrapper. 실제 UI는 component/nursing-home/pages/employee-basic-info 를 렌더합니다.
 *
 * @module app/nursingHome/employee-basic-info/page
 */
import EmployeeBasicInfo from '../../../component/nursing-home/pages/employee-basic-info/EmployeeBasicInfo'

export default function EmployeeBasicInfoPage() {
  return <EmployeeBasicInfo />
}
