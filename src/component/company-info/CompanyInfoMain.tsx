import React from 'react';
import { MainContainer } from '../../containers'
import { HeaderImg } from '../common'

export const CompanyInfoMain = () => {
  return (
    <>
      <HeaderImg>메뉴1</HeaderImg>
      <MainContainer>
        <div className="container px-4 py-8 mx-auto space-y-8">
          <div className="container px-4 py-8 mx-auto">
            <h1 className="mb-4 text-4xl font-bold">회사소개</h1>
            <hr className="w-20 mb-8 border-blue-500" />

          </div>

        </div>
      </MainContainer>
    </>
  )
}
