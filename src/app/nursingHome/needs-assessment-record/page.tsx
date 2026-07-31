/**
 * @file App Router 페이지 — 욕구사정기록
 *
 * @description
 * /nursingHome/needs-assessment-record thin wrapper. 실제 UI는 component/nursing-home/pages/needs-assessment-record 를 렌더합니다.
 *
 * @module app/nursingHome/needs-assessment-record/page
 */
import NeedsAssessmentRecord from '../../../component/nursing-home/pages/needs-assessment-record/NeedsAssessmentRecord'

export default function NeedsAssessmentRecordPage() {
  return <NeedsAssessmentRecord />
}

