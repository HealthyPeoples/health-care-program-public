/**
 * @file App Router 페이지 — 평가지침/체크리스트
 *
 * @description
 * /nursingHome/evaluation-checklist thin wrapper. 실제 UI는 component/nursing-home/pages/evaluation-checklist 를 렌더합니다.
 *
 * @module app/nursingHome/evaluation-checklist/page
 */
import EvaluationChecklist from '../../../component/nursing-home/pages/evaluation-checklist/EvaluationChecklist'

export default function EvaluationChecklistPage() {
  return <EvaluationChecklist />
}

