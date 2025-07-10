import { ReactNodeProps } from '../types'

export const SectionContainer = ({ children }: ReactNodeProps) => {
  return <section className="max-w-3xl px-0 mx-auto xl:max-w-5xl">{children}</section>
}
