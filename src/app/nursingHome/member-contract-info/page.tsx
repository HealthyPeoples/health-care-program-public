/**
 * @file App Router 페이지 — 수급자계약정보
 *
 * @description
 * /nursingHome/member-contract-info thin wrapper. 실제 UI는 component/nursing-home/pages/member-contract-info 를 렌더합니다.
 *
 * @module app/nursingHome/member-contract-info/page
 */
import MemberContractInfo from '../../../component/nursing-home/pages/member-contract-info/MemberContractInfo';

export default function MemberContractInfoPage() {
  return <MemberContractInfo />;
}