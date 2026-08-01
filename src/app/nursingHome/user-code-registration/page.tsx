/**
 * @file App Router 페이지 — 사용자코드등록
 *
 * @description
 * /nursingHome/user-code-registration thin wrapper. 실제 UI는 component/nursing-home/pages/user-code-registration 를 렌더합니다.
 *
 * @module app/nursingHome/user-code-registration/page
 */
import UserCodeRegistration from '../../../component/nursing-home/pages/user-code-registration/UserCodeRegistration'

export default function UserCodeRegistrationPage() {
  return <UserCodeRegistration />
}

