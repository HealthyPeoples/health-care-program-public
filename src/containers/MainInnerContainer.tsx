/**
 * @file 레이아웃 컨테이너 — MainInnerContainer.tsx
 *
 * @description
 * 페이지를 감싸는 레이아웃 컨테이너 컴포넌트입니다.
 *
 * @module containers/MainInnerContainer
 */
import { ReactNodeProps } from '../types'

export const MainInnerContainer = ({ children }: ReactNodeProps) => {
  return (
    <div className="flex items-center justify-center w-full p-4 text-center bg-white sm:p-8 dark:bg-gray-800 dark:border-gray-700">
      {children}
    </div>
  )
}
