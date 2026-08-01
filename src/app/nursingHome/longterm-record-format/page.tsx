/**
 * @file App Router 페이지 — 장기요양기록양식
 *
 * @description
 * /nursingHome/longterm-record-format thin wrapper. 실제 UI는 component/nursing-home/pages/longterm-record-format 를 렌더합니다.
 *
 * @module app/nursingHome/longterm-record-format/page
 */
import LongtermRecordFormat from '../../../component/nursing-home/pages/longterm-record-format/LongtermRecordFormat'

export default function LongtermRecordFormatPage() {
  return <LongtermRecordFormat />
}