/**
 * @file 물리치료계획평가 — 인쇄 헬퍼 (V32010)
 *
 * @module component/nursing-home/pages/physical-therapy-plan-evaluation/physicalTherapyPlanEvaluationPrint
 */
import { formatCareGradeLabel } from '../../utils/careGrade';

export type V32010PrintRow = Record<string, unknown>;

function esc(v: unknown): string {
	return String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function toYmd(raw: unknown): string {
	if (raw == null || raw === '') return '';
	if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
		const y = raw.getFullYear();
		const m = String(raw.getMonth() + 1).padStart(2, '0');
		const d = String(raw.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(raw).trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	if (s.includes('T')) return s.split('T')[0].slice(0, 10);
	return s;
}

function cell(row: V32010PrintRow, ...keys: string[]): string {
	for (const k of keys) {
		if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]);
	}
	return '';
}

function isOn(row: V32010PrintRow, key: string): boolean {
	return String(row[key] ?? '').trim() === '1';
}

function formatSex(raw: unknown): string {
	const s = String(raw ?? '').trim();
	if (s === '1' || s === '남' || s === '남성' || s === 'M') return '남';
	if (s === '2' || s === '여' || s === '여성' || s === 'F') return '여';
	return s;
}

function formatGrade(raw: unknown): string {
	const s = String(raw ?? '').trim();
	if (!s) return '';
	if (/등급|인지|외/.test(s)) return s;
	return formatCareGradeLabel(s, '');
}

function formatAge(raw: unknown): string {
	const s = String(raw ?? '').trim();
	if (!s) return '';
	const n = parseInt(s, 10);
	if (Number.isFinite(n)) return `${n} 세`;
	return s;
}

function item(row: V32010PrintRow, key: string, label: string): string {
	const on = isOn(row, key);
	return `<span class="${on ? 'chk-on' : 'chk-off'}">${on ? '☑' : '☐'} ${esc(label)}</span>`;
}

const EQUIP_L = [
	['PCHK01', '자전거'],
	['PCHK02', '탄력밴드운동'],
	['PCHK03', '전신안마기'],
	['PCHK04', 'Pully'],
	['PCHK05', '견관절운동기'],
	['PCHK06', '평행봉걷기'],
] as const;
const EQUIP_R = [
	['PCHK07', '러닝머신'],
	['PCHK08', '발맛사지기'],
	['PCHK09', '틸팅테이블'],
	['PCHK10', '공운동'],
	['PCHK11', '구슬꿰기'],
	['PCHK12', '패기보드끼우기'],
] as const;
const SIMPLE_L = [
	['PCHK21', '도수운동'],
	['PCHK23', '근력운동'],
	['PCHK25', '체중이동/지지훈련'],
] as const;
const SIMPLE_R = [
	['PCHK22', 'ROM'],
	['PCHK24', '기능향상운동'],
	['PCHK26', '보행훈련'],
] as const;
const MOD_L = [
	['PCHK31', 'Hot & Cold Pack'],
	['PCHK32', '적외선치료'],
	['PCHK33', '초음파치료'],
	['PCHK37', '파라핀치료'],
] as const;
const MOD_R = [
	['PCHK34', '경피신경전기자극치료'],
	['PCHK35', '간섭전류치료'],
	['PCHK36', '전기자극치료'],
] as const;

function pairTable(
	row: V32010PrintRow,
	left: ReadonlyArray<readonly [string, string]>,
	right: ReadonlyArray<readonly [string, string]>
): string {
	const n = Math.max(left.length, right.length);
	const rows = Array.from({ length: n }, (_, i) => {
		const l = left[i];
		const r = right[i];
		return `<tr>
			<td>${l ? item(row, l[0], l[1]) : ''}</td>
			<td>${r ? item(row, r[0], r[1]) : ''}</td>
		</tr>`;
	}).join('');
	return `<table class="inner">${rows}</table>`;
}

function sites(row: V32010PrintRow): string {
	const nums = Array.from({ length: 20 }, (_, i) => {
		const n = i + 1;
		const on = isOn(row, `PSTD${String(n).padStart(2, '0')}`);
		return `<span class="site${on ? ' on' : ''}">${n}</span>`;
	}).join('');
	return `<div class="sites">${nums}</div>`;
}

