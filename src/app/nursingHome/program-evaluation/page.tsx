/**
 * @file App Router 페이지 — 프로그램평가
 *
 * @description
 * /nursingHome/program-evaluation thin wrapper. 실제 UI는 component/nursing-home/pages/program-evaluation 를 렌더합니다.
 *
 * @module app/nursingHome/program-evaluation/page
 */
import ProgramEvaluation from '../../../component/nursing-home/pages/program-evaluation/ProgramEvaluation'

export default function ProgramEvaluationPage() {
  return <ProgramEvaluation />
}

