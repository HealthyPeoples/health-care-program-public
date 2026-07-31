/**
 * @file 요양원 UI — NursingHomeHeader.tsx
 *
 * @description
 * 요양원 공통 UI(메뉴·패널 등) 컴포넌트입니다.
 *
 * @module component/nursing-home/organisms/NursingHomeHeader
 */
import { HeaderImg } from '../../common'
import Link from 'next/link'

export const NursingHomeHeader = () => {
  return (
    <Link
      href="/nursingHome"
    >
      <HeaderImg>요양원</HeaderImg>
    </Link>
  );
};