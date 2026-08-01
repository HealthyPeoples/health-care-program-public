/**
 * @file App Router 페이지 — 낙상위험도측정
 *
 * @description
 * /nursingHome/fall-risk-measurement thin wrapper. 실제 UI는 component/nursing-home/pages/fall-risk-measurement 를 렌더합니다.
 *
 * @module app/nursingHome/fall-risk-measurement/page
 */
import FallRiskMeasurement from '../../../component/nursing-home/pages/fall-risk-measurement/FallRiskMeasurement'

export default function FallRiskMeasurementPage() {
  return <FallRiskMeasurement />
}

