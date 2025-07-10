import Image from 'next/image'
import { ReactNodeProps } from '../../types'

/**
 * `HeaderImg` 컴포넌트는 상세 페이지의 제목을 보여주는 이미지 위에 오버레이 형태로 텍스트를 표시하는 컴포넌트입니다.
 * 이 컴포넌트는 Next.js의 Image 컴포넌트를 활용하여 이미지를 표시하며, 제목 텍스트는 중앙에 표시됩니다.
 *
 * @component
 * @param {React.ReactNode} children - 상세 페이지의 제목으로 표시될 텍스트.
 *
 * @example
 *
 * ```jsx
 * import { HeaderImg } from '../common'
 *
 * function MyPage() {
 *   return (
 *     <div>
 *       <HeaderImg>여기에 제목을 입력하세요</HeaderImg>
 *       // ... 다른 컴포넌트들
 *     </div>
 *   );
 * }
 * ```
 */

// export const HeaderImg: React.FC<MyComponentProps> = ({ children }) => {
export const HeaderImg = ({ children }: ReactNodeProps) => {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <Image src="/img/companyInfo/sb_visual.jpg" alt="Description" layout="responsive" width={1000} height={200} />
      <div className="absolute top-0 left-0 flex items-center justify-center w-full h-full">
        <p className="text-lg font-bold text-white Tab:text-3xl">{children}</p>
      </div>
    </div>
  )
}
