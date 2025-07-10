'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRecoilValue } from 'recoil'
import { toggleState } from '../../atom/RecoilState'
import { useRecoilState } from 'recoil'

export const Header = () => {
  const [isMenuOpenToggled, setIsMenuOpenToggled] = useRecoilState(toggleState)
  // const isToggled = useRecoilValue(toggleState)

  const [isScrollDown, setIsScrollDown] = useState(true)

  useEffect(() => {
    // 스크롤 위치 감지 함수
    const handleScroll = () => {
      if (window.pageYOffset > 0) {
        setIsScrollDown(false)
      } else {
        setIsScrollDown(true)
      }
    }

    // 스크롤 이벤트 리스너 추가
    window.addEventListener('scroll', handleScroll)

    // 컴포넌트 언마운트 시, 스크롤 이벤트 리스너 제거
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  let menuOpen = true

  const [isMenuHidden, setIsMenuHidden] = useState(false)
  const [isInfoMenuHidden, setIsInfoMenuHidden] = useState(false)

  const handleMenuHidden = () => {
    setIsMenuHidden(!isMenuHidden)
  }

  return (
    <>
      <nav
        className={`transition-opacity duration-300 sticky top-0 z-50 flex flex-wrap items-center justify-between p-6 bg-stone-600 PC:px-64 pt-10`}
        // className={`${
        //   isScrollDown ? 'opacity-100' : 'opacity-70'
        // } transition-opacity duration-300 sticky top-0 z-50 flex flex-wrap items-center justify-between p-6 bg-stone-600 PC:px-64 pt-10`}
      >
        <Link href="/">
          <div className="flex items-center flex-shrink-0 mr-6 text-white">
            {/* <svg
              className="w-8 h-8 mr-2 fill-current"
              width="54"
              height="54"
              viewBox="0 0 54 54"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M13.5 22.1c1.8-7.2 6.3-10.8 13.5-10.8 10.8 0 12.15 8.1 17.55 9.45 3.6.9 6.75-.45 9.45-4.05-1.8 7.2-6.3 10.8-13.5 10.8-10.8 0-12.15-8.1-17.55-9.45-3.6-.9-6.75.45-9.45 4.05zM0 38.3c1.8-7.2 6.3-10.8 13.5-10.8 10.8 0 12.15 8.1 17.55 9.45 3.6.9 6.75-.45 9.45-4.05-1.8 7.2-6.3 10.8-13.5 10.8-10.8 0-12.15-8.1-17.55-9.45-3.6-.9-6.75.45-9.45 4.05z" />
            </svg> */}
            <span className="text-4xl font-semibold tracking-tight">로고</span>
          </div>
        </Link>
        <div onClick={() => setIsMenuOpenToggled(!isMenuOpenToggled)} className="block Tab:hidden">
          <button className="flex items-center px-3 py-2 border rounded text-mainBrown1 border-mainBrown2 hover:text-white hover:border-white">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <title>Menu</title>
              <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z" />
            </svg>
          </button>
        </div>
        <div
          className={`flex-grow ${
            isMenuOpenToggled ? 'block' : 'hidden'
          } w-full bg-stone-600 top-24 right-0 Tab:top-0 absolute Tab:relative Tab:flex Tab:items-center Tab:w-auto`}
        >
          <div onClick={() => setIsMenuOpenToggled(!isMenuOpenToggled)} className="px-6 pb-6 text-lg Tab:flex-grow">
            <Link href="/companyInfo">
              <p
                onMouseEnter={() => {
                  setIsMenuHidden(false)
                  setIsInfoMenuHidden(true)
                }}
                onClick={() => setIsInfoMenuHidden(false)}
                className="block mt-4 mr-4 text-mainBrown1 Tab:inline-block Tab:mt-0 hover:text-white"
              >
                메뉴1
              </p>
            </Link>
            <Link href="/funeralContent">
              <p
                // onFocus={handleMenuHidden}
                onMouseEnter={() => {
                  setIsMenuHidden(true)
                  setIsInfoMenuHidden(false)
                }}
                onClick={() => setIsMenuHidden(false)}
                // onMouseLeave={() => setIsMenuHidden(true)}
                className="block mt-4 mr-4 text-mainBrown1 Tab:inline-block Tab:mt-0 hover:text-white"
              >
                메뉴2
              </p>
            </Link>
            <Link href="/review">
              <p
                onMouseEnter={() => {
                  setIsMenuHidden(false)
                  setIsInfoMenuHidden(false)
                }}
                className="block mt-4 mr-4 text-mainBrown1 Tab:inline-block Tab:mt-0 hover:text-white"
              >
                메뉴3
              </p>
            </Link>
            <Link href="/funeralInfo">
              <p
                onMouseEnter={() => {
                  setIsMenuHidden(false)
                  setIsInfoMenuHidden(false)
                }}
                className="block mt-4 text-mainBrown1 Tab:inline-block Tab:mt-0 hover:text-white"
              >
                메뉴4
              </p>
            </Link>
            <div>
              <p className="inline-block px-4 py-2 mt-4 text-sm leading-none text-white border border-white rounded Tab:hidden hover:border-transparent hover:text-mainBrown2 hover:bg-white Tab:mt-0">
                문의하기
              </p>
            </div>
          </div>
          <div>
            <p className="hidden px-4 py-2 mt-4 text-sm leading-none text-white border border-white rounded Tab:inline-block hover:border-transparent hover:text-mainBrown2 hover:bg-white Tab:mt-0">
              문의하기
            </p>
          </div>
        </div>

        {/* 회사소개 드롭다운 */}
        <div className="absolute border-gray-200 shadow-lg App:hidden Tab:block top-full bg-gray-50 md:bg-white border-y dark:bg-gray-800 dark:border-gray-600">
          <div
            onMouseLeave={() => setIsInfoMenuHidden(false)}
            id="mega-menu-full-dropdown"
            className={`${isInfoMenuHidden ? '' : 'hidden'} `}
            // } absolute shadow-lg top-full mt-1 border-gray-200 bg-gray-50 md:bg-white border-y dark:bg-gray-800 dark:border-gray-600`}
          >
            <div className="grid max-w-screen-xl px-4 py-5 mx-auto text-gray-900 dark:text-white md:px-6">
              <ul>
                <li>
                  <a href="#" className="block p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <div className="font-semibold">회사 소개</div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">회사 소개</span>
                  </a>
                </li>
                <li>
                  <a href="#" className="block p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <div className="font-semibold">안내2</div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">안내2</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="absolute border-gray-200 shadow-lg App:hidden Tab:block top-full bg-gray-50 md:bg-white border-y dark:bg-gray-800 dark:border-gray-600">
          <div
            onMouseLeave={() => setIsMenuHidden(false)}
            id="mega-menu-full-dropdown"
            className={`${isMenuHidden ? '' : 'hidden'} `}
            // } absolute shadow-lg top-full mt-1 border-gray-200 bg-gray-50 md:bg-white border-y dark:bg-gray-800 dark:border-gray-600`}
          >
            <div className="grid max-w-screen-xl px-4 py-5 mx-auto text-gray-900 dark:text-white md:px-6">
              <ul>
                <li>
                  <a href="#" className="block p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <div className="font-semibold">안내1</div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">안내1</span>
                  </a>
                </li>
                <li>
                  <a href="#" className="block p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <div className="font-semibold">안내2</div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">안내2</span>
                  </a>
                </li>
                <li>
                  <a href="#" className="block p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                    <div className="font-semibold">안내3</div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">안내3</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
