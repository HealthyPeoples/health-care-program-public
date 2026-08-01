/**
 * @file App Router 페이지 — 외출·외박대장
 *
 * @description
 * /nursingHome/outing-info thin wrapper. 실제 UI는 component/nursing-home/pages/outing-info 를 렌더합니다.
 *
 * @module app/nursingHome/outing-info/page
 */
import OutingInfoView from '../../../component/nursing-home/pages/outing-info/OutingInfo'

export default function OutingInfoPage() {
  return <OutingInfoView />
}
