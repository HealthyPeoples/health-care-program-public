/**
 * @file App Router 페이지 — 간식일괄등록
 *
 * @description
 * /nursingHome/snack-bulk-registration thin wrapper. 실제 UI는 component/nursing-home/pages/snack-bulk-registration 를 렌더합니다.
 *
 * @module app/nursingHome/snack-bulk-registration/page
 */
import SnackBulkRegistration from '../../../component/nursing-home/pages/snack-bulk-registration/SnackBulkRegistration'

export default function SnackBulkRegistrationPage() {
  return <SnackBulkRegistration />
}