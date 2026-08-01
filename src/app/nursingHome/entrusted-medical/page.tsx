/**
 * @file App Router 페이지 — 위탁진료
 *
 * @description
 * /nursingHome/entrusted-medical thin wrapper. 실제 UI는 component/nursing-home/pages/entrusted-medical 를 렌더합니다.
 *
 * @module app/nursingHome/entrusted-medical/page
 */
import EntrustedMedical from '../../../component/nursing-home/pages/entrusted-medical/EntrustedMedical'

export default function EntrustedMedicalPage() {
  return <EntrustedMedical />
}

