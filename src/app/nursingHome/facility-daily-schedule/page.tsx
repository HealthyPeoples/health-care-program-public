/**
 * @file App Router 페이지 — 시설일일일정
 *
 * @description
 * /nursingHome/facility-daily-schedule thin wrapper. 실제 UI는 component/nursing-home/pages/facility-daily-schedule 를 렌더합니다.
 *
 * @module app/nursingHome/facility-daily-schedule/page
 */
import FacilityDailySchedule from '../../../component/nursing-home/pages/facility-daily-schedule/FacilityDailySchedule'

export default function FacilityDailySchedulePage() {
  return <FacilityDailySchedule />
}

