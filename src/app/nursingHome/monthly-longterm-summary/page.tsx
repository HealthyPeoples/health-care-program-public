/**
 * @file App Router 페이지 — 월 장기요양 요약
 *
 * @description
 * /nursingHome/monthly-longterm-summary thin wrapper. 실제 UI는 component/nursing-home/pages/monthly-longterm-summary 를 렌더합니다.
 *
 * @module app/nursingHome/monthly-longterm-summary/page
 */
import MonthlyLongtermSummary from '../../../component/nursing-home/pages/monthly-longterm-summary/MonthlyLongtermSummary'

export default function MonthlyLongtermSummaryPage() {
  return <MonthlyLongtermSummary />
}

