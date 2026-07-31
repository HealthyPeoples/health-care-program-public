/**
 * @file App Router 페이지 — 사실확인서
 *
 * @description
 * /nursingHome/fact-verification thin wrapper. 실제 UI는 component/nursing-home/pages/fact-verification 를 렌더합니다.
 *
 * @module app/nursingHome/fact-verification/page
 */
import FactVerification from '../../../component/nursing-home/pages/fact-verification/FactVerification'

export default function FactVerificationPage() {
  return <FactVerification />
}