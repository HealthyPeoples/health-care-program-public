/**
 * @file App Router 페이지 — 간호서비스
 *
 * @description
 * /nursingHome/nursing-service thin wrapper. 실제 UI는 component/nursing-home/pages/nursing-service 를 렌더합니다.
 *
 * @module app/nursingHome/nursing-service/page
 */
import NursingService from '../../../component/nursing-home/pages/nursing-service/NursingService'

export default function NursingServicePage() {
  return <NursingService />
}

