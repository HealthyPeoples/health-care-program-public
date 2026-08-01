/**
 * @file App Router 페이지 — 장기요양 간호지시
 *
 * @description
 * /nursingHome/longterm-nursing-instruction thin wrapper. 실제 UI는 component/nursing-home/pages/longterm-nursing-instruction 를 렌더합니다.
 *
 * @module app/nursingHome/longterm-nursing-instruction/page
 */
import LongtermNursingInstruction from '../../../component/nursing-home/pages/longterm-nursing-instruction/LongtermNursingInstruction'

export default function LongtermNursingInstructionPage() {
  return <LongtermNursingInstruction />
}