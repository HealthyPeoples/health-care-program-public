/**
 * @file App Router 페이지 — 질병력
 *
 * @description
 * /nursingHome/disease-history thin wrapper. 실제 UI는 component/nursing-home/pages/disease-history 를 렌더합니다.
 *
 * @module app/nursingHome/disease-history/page
 */
import DiseaseHistoryView from '../../../component/nursing-home/pages/disease-history/DiseaseHistoryView'

export default function DiseaseHistoryPage() {
  return <DiseaseHistoryView />
}