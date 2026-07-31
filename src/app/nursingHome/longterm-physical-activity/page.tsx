/**
 * @file App Router 페이지 — 장기요양 신체활동
 *
 * @description
 * /nursingHome/longterm-physical-activity thin wrapper. 실제 UI는 component/nursing-home/pages/longterm-physical-activity 를 렌더합니다.
 *
 * @module app/nursingHome/longterm-physical-activity/page
 */
import LongtermPhysicalActivity from '../../../component/nursing-home/pages/longterm-physical-activity/LongtermPhysicalActivity'

export default function LongtermPhysicalActivityPage() {
  return <LongtermPhysicalActivity />
}