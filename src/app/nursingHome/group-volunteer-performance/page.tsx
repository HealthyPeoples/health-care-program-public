/**
 * @file App Router 페이지 — 단체자원봉사실적
 *
 * @description
 * /nursingHome/group-volunteer-performance thin wrapper. 실제 UI는 component/nursing-home/pages/group-volunteer-performance 를 렌더합니다.
 *
 * @module app/nursingHome/group-volunteer-performance/page
 */
import GroupVolunteerPerformance from '../../../component/nursing-home/pages/group-volunteer-performance/GroupVolunteerPerformance'

export default function GroupVolunteerPerformancePage() {
  return <GroupVolunteerPerformance />
}

