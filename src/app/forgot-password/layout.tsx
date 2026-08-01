/**
 * @file App Router 레이아웃 — forgot-password
 *
 * @description
 * 해당 세그먼트의 공통 레이아웃(탭 셸·네비 등)을 정의합니다.
 *
 * @module app/forgot-password/layout
 */
export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-blue-100 overflow-auto">
      {children}
    </div>
  );
}

