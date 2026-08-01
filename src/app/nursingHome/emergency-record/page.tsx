/**
 * @file App Router 페이지 — 응급기록
 *
 * @description
 * /nursingHome/emergency-record thin wrapper. 실제 UI는 component/nursing-home/pages/emergency-record 를 렌더합니다.
 *
 * @module app/nursingHome/emergency-record/page
 */
import EmergencyRecord from '../../../component/nursing-home/pages/emergency-record/EmergencyRecord'

export default function EmergencyRecordPage() {
  return <EmergencyRecord />
}

