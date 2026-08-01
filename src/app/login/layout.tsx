/**
 * @file App Router 레이아웃 — login
 *
 * @description
 * 해당 세그먼트의 공통 레이아웃(탭 셸·네비 등)을 정의합니다.
 *
 * @module app/login/layout
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-blue-50 to-blue-100">
      {children}
    </div>
  );
}

