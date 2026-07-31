/**
 * @file App Router 페이지 — 직원직무교육
 *
 * @description
 * /nursingHome/employee-job-training thin wrapper. 실제 UI는 component/nursing-home/pages/employee-job-training 를 렌더합니다.
 *
 * @module app/nursingHome/employee-job-training/page
 */
import EmployeeJobTraining from '../../../component/nursing-home/pages/employee-job-training/EmployeeJobTraining'

export default function EmployeeJobTrainingPage() {
  return <EmployeeJobTraining />
}

