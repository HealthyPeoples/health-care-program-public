/**
 * @file Recoil 전역 상태
 *
 * @description
 * Recoil atom/selector 정의입니다.
 *
 * @module atom/RecoilState
 */
import { atom } from 'recoil'

export const toggleState = atom<boolean>({
  key: 'toggleState',
  default: false,
})
