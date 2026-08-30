/**
 * @file App Router 페이지 — 계정별결산서
 *
 * @description
 * /nursingHome/account-settlement thin wrapper. 실제 UI는 component/nursing-home/pages/account-settlement 를 렌더합니다.
 *
 * @module app/nursingHome/account-settlement/page
 */
import AccountSettlement from '../../../component/nursing-home/pages/account-settlement/AccountSettlement'

export default function AccountSettlementPage() {
  return <AccountSettlement />
}
