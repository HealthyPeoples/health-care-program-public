/**
 * @file App Router 페이지 — 연간일정
 *
 * @description
 * /nursingHome/annual-schedule thin wrapper. 실제 UI는 component/nursing-home/pages/annual-schedule 를 렌더합니다.
 *
 * @module app/nursingHome/annual-schedule/page
 */
import AnnualSchedule from '../../../component/nursing-home/pages/annual-schedule/AnnualSchedule'

export default function AnnualSchedulePage() {
  return <AnnualSchedule />
}

