/**
 * @file App Router 페이지 — 물리치료기준시간
 *
 * @description
 * /nursingHome/physical-therapy-standard-time thin wrapper. 실제 UI는 component/nursing-home/pages/physical-therapy-standard-time 를 렌더합니다.
 *
 * @module app/nursingHome/physical-therapy-standard-time/page
 */
import PhysicalTherapyStandardTime from '../../../component/nursing-home/pages/physical-therapy-standard-time/PhysicalTherapyStandardTime'

export default function PhysicalTherapyStandardTimePage() {
  return <PhysicalTherapyStandardTime />
}

