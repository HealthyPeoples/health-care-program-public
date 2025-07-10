import Link from 'next/link'
import Image from 'next/image'

export const CallNav = () => {
  return (
    <div className="fixed right-0 z-50 w-20 text-lg leading-5 bg-white cursor-pointer h-52 top-24 opacity-80">
      <div className="flex flex-col items-center w-full h-full p-2 font-bold">
        <div className="flex-col p-1 w-14 h-1/2">
          <Image
            className="p-1"
            src="/img/main/quick_ico1.png"
            alt="Description"
            layout="responsive"
            width={50}
            height={50}
          />
          <p className="text-xs ">카톡오톡</p>
          <p className="text-xs">상담하기</p>
        </div>

        <div className="p-1 w-14 h-1/2">
          <Image
            className="p-1"
            src="/img/main/quick_ico2.png"
            alt="Description"
            layout="responsive"
            width={50}
            height={50}
          />
          <p className="text-xs">24시간</p>
          <p className="text-xs">전화상담</p>
        </div>
      </div>
    </div>
  )
}