const PRINT_STYLES = `
* { box-sizing: border-box; }
html, body {
	margin: 0; padding: 0;
	font-family: "Malgun Gothic", "맑은 고딕", sans-serif;
	color: #000; background: #fff;
	font-size: 9pt;
}
.page {
	width: 210mm;
	min-height: 297mm;
	padding: 6mm 8mm 8mm;
	margin: 0 auto;
	position: relative;
	page-break-after: always;
}
.page:last-child { page-break-after: auto; }
.header { position: relative; min-height: 16mm; margin-bottom: 2mm; }
.title {
	margin: 0; padding-top: 2mm;
	font-size: 16pt; font-weight: 700;
	text-align: center;
	letter-spacing: 0.28em;
	text-decoration: underline;
	text-underline-offset: 3px;
}
.approve {
	position: absolute; right: 0; top: 0;
	border-collapse: collapse; width: 38mm; font-size: 8.5pt;
}
.approve th, .approve td { border: 1px solid #000; text-align: center; padding: 1px; }
.approve th { font-weight: 700; height: 6mm; }
.approve td.stamp { height: 12mm; }
.info, .sheet, .inner, .ex-grid {
	width: 100%; border-collapse: collapse; table-layout: fixed; empty-cells: show;
}
.info { margin-bottom: 2mm; }
.info th, .info td,
.sheet > thead > tr > th,
.sheet > tbody > tr > td {
	border: 1px solid #000; vertical-align: middle; padding: 3px 4px;
}
.info th { font-weight: 700; text-align: center; background: #f3f3f3; white-space: nowrap; }
.info td { text-align: center; }
.sheet > thead > tr > th { background: #f3f3f3; font-weight: 700; text-align: center; }
.c-area { width: 14%; }
.c-method { width: 11%; }
.c-detail { width: 75%; }
.area, .method { text-align: center; font-weight: 700; }
.text { text-align: left; vertical-align: top; height: 11mm; white-space: pre-wrap; }
.sheet > tbody > tr > td.pad0 { padding: 0; vertical-align: top; }
.sites {
	display: flex;
	justify-content: space-around;
	align-items: center;
	padding: 4px 2px;
	font-size: 9.5pt;
}
.site.on { font-weight: 700; text-decoration: underline; }
.inner td { border: none; padding: 1.5px 6px; font-size: 9pt; text-align: left; width: 50%; }
.chk-on { font-weight: 700; }
.ex-grid { height: 100%; }
.ex-grid td { vertical-align: top; padding: 0; }
.ex-grid td.lists { width: 50%; }
.ex-grid td.diagram {
	width: 50%;
	border-left: 1px solid #000;
	text-align: center;
	vertical-align: middle;
	padding: 1.5mm;
}
.ex-grid td.diagram img {
	width: 100%;
	max-height: 95mm;
	object-fit: contain;
}
.ex-simple { border-top: 1px solid #000; }
.foot-label { text-align: center; font-weight: 700; background: #f3f3f3; }
@media print {
	.page { width: 100%; min-height: auto; padding: 0; }
	body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
@page { size: A4; margin: 8mm; }
`;

