import Next from './next.svg';
import Vercel from './vercel.svg';

export {
    Next,
    Vercel,
};

// 이렇게 해주면 나중에 컴포넌트에서 svg 땡겨 쓸 때 바로 <IconInfo /> 이런 식으로 편리하게 쓸 수 있다.
// 아직도 <img src='/svgs/info.svg'> 이렇게 쓰고 있니?
// Next.js가 아니라 CRA로 쓸 경우에는 export { ReactComponent as Logo } from './logo.svg' 이런 식으로