/**
 * @file App Router 페이지 — 장기요양 기능·인지
 *
 * @description
 * /nursingHome/longterm-functional-cognitive thin wrapper. 실제 UI는 component/nursing-home/pages/longterm-functional-cognitive 를 렌더합니다.
 *
 * @module app/nursingHome/longterm-functional-cognitive/page
 */
import LongtermFunctionalCognitive from '../../../component/nursing-home/pages/longterm-functional-cognitive/LongtermFunctionalCognitive'

export default function LongtermFunctionalCognitivePage() {
  return <LongtermFunctionalCognitive />
}