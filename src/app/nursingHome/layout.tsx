/**
 * @file App Router 레이아웃 — nursingHome
 *
 * @description
 * 해당 세그먼트의 공통 레이아웃(탭 셸·네비 등)을 정의합니다.
 *
 * @module app/nursingHome/layout
 */
import { NursingHome } from '../../component/nursing-home';

export default function NursingHomeLayout({ children }: { children: React.ReactNode }) {
  return <NursingHome>{children}</NursingHome>;
} 