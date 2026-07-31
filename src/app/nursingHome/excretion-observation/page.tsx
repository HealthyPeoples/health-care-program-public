/**
 * @file App Router 페이지 — 배설관찰
 *
 * @description
 * /nursingHome/excretion-observation thin wrapper. 실제 UI는 component/nursing-home/pages/excretion-observation 를 렌더합니다.
 *
 * @module app/nursingHome/excretion-observation/page
 */
import ExcretionObservation from '../../../component/nursing-home/pages/excretion-observation/ExcretionObservation'

export default function ExcretionObservationPage() {
  return <ExcretionObservation />
}

