/**
 * @file Next.js middleware — 서명된 세션 JWT 관문
 *
 * @description
 * 보호 경로(`/nursingHome`, `/api` 등)에서 auth_token(또는 user_info) JWT를 검증합니다.
 * 페이지는 `/login`으로 리다이렉트, API는 401 JSON을 반환합니다.
 *
 * @module middleware
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionEdge } from './lib/sessionJwtEdge';

/** 인증 없이 허용하는 API 접두사 */
const PUBLIC_API_PREFIXES = [
	'/api/login',
	'/api/logout',
	'/api/forgot-password',
	'/api/auth/check',
];

function isPublicApi(pathname: string): boolean {
	return PUBLIC_API_PREFIXES.some(
		(p) => pathname === p || pathname.startsWith(`${p}/`)
	);
}

function getSessionToken(req: NextRequest): string | undefined {
	return req.cookies.get('auth_token')?.value || req.cookies.get('user_info')?.value;
}

function unauthorizedApi() {
	return NextResponse.json(
		{ success: false, error: '로그인이 필요합니다.', authenticated: false },
		{ status: 401 }
	);
}

function redirectToLogin(req: NextRequest) {
	const login = new URL('/login', req.url);
	const path = req.nextUrl.pathname + req.nextUrl.search;
	if (path && path !== '/') {
		login.searchParams.set('redirect', path);
	}
	return NextResponse.redirect(login);
}

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	if (pathname.startsWith('/api/') && isPublicApi(pathname)) {
		return NextResponse.next();
	}

	const secret = process.env.AUTH_SECRET;
	const token = getSessionToken(req);
	const session = await verifySessionEdge(token, secret);

	if (session) {
		return NextResponse.next();
	}

	if (pathname.startsWith('/api/')) {
		return unauthorizedApi();
	}

	return redirectToLogin(req);
}

export const config = {
	matcher: [
		'/nursingHome/:path*',
		'/dayNightCare/:path*',
		'/shortTermCare/:path*',
		'/nursing-home-customer/:path*',
		'/f00110-test/:path*',
		'/f90030-test/:path*',
		'/api/:path*',
	],
};
