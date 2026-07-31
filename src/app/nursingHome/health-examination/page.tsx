/**
 * @file App Router 페이지 — 건강검진
 *
 * @description
 * /nursingHome/health-examination thin wrapper. 실제 UI는 component/nursing-home/pages/health-examination 를 렌더합니다.
 *
 * @module app/nursingHome/health-examination/page
 */
import HealthExamination from '../../../component/nursing-home/pages/health-examination/HealthExamination'

export default function HealthExaminationPage() {
  return <HealthExamination />
}

