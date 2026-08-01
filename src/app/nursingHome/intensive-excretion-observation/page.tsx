/**
 * @file App Router 페이지 — 집중배설관찰
 *
 * @description
 * /nursingHome/intensive-excretion-observation thin wrapper. 실제 UI는 component/nursing-home/pages/intensive-excretion-observation 를 렌더합니다.
 *
 * @module app/nursingHome/intensive-excretion-observation/page
 */
import IntensiveExcretionObservation from '../../../component/nursing-home/pages/intensive-excretion-observation/IntensiveExcretionObservation'

export default function IntensiveExcretionObservationPage() {
  return <IntensiveExcretionObservation />
}

