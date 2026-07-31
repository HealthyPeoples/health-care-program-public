/**
 * @file App Router 페이지 — 투약시간
 *
 * @description
 * /nursingHome/medication-time thin wrapper. 실제 UI는 component/nursing-home/pages/medication-time 를 렌더합니다.
 *
 * @module app/nursingHome/medication-time/page
 */
import MedicationTime from '../../../component/nursing-home/pages/medication-time/MedicationTime'

export default function MedicationTimePage() {
  return <MedicationTime />
}