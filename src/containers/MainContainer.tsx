/**
 * @file 레이아웃 컨테이너 — MainContainer.tsx
 *
 * @description
 * 페이지를 감싸는 레이아웃 컨테이너 컴포넌트입니다.
 *
 * @module containers/MainContainer
 */
import { ReactNodeProps } from '../types'

export const MainContainer = ({ children }: ReactNodeProps) => {
  return <main className="flex flex-col items-center justify-between min-h-screen">{children}</main>
}
