/**
 * @file App Router 레이아웃 — shortTermCare
 *
 * @description
 * 해당 세그먼트의 공통 레이아웃(탭 셸·네비 등)을 정의합니다.
 *
 * @module app/shortTermCare/layout
 */
import { NursingHome } from '../../component/nursing-home';

export default function ShortTermCareLayout({ children }: { children: React.ReactNode }) {
  return <NursingHome>{children}</NursingHome>;
}

