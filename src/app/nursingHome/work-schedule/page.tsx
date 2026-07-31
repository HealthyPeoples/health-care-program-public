/**
 * @file App Router 페이지 — 근무표
 *
 * @description
 * /nursingHome/work-schedule thin wrapper. 실제 UI는 component/nursing-home/pages/work-schedule 를 렌더합니다.
 *
 * @module app/nursingHome/work-schedule/page
 */
import WorkSchedule from '../../../component/nursing-home/pages/work-schedule/WorkSchedule'

export default function WorkSchedulePage() {
  return <WorkSchedule />
}

