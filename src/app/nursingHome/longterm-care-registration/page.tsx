/**
 * @file App Router 페이지 — 장기요양급여제공계획
 *
 * @description
 * /nursingHome/longterm-care-registration thin wrapper. 실제 UI는 component/nursing-home/pages/longterm-care-registration 를 렌더합니다.
 *
 * @module app/nursingHome/longterm-care-registration/page
 */
import LongtermCareRegistration from '../../../component/nursing-home/pages/longterm-care-registration/LongtermCareRegistration'

export default function LongtermCareRegistrationPage() {
  return <LongtermCareRegistration />
}

