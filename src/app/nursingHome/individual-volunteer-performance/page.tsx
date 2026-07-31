/**
 * @file App Router 페이지 — 개인자원봉사실적
 *
 * @description
 * /nursingHome/individual-volunteer-performance thin wrapper. 실제 UI는 component/nursing-home/pages/individual-volunteer-performance 를 렌더합니다.
 *
 * @module app/nursingHome/individual-volunteer-performance/page
 */
import IndividualVolunteerPerformance from '../../../component/nursing-home/pages/individual-volunteer-performance/IndividualVolunteerPerformance'

export default function IndividualVolunteerPerformancePage() {
  return <IndividualVolunteerPerformance />
}

