/**
 * @file App Router 페이지 — 보호자회의
 *
 * @description
 * /nursingHome/guardian-meeting thin wrapper. 실제 UI는 component/nursing-home/pages/guardian-meeting 를 렌더합니다.
 *
 * @module app/nursingHome/guardian-meeting/page
 */
import GuardianMeeting from '../../../component/nursing-home/pages/guardian-meeting/GuardianMeeting'

export default function GuardianMeetingPage() {
  return <GuardianMeeting />
}

