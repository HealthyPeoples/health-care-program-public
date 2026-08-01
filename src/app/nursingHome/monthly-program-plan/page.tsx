/**
 * @file App Router 페이지 — 월 프로그램계획
 *
 * @description
 * /nursingHome/monthly-program-plan thin wrapper. 실제 UI는 component/nursing-home/pages/monthly-program-plan 를 렌더합니다.
 *
 * @module app/nursingHome/monthly-program-plan/page
 */
import MonthlyProgramPlan from '../../../component/nursing-home/pages/monthly-program-plan/MonthlyProgramPlan'

export default function MonthlyProgramPlanPage() {
  return <MonthlyProgramPlan />
}

