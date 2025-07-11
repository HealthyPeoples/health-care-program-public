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