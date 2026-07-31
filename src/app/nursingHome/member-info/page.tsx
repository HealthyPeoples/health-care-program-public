/**
 * @file App Router 페이지 — 수급자정보
 *
 * @description
 * /nursingHome/member-info thin wrapper. 실제 UI는 component/nursing-home/pages/member-info 를 렌더합니다.
 *
 * @module app/nursingHome/member-info/page
 */
import MemberInfoView from '../../../component/nursing-home/pages/member-info/MemberInfoView'

export default function MemberInfoPage() {
  return <MemberInfoView />
}