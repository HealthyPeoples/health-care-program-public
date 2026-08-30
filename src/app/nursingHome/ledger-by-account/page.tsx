/**
 * @file App Router 페이지 — 원장조회(계정과목별)
 *
 * @description
 * /nursingHome/ledger-by-account thin wrapper. 실제 UI는 component/nursing-home/pages/ledger-by-account 를 렌더합니다.
 *
 * @module app/nursingHome/ledger-by-account/page
 */
import LedgerByAccount from '../../../component/nursing-home/pages/ledger-by-account/LedgerByAccount'

export default function LedgerByAccountPage() {
  return <LedgerByAccount />
}
