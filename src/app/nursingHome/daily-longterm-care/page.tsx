/**
 * @file App Router 페이지 — 일 장기요양급여제공기록
 *
 * @description
 * /nursingHome/daily-longterm-care thin wrapper. 실제 UI는 component/nursing-home/pages/daily-longterm-care 를 렌더합니다.
 *
 * @module app/nursingHome/daily-longterm-care/page
 */
import DailyLongtermCare from '../../../component/nursing-home/pages/daily-longterm-care/DailyLongtermCare'

export default function DailyLongtermCarePage() {
  return <DailyLongtermCare />
}