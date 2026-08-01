/**
 * @file App Router 페이지 — 연계기록
 *
 * @description
 * /nursingHome/connection-record thin wrapper. 실제 UI는 component/nursing-home/pages/connection-record 를 렌더합니다.
 *
 * @module app/nursingHome/connection-record/page
 */
import ConnectionRecordView from '../../../component/nursing-home/pages/connection-record/ConnectionRecord'

export default function ConnectionRecordPage() {
  return <ConnectionRecordView />
}
