/**
 * @file App Router 페이지 — 프로그램일지
 *
 * @description
 * /nursingHome/program-daily-log thin wrapper. 실제 UI는 component/nursing-home/pages/program-daily-log 를 렌더합니다.
 *
 * @module app/nursingHome/program-daily-log/page
 */
import ProgramDailyLog from '../../../component/nursing-home/pages/program-daily-log/ProgramDailyLog'

export default function ProgramDailyLogPage() {
  return <ProgramDailyLog />
}

