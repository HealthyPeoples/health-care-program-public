/**
 * @file App Router 페이지 — page.tsx
 *
 * @description
 * /nursingHome/page.tsx thin wrapper. 실제 UI는 component/nursing-home/pages/page.tsx 를 렌더합니다.
 *
 * @module app/nursingHome/page
 */
import { NursingHome } from '../../component/nursing-home'

export default function NursingHomePage() {
  return <NursingHome />
}
