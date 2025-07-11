import { MainContainer } from '../../containers'
import NursingHomeMenu from '../nursing-home/organisms/NursingHomeMenu';

export const NursingHome = () => {
  return (
      <MainContainer>
        <div className="container px-4 py-8 mx-auto space-y-8">
          <h1 className="mb-4 text-4xl font-bold">요양원페이지</h1>
          <hr className="w-20 mb-8 border-blue-500" />

          {/* 요양원 메뉴 컴포넌트 */}
          <NursingHomeMenu />
        </div>
      </MainContainer>
  );
};