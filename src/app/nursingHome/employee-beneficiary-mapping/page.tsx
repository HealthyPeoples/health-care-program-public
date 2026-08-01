/**
 * @file App Router 페이지 — 직원-수급자 매핑
 *
 * @description
 * /nursingHome/employee-beneficiary-mapping thin wrapper. 실제 UI는 component/nursing-home/pages/employee-beneficiary-mapping 를 렌더합니다.
 *
 * @module app/nursingHome/employee-beneficiary-mapping/page
 */
import EmployeeBeneficiaryMapping from '../../../component/nursing-home/pages/employee-beneficiary-mapping/EmployeeBeneficiaryMapping'

export default function EmployeeBeneficiaryMappingPage() {
  return <EmployeeBeneficiaryMapping />
}

