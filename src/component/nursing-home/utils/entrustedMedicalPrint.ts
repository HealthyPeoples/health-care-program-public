/**
 * @file 요양원 유틸 — entrustedMedicalPrint.ts
 *
 * @description
 * 요양원 도메인 공통 유틸리티입니다.
 *
 * @module component/nursing-home/utils/entrustedMedicalPrint
 */
/** 촉탁의 진료비/진료기록부 출력 HTML */

function esc(v: unknown): string {
	return String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function sexLabel(v: unknown): string {
	const s = String(v ?? '').trim();
	if (s === '1' || s === '남' || s === 'M') return '남';
	if (s === '2' || s === '여' || s === 'F') return '여';
	return s;
}

function hpGuLabel(v: unknown): string {
	const s = String(v ?? '').trim();
	if (s === '1') return '초진';
	if (s === '2') return '재진';
	return s;
}

function formatBirth(v: unknown): string {
	if (v == null || v === '') return '';
	if (v instanceof Date && !Number.isNaN(v.getTime())) {
		const y = v.getFullYear();
		const m = String(v.getMonth() + 1).padStart(2, '0');
		const d = String(v.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	const s = String(v).trim();
	if (!s) return '';
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (s.includes('T') && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	const parsed = Date.parse(s);
	if (!Number.isNaN(parsed)) {
		const dt = new Date(parsed);
		const y = dt.getFullYear();
		const m = String(dt.getMonth() + 1).padStart(2, '0');
		const d = String(dt.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}
	return s;
}

function money(v: unknown): string {
	if (v == null || v === '') return '';
	const n = Number(v);
	if (!Number.isFinite(n)) return esc(v);
	return n.toLocaleString('ko-KR');
}

export function openPrintWindow(html: string) {
	const w = window.open('', '_blank');
	if (!w) {
		alert('팝업이 차단되어 출력을 열 수 없습니다.');
		return;
	}
	w.document.write(html);
	w.document.close();
	w.onload = () => {
		w.focus();
		w.print();
	};
}

export type FeePrintRow = {
	P_NM?: string;
	P_SEX?: string;
	P_BRDT?: string;
	HPDT?: string;
	HP_TERM_TM?: string;
	HP_GU?: string;
	HP_CNT?: number | string | null;
	HP_AMT?: number | string | null;
	HP_PRE_AMT?: number | string | null;
	HP_PAY_DT?: string;
	HP_PAY_AMT?: number | string | null;
};

/** 촉탁의 진료비 내역서 */
export function buildFeeStatementHtml(
	rows: FeePrintRow[],
	meta: { startDate: string; endDate: string }
): string {
	const body = rows
		.map(
			(r) => `
    <tr>
      <td>${esc(r.P_NM)}</td>
      <td>${esc(sexLabel(r.P_SEX))}</td>
      <td>${esc(formatBirth(r.P_BRDT))}</td>
      <td>${esc(r.HPDT)}</td>
      <td>${esc(r.HP_TERM_TM)}</td>
      <td>${esc(hpGuLabel(r.HP_GU))}</td>
      <td>${esc(r.HP_CNT ?? '')}</td>
      <td class="num">${money(r.HP_AMT)}</td>
      <td class="num">${money(r.HP_PRE_AMT)}</td>
      <td>${esc(r.HP_PAY_DT)}</td>
      <td class="num">${money(r.HP_PAY_AMT)}</td>
    </tr>`
		)
		.join('');

	const sumAmt = rows.reduce((a, r) => a + (Number(r.HP_AMT) || 0), 0);
	const sumPre = rows.reduce((a, r) => a + (Number(r.HP_PRE_AMT) || 0), 0);
	const sumPay = rows.reduce((a, r) => a + (Number(r.HP_PAY_AMT) || 0), 0);

	return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>촉탁의 진료비 내역서</title>
<style>
@page { size: A4 landscape; margin: 8mm; }
body { font-family: 'Malgun Gothic','맑은 고딕',sans-serif; font-size: 9pt; margin: 0; padding: 8mm; }
.title { text-align: center; font-size: 18pt; font-weight: bold; text-decoration: underline; margin: 0 0 8px; letter-spacing: 2px; }
.top { position: relative; min-height: 48px; margin-bottom: 6px; }
.sig { position: absolute; top: 0; right: 0; border-collapse: collapse; width: 140px; font-size: 8pt; }
.sig th, .sig td { border: 1px solid #000; padding: 2px 4px; text-align: center; }
.sig td { height: 28px; }
.period { margin: 6px 0 8px; font-size: 10pt; }
table.main { width: 100%; border-collapse: collapse; border-top: 2px solid #000; border-bottom: 2px solid #000; font-size: 8pt; }
table.main th, table.main td { border: 1px solid #000; padding: 3px 2px; text-align: center; vertical-align: middle; }
table.main th { background: #f5f5f5; }
td.num { text-align: right; padding-right: 4px; }
.footer { margin-top: 10px; display: flex; justify-content: space-between; font-size: 9pt; }
.sum-label { text-align: left; padding-left: 6px; font-weight: bold; }
</style></head><body>
  <div class="title">촉탁의 진료비 내역서</div>
  <div class="top">
    <table class="sig"><tr><th>담당</th><th>검토</th><th>결제</th></tr><tr><td></td><td></td><td></td></tr></table>
  </div>
  <div class="period">기간: ${esc(meta.startDate)} ~ ${esc(meta.endDate)}</div>
  <table class="main">
    <thead>
      <tr>
        <th>수급자</th><th>성별</th><th>생일</th><th>진료일자</th><th>진료시간</th>
        <th>진료구분</th><th>건수</th><th>본인부담금</th><th>처방비</th><th>수납일자</th><th>정산금액</th>
      </tr>
    </thead>
    <tbody>
      ${body || `<tr><td colspan="11" style="padding:16px;">데이터가 없습니다</td></tr>`}
      <tr>
        <td colspan="7" class="sum-label">수급자진료비계</td>
        <td class="num">${money(sumAmt)}</td>
        <td class="num">${money(sumPre)}</td>
        <td></td>
        <td class="num">${money(sumPay)}</td>
      </tr>
      <tr>
        <td colspan="7" class="sum-label">촉탁의 진료비 합계</td>
        <td class="num">${money(sumAmt)}</td>
        <td class="num">${money(sumPre)}</td>
        <td></td>
        <td class="num">${money(sumPay)}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer"><span>R11070C</span><span>페이지: 1</span></div>
</body></html>`;
}

export type RecordPrintMeta = {
	startDate: string;
	endDate: string;
	facilityCode?: string;
	facilityName?: string;
	grade?: string;
	name?: string;
	rrn?: string;
	recogNo?: string;
	sex?: string;
	age?: string;
	admitDate?: string;
	mainSymptom?: string;
};

export type RecordProgressRow = {
	visitDate: string;
	note: string;
	doctor?: string;
};

/** 진료기록지 */
export function buildMedicalRecordHtml(meta: RecordPrintMeta, progress: RecordProgressRow[]): string {
	const rows = progress
		.map(
			(p) => `
    <tr>
      <td class="date">${esc(p.visitDate)}</td>
      <td class="note">${esc(p.note)}</td>
      <td class="sign">${esc(p.doctor)}</td>
    </tr>`
		)
		.join('');

	// 빈 행 보충
	const emptyCount = Math.max(0, 8 - progress.length);
	const empties = Array.from({ length: emptyCount })
		.map(
			() => `<tr><td class="date">&nbsp;</td><td class="note">&nbsp;</td><td class="sign">&nbsp;</td></tr>`
		)
		.join('');

	const bodyDiagramSrc =
		typeof window !== 'undefined'
			? `${window.location.origin}/images/body-diagram.png`
			: '/images/body-diagram.png';

	return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>진료기록지</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
body { font-family: 'Malgun Gothic','맑은 고딕',sans-serif; font-size: 9pt; margin: 0; padding: 8mm; }
.title { text-align: center; font-size: 18pt; font-weight: bold; margin: 0 0 10px; letter-spacing: 4px; }
.top { position: relative; margin-bottom: 8px; }
.sig { position: absolute; top: 0; right: 0; border-collapse: collapse; width: 140px; font-size: 8pt; }
.sig th, .sig td { border: 1px solid #000; padding: 2px 4px; text-align: center; }
.sig td { height: 28px; }
.info { width: calc(100% - 150px); border-collapse: collapse; border: 1px solid #000; }
.info td { border: 1px solid #000; padding: 4px 6px; }
.info .label { font-weight: bold; text-align: center; width: 110px; white-space: nowrap; }
.symptom-wrap { display: flex; border: 1px solid #000; margin-top: 8px; min-height: 110px; }
.symptom-left { flex: 1; border-right: 1px solid #000; padding: 4px; }
.symptom-left .h { font-weight: bold; margin-bottom: 4px; }
.symptom-right { width: 200px; display: flex; align-items: center; justify-content: center; padding: 4px; }
.symptom-right img { max-width: 100%; max-height: 120px; object-fit: contain; }
.progress { width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #000; }
.progress th, .progress td { border: 1px solid #000; padding: 4px; vertical-align: top; }
.progress th { background: #f5f5f5; text-align: center; }
.progress .date { width: 14%; text-align: center; }
.progress .note { width: 66%; min-height: 28px; white-space: pre-wrap; }
.progress .sign { width: 20%; text-align: center; }
.footer { margin-top: 10px; display: flex; justify-content: space-between; }
</style></head><body>
  <div class="title">진료기록지</div>
  <div class="top">
    <table class="sig"><tr><th>담당</th><th>검토</th><th>결제</th></tr><tr><td></td><td></td><td></td></tr></table>
    <table class="info">
      <tr>
        <td class="label">장기요양기관기호</td><td>${esc(meta.facilityCode)}</td>
        <td class="label">장기요양기관명</td><td>${esc(meta.facilityName)}</td>
        <td class="label">장기요양등급</td><td>${esc(meta.grade)}</td>
      </tr>
      <tr>
        <td class="label">수급자성명</td><td>${esc(meta.name)}</td>
        <td class="label">주민등록번호</td><td>${esc(meta.rrn)}</td>
        <td class="label">장기요양인정번호</td><td>${esc(meta.recogNo)}</td>
      </tr>
      <tr>
        <td class="label">성별</td><td>${esc(sexLabel(meta.sex))}</td>
        <td class="label">연령</td><td>${esc(meta.age)}${meta.age ? ' 만 세' : ''}</td>
        <td class="label">입소일</td><td>${esc(meta.admitDate)}</td>
      </tr>
    </table>
  </div>
  <div class="symptom-wrap">
    <div class="symptom-left">
      <div class="h">주요증상</div>
      <div>${esc(meta.mainSymptom)}</div>
    </div>
    <div class="symptom-right">
      <img src="${esc(bodyDiagramSrc)}" alt="인체도" />
    </div>
  </div>
  <table class="progress">
    <thead><tr><th>방문날짜</th><th>Progress Note</th><th>의사서명</th></tr></thead>
    <tbody>${rows}${empties}</tbody>
  </table>
  <div class="footer"><span>R11070A</span><span>페이지: 1</span></div>
</body></html>`;
}

/** V11070A 행 → Progress Note 텍스트 */
export function mapV11070aToProgress(rows: Record<string, unknown>[]): RecordProgressRow[] {
	return rows.map((r) => {
		const visitDate = String(r.HCADT || r.HPDT || r['진료일자'] || '').slice(0, 10);
		const parts = [
			r['서비스영역'] != null && r['서비스영역'] !== '' ? `영역: ${r['서비스영역']}` : '',
			r['문제도출'] != null && r['문제도출'] !== '' ? `문제: ${r['문제도출']}` : '',
			r['서비스항목'] != null && r['서비스항목'] !== '' ? `항목: ${r['서비스항목']}` : '',
			r['서비스시간'] != null && r['서비스시간'] !== '' ? `시간: ${r['서비스시간']}` : '',
			r.HPDES1 != null && r.HPDES1 !== '' ? String(r.HPDES1) : '',
			r.HPDES2 != null && r.HPDES2 !== '' ? String(r.HPDES2) : '',
		].filter(Boolean);
		return {
			visitDate,
			note: parts.join('\n'),
			doctor: String(r.HPDTR || r['의사'] || ''),
		};
	});
}
