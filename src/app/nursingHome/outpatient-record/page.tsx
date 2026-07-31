/**
 * @file App Router 페이지 — 외래진료기록
 *
 * @description
 * /nursingHome/outpatient-record thin wrapper. 실제 UI는 component/nursing-home/pages/outpatient-record 를 렌더합니다.
 *
 * @module app/nursingHome/outpatient-record/page
 */
import OutpatientRecordView from '../../../component/nursing-home/pages/outpatient-record/OutpatientRecord'

export default function OutpatientRecordPage() {
  return <OutpatientRecordView />
}

