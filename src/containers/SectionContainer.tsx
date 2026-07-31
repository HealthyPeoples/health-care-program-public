/**
 * @file 레이아웃 컨테이너 — SectionContainer.tsx
 *
 * @description
 * 페이지를 감싸는 레이아웃 컨테이너 컴포넌트입니다.
 *
 * @module containers/SectionContainer
 */
import { ReactNodeProps } from '../types'

export const SectionContainer = ({ children }: ReactNodeProps) => {
  return <section className="max-w-3xl px-0 mx-auto xl:max-w-5xl">{children}</section>
}
