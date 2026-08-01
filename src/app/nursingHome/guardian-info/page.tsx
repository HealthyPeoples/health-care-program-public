/**
 * @file App Router 페이지 — 보호자정보
 *
 * @description
 * /nursingHome/guardian-info thin wrapper. 실제 UI는 component/nursing-home/pages/guardian-info 를 렌더합니다.
 *
 * @module app/nursingHome/guardian-info/page
 */
import GuardianInfo from '../../../component/nursing-home/pages/guardian-info/GuardianInfo';

export default function GuardianInfoPage() {
  return <GuardianInfo />;
}