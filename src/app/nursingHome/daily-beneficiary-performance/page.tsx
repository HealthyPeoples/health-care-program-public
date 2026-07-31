/**
 * @file App Router — 일 수급자급여실적 페이지
 *
 * @description
 * Next.js App Router thin wrapper입니다.
 * 실제 화면은 `DailyBeneficiaryPerformance` 컴포넌트(파일명과 동일)를 렌더합니다.
 *
 * @route /nursingHome/daily-beneficiary-performance
 * @see {@link ../../../component/nursing-home/pages/daily-beneficiary-performance/DailyBeneficiaryPerformance}
 */
import DailyBeneficiaryPerformanceView from '../../../component/nursing-home/pages/daily-beneficiary-performance/DailyBeneficiaryPerformance'

/**
 * 일 수급자급여실적 페이지 엔트리.
 * import 별칭이 View이지만 실제로는 DailyBeneficiaryPerformance.tsx 기본 export입니다.
 */
export default function DailyBeneficiaryPerformancePage() {
  return <DailyBeneficiaryPerformanceView />
}