function buildPage(row: V32010PrintRow): string {
	const facilityCode = cell(row, '장기요양기관기호', '장기요양기간기호');
	const facilityName = cell(row, '장기요양기관명', '장기요양기간명');
	const grade = formatGrade(cell(row, '장기요양등급'));
	const name = cell(row, '수급자성명');
	const birth = toYmd(row.생일);
	const recog = cell(row, '장기요양인정번호');
	const sex = formatSex(row.성별);
	const age = formatAge(row.나이);
	const therapist = cell(row, '치료자');
	const sdt = toYmd(row.시작일자);
	const edt = toYmd(row.종료일자);
	const planDate = [sdt, edt].filter(Boolean).join(' ~ ');
	const diagramSrc =
		typeof window !== 'undefined'
			? `${window.location.origin}/images/pt-plan-body.png`
			: '/images/pt-plan-body.png';

	return `<div class="page">
	<div class="header">
		<h1 class="title">물리치료 계획 및 평가</h1>
		<table class="approve">
			<tr><th>담당</th><th>검토</th><th>결재</th></tr>
			<tr><td class="stamp">&nbsp;</td><td class="stamp">&nbsp;</td><td class="stamp">&nbsp;</td></tr>
		</table>
	</div>
	<table class="info">
		<colgroup>
			<col style="width:8%" /><col style="width:9%" />
			<col style="width:8%" /><col style="width:9%" />
			<col style="width:8%" /><col style="width:8%" />
			<col style="width:8%" /><col style="width:8%" />
			<col style="width:12%" /><col style="width:7%" />
			<col style="width:8%" /><col style="width:7%" />
		</colgroup>
		<tr>
			<th colspan="2">장기요양기관기호</th><td colspan="2">${esc(facilityCode)}</td>
			<th colspan="2">장기요양기관명</th><td colspan="2">${esc(facilityName)}</td>
			<th colspan="2">장기요양등급</th><td colspan="2">${esc(grade)}</td>
		</tr>
		<tr>
			<th colspan="2">수급자성명</th><td colspan="2">${esc(name)}</td>
			<th colspan="2">생일</th><td colspan="2">${esc(birth)}</td>
			<th colspan="2">장기요양인정번호</th><td colspan="2">${esc(recog)}</td>
		</tr>
		<tr>
			<th>성별</th><td>${esc(sex)}</td>
			<th>연령</th><td>${esc(age)}</td>
			<th colspan="2">치료자</th><td colspan="2">${esc(therapist)}</td>
			<th colspan="2">물리치료 계획일자</th><td colspan="2">${esc(planDate)}</td>
		</tr>
	</table>
	<table class="sheet">
		<colgroup>
			<col class="c-area" />
			<col class="c-method" />
			<col class="c-detail" />
		</colgroup>
		<thead>
			<tr><th>영역</th><th>급여방법</th><th>급여세부내역</th></tr>
		</thead>
		<tbody>
			<tr>
				<td class="area" rowspan="2">목표 및 평가</td>
				<td class="method">목표</td>
				<td class="text">${esc(cell(row, '장기적목표'))}</td>
			</tr>
			<tr>
				<td class="method">평가</td>
				<td class="text">${esc(cell(row, '장기적평가'))}</td>
			</tr>
			<tr>
				<td class="area" rowspan="3">신체활동 및 재활영역</td>
				<td class="method">진단명</td>
				<td class="text">${esc(cell(row, '진단명'))}</td>
			</tr>
			<tr>
				<td class="method">문제점</td>
				<td class="text">${esc(cell(row, '문제점'))}</td>
			</tr>
			<tr>
				<td class="method">제공방법</td>
				<td class="text">${esc(cell(row, '대체방안'))}</td>
			</tr>
			<tr>
				<td class="area"></td>
				<td class="method">치료부위</td>
				<td class="pad0">${sites(row)}</td>
			</tr>
			<tr>
				<td class="area" rowspan="2">운동치료</td>
				<td class="method">기구이용</td>
				<td class="pad0" rowspan="2">
					<table class="ex-grid">
						<tr>
							<td class="lists">${pairTable(row, EQUIP_L, EQUIP_R)}</td>
							<td class="diagram" rowspan="2">
								<img src="${esc(diagramSrc)}" alt="치료부위" />
							</td>
						</tr>
						<tr>
							<td class="lists ex-simple">${pairTable(row, SIMPLE_L, SIMPLE_R)}</td>
						</tr>
					</table>
				</td>
			</tr>
			<tr>
				<td class="method">단순운동</td>
			</tr>
			<tr>
				<td class="area">Modalities</td>
				<td class="method"></td>
				<td class="pad0">${pairTable(row, MOD_L, MOD_R)}</td>
			</tr>
			<tr>
				<td class="area" rowspan="3">기타치료</td>
				<td class="method">기타치료1</td>
				<td class="text">${esc(cell(row, 'PETC_1'))}</td>
			</tr>
			<tr>
				<td class="method">기타치료2</td>
				<td class="text">${esc(cell(row, 'PETC_2'))}</td>
			</tr>
			<tr>
				<td class="method">기타치료3</td>
				<td class="text">${esc(cell(row, 'PETC_3'))}</td>
			</tr>
			<tr>
				<td class="foot-label">급여 제공 횟수</td>
				<td class="text" colspan="2">${esc(cell(row, '급여제공횟수'))}</td>
			</tr>
		</tbody>
	</table>
</div>`;
}

