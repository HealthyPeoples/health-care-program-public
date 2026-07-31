/**
 * @file App Router 페이지 — 상태변화관찰
 *
 * @description
 * /nursingHome/status-change-observation thin wrapper. 실제 UI는 component/nursing-home/pages/status-change-observation 를 렌더합니다.
 *
 * @module app/nursingHome/status-change-observation/page
 */
import StatusChangeObservation from '../../../component/nursing-home/pages/status-change-observation/StatusChangeObservation'

export default function StatusChangeObservationPage() {
  return <StatusChangeObservation />
}