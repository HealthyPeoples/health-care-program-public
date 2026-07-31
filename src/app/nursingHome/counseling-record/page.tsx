/**
 * @file App Router 페이지 — 상담기록
 *
 * @description
 * /nursingHome/counseling-record thin wrapper. 실제 UI는 component/nursing-home/pages/counseling-record 를 렌더합니다.
 *
 * @module app/nursingHome/counseling-record/page
 */
import CounselingRecordView from '../../../component/nursing-home/pages/counseling-record/CounselingRecord'

export default function CounselingRecordPage() {
  return <CounselingRecordView />
}