function openPrintWindow(html: string): void {
	const w = window.open('', '_blank');
	if (!w) {
		alert('팝업이 차단되어 출력을 열 수 없습니다.');
		return;
	}
	w.document.write(html);
	w.document.close();
	const waitImages = () => {
		const imgs = Array.from(w.document.images);
		if (imgs.length === 0) return Promise.resolve();
		return Promise.all(
			imgs.map((img) =>
				img.complete
					? Promise.resolve()
					: new Promise<void>((resolve) => {
							img.onload = () => resolve();
							img.onerror = () => resolve();
						})
			)
		);
	};
	void waitImages().then(() => {
		setTimeout(() => {
			try {
				w.focus();
				w.print();
			} catch {
				/* ignore */
			}
		}, 150);
	});
}

function ageFromBirth(raw: unknown): string {
	const s = String(raw ?? '').trim();
	const ymd = s.replace(/\D/g, '');
	if (ymd.length < 8) return '';
	const y = parseInt(ymd.slice(0, 4), 10);
	const m = parseInt(ymd.slice(4, 6), 10);
	const d = parseInt(ymd.slice(6, 8), 10);
	if (!Number.isFinite(y) || y < 1900) return '';
	const today = new Date();
	let age = today.getFullYear() - y;
	const md = (today.getMonth() + 1) * 100 + today.getDate();
	if (md < m * 100 + d) age -= 1;
	return String(age);
}

/** 화면에 열린 계획 내용을 인쇄행으로 변환합니다. V32010 재조회가 아닙니다. */
export function buildPlanPrintRowFromScreen(input: {
	member: Record<string, unknown>;
	form: Record<string, string>;
	facilityCode?: string;
	facilityName?: string;
}): V32010PrintRow {
	const { member, form } = input;
	const flags: Record<string, string> = {};
	Object.keys(form).forEach((k) => {
		if (/^P(STD|CHK)\d{2}$/.test(k) || /^PETC_\d+$/.test(k)) flags[k] = form[k];
	});
	return {
		수급자성명: String(member.P_NM ?? ''),
		성별: String(member.P_SEX ?? ''),
		생일: String(member.P_BRDT ?? ''),
		나이: ageFromBirth(member.P_BRDT),
		장기요양등급: String(member.P_GRD ?? ''),
		장기요양인정번호: String(member.P_YYNO ?? member.P_NO ?? ''),
		장기요양기관기호: input.facilityCode ?? '',
		장기요양기관명: input.facilityName ?? '',
		시작일자: form.SDT ?? '',
		종료일자: form.EDT ?? '',
		진단명: form.P_DIAG ?? '',
		문제점: form.P_PROBLEM ?? '',
		대체방안: form.P_WAY ?? '',
		장기적목표: form.P_PLAN ?? '',
		장기적평가: form.P_JUDGE ?? '',
		급여제공횟수: form.P_TEXT_CNT ?? '',
		치료자: form.JHEMPNM ?? '',
		...flags,
	};
}

export function openPhysicalTherapyPlanPrint(rows: V32010PrintRow[]): void {
	if (!rows.length) {
		alert('출력할 물리치료 계획 및 평가가 없습니다.');
		return;
	}
	const body = rows.map((row) => buildPage(row)).join('\n');
	const title =
		rows.length === 1
			? `물리치료 계획 및 평가${cell(rows[0], '수급자성명') ? ` - ${cell(rows[0], '수급자성명')}` : ''}`
			: `물리치료 계획 및 평가 (${rows.length}건)`;
	openPrintWindow(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title>${esc(title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
${body}
</body>
</html>`);
}
