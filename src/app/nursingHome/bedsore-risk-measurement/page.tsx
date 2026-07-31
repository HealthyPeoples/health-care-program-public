/**
 * @file App Router 페이지 — 욕창위험도측정
 *
 * @description
 * /nursingHome/bedsore-risk-measurement thin wrapper. 실제 UI는 component/nursing-home/pages/bedsore-risk-measurement 를 렌더합니다.
 *
 * @module app/nursingHome/bedsore-risk-measurement/page
 */
import BedsoreRiskMeasurement from '../../../component/nursing-home/pages/bedsore-risk-measurement/BedsoreRiskMeasurement'

export default function BedsoreRiskMeasurementPage() {
  return <BedsoreRiskMeasurement />
}

