/**
 * @file 욕구사정기록 — 인쇄 헬퍼 (needsAssessmentRecordPrint.ts)
 *
 * @description
 * 요양원 욕구사정기록 기능의 인쇄 헬퍼입니다. 폴더: component/nursing-home/pages/needs-assessment-record
 *
 * @module component/nursing-home/pages/needs-assessment-record/needsAssessmentRecordPrint
 */
import { formatCareGradeLabel } from '../../utils/careGrade';
import {
	PHYSICAL_ACTIVITY_GROUPS,
	DISEASE1_CATEGORIES,
	DISEASE2_CATEGORIES,
	NURSING_GROUPS,
	COG_GROUPS,
	H01_OPTIONS,
	H02_OPTIONS,
	H03_OPTIONS,
	H04_OPTIONS,
	I01_OPTIONS,
	I02_OPTIONS,
	I03_OPTIONS,
	I05_OPTIONS,
	I06_OPTIONS,
	I07_OPTIONS,
	I08_OPTIONS,
	C20_OPTIONS,
	C21_OPTIONS,
	C22_OPTIONS,
	C23_OPTIONS,
	E13_OPTIONS,
	E14_OPTIONS,
	E16_OPTIONS,
	E17_OPTIONS,
	J01_OPTIONS,
	J01_01_OPTIONS,
	J02_OPTIONS,
	J02_02_OPTIONS,
	J02_04_OPTIONS,
	J03_OPTIONS,
	J04_OPTIONS,
	J05_OPTIONS,
	K01_OPTIONS,
	COMMUNITY_SERVICE_ITEMS,
	INDIVIDUAL_NEED_ITEMS,
	emptySnapshot,
	type F51012UiSnapshot,
} from './f51012Mapper';

export type NeedsAssessmentPrintMember = {
	P_NM?: string | null;
	P_SEX?: string | null;
	P_GRD?: string | null;
	P_BRDT?: string | null;
	P_YYNO?: string | null;
	P_NO?: string | null;
	sexName?: string | null;
	age?: string | null;
	gradeName?: string | null;
};

function pickRow(row: Record<string, unknown>, ...keys: string[]): string {
	for (const k of keys) {
		if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
		const found = Object.keys(row).find((x) => x === k || x.toUpperCase() === k.toUpperCase());
		if (found != null && row[found] != null && String(row[found]).trim() !== '') {
			return String(row[found]).trim();
		}
	}
	return '';
}

/** V51012 뷰 행 → 출력 헤더용 수급자 정보 */
export function printMemberFromViewRow(
	row: Record<string, unknown>,
	fallback: NeedsAssessmentPrintMember = {}
): NeedsAssessmentPrintMember {
	return {
		P_NM: pickRow(row, '수급자성명', 'P_NM') || fallback.P_NM || '',
		P_SEX: pickRow(row, 'P_SEX') || fallback.P_SEX || '',
		P_GRD: pickRow(row, 'P_GRD') || fallback.P_GRD || '',
		P_BRDT: formatYmd(pickRow(row, '수급자생일', 'P_BRDT')) || fallback.P_BRDT || '',
		P_YYNO: pickRow(row, '장기요양인정번호', 'P_YYNO') || fallback.P_YYNO || '',
		P_NO: fallback.P_NO || '',
		sexName: pickRow(row, '성별') || fallback.sexName || '',
		age: pickRow(row, '수급자나이') || fallback.age || '',
		gradeName: pickRow(row, '장기요양등급') || fallback.gradeName || '',
	};
}

/** A/3 완전자립 ○ · B/2 간접도움 △ · C 직접도움 ▲ · D/1 완전도움 Ⅹ */
function activityMark(code: string): string {
	const s = String(code || '').trim();
	if (s === 'A' || s === '3' || s === '4') return '○';
	if (s === 'B' || s === '2') return '△';
	if (s === 'C') return '▲';
	if (s === 'D' || s === '1') return 'Ⅹ';
	return '';
}

function esc(v: unknown): string {
	return String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function formatYmd(raw: unknown): string {
	const s = String(raw ?? '').trim();
	if (!s) return '';
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
	if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
	if (s.includes('T')) return s.split('T')[0];
	return s;
}

function sexLabel(sex: unknown): string {
	const s = String(sex ?? '').trim();
	if (s === '1') return '남';
	if (s === '2') return '여';
	return s || '';
}

function calcAge(birthDate: unknown): string {
	const ymd = formatYmd(birthDate);
	if (!ymd || ymd.length < 4) return '';
	const year = parseInt(ymd.slice(0, 4), 10);
	if (!Number.isFinite(year)) return '';
	return String(new Date().getFullYear() - year);
}

function nl(text: string): string {
	return esc(text).replace(/\r\n|\n|\r/g, '<br/>');
}

function mark(on: boolean): string {
	return on ? 'V' : '';
}

function optionMarks(code: string, options: { code: string; label: string }[]): string {
	return options
		.map((o) => `<span class="opt">${mark(code === o.code) ? '<b>V</b> ' : ''}${esc(o.label)}</span>`)
		.join('&nbsp;&nbsp;');
}

function labelOf(code: string, options: { code: string; label: string }[]): string {
	return options.find((o) => o.code === code)?.label || '';
}

/** 원본 기록지 2쪽 재활 4×4 격자 */
const REHAB_PRINT_GRID: string[][] = [
	['우측상지', '좌측상지', '우측하지', '좌측하지'],
	['어깨관절(좌)', '어깨관절(우)', '팔꿈치관절(좌)', '팔꿈치관절(우)'],
	['손목 및 수지관절(좌)', '손목 및 수지관절(우)', '고관절(좌)', '고관절(우)'],
	['무릎관절(좌)', '무릎관절(우)', '발목관절(좌)', '발목관절(우)'],
];

function pageFooter(n: number): string {
	return `<div class="footer">- ${n} -</div>`;
}

function sectionTitle(text: string, note = '※ 표기 : □에 V표'): string {
	return `<div class="secHead"><span>${esc(text)}</span><span class="note">${esc(note)}</span></div>`;
}

function diseaseRowsHtml(categories: { category: string; diseases: string[] }[], data: Record<string, boolean>): string {
	return categories
		.map((row) => {
			const diseases = row.diseases
				.map((d) => {
					const on = !!data[`${row.category}-${d}`];
					return `<span class="opt">${on ? '<b>V</b> ' : ''}${esc(d)}</span>`;
				})
				.join('&nbsp;&nbsp;');
			return `<tr><td class="cat">${esc(row.category)}</td><td>${diseases}</td></tr>`;
		})
		.join('');
}

function optionWithOther(code: string, options: { code: string; label: string }[], otherCode: string, other: string): string {
	const extra = code === otherCode && other ? ` (${esc(other)})` : '';
	return `${optionMarks(code, options)}${extra}`;
}

export function buildNeedsAssessmentPrintHtml(
	snap: F51012UiSnapshot,
	member: NeedsAssessmentPrintMember,
	opts?: { blank?: boolean }
): string {
	const name = snap.formData.beneficiary || member.P_NM || '';
	const rqdt = formatYmd(snap.formData.creationDate);
	const creator = snap.formData.creator || '';
	const height = snap.formData.height || '0.0';
	const weight = snap.formData.weight || '0.0';
	const birth = formatYmd(member.P_BRDT);
	const sex = member.sexName || sexLabel(member.P_SEX);
	const age = String(member.age ?? '').trim() || calcAge(member.P_BRDT);
	const grade = member.gradeName || formatCareGradeLabel(member.P_GRD, '');
	const yyno = String(member.P_YYNO ?? '').trim();
	const recog = yyno ? `${yyno}${grade ? ` / ${grade}` : ''}` : grade;
	const titleSuffix = opts?.blank ? ' (빈 양식)' : '';

	const actMap = new Map(snap.activities.map((a) => [a.key, a.value]));
	const adlHtml = PHYSICAL_ACTIVITY_GROUPS.map((grp) => {
		const rows = grp.items
			.map((it) => {
				const code = actMap.get(it.key) || '';
				return `<tr><td class="item">${esc(it.label)}</td><td class="chk">${esc(activityMark(code))}</td></tr>`;
			})
			.join('');
		return `<td class="adlCol"><div class="adlHead">${esc(grp.group)}</div><table class="inner"><tr><th>항목</th><th>확인</th></tr>${rows}</table></td>`;
	}).join('');

	const rehabHtml = REHAB_PRINT_GRID.map(
		(row) =>
			`<tr>${row
				.map((it) => `<td><span class="chkBox">${mark(!!snap.rehabilitationData[it])}</span>${esc(it)}</td>`)
				.join('')}</tr>`
	).join('');

	const nurseItems = NURSING_GROUPS.flatMap((g) => g.items);
	const nurseCols = 5;
	const nurseRows: string[] = [];
	for (let i = 0; i < nurseItems.length; i += nurseCols) {
		const cells = nurseItems.slice(i, i + nurseCols).map(
			(it) => `<td><span class="chkBox">${mark(!!snap.nursingData[it])}</span>${esc(it)}</td>`
		);
		while (cells.length < nurseCols) cells.push('<td></td>');
		nurseRows.push(`<tr>${cells.join('')}</tr>`);
	}
	const nursingHtml = nurseRows.join('');

	const cogHtml = COG_GROUPS.flatMap((grp) => grp.labels)
		.map(
			(it, i) =>
				`<tr><td class="num">${i + 1}</td><td>${esc(it)}</td><td class="chk">${mark(!!snap.cognitionData[it])}</td></tr>`
		)
		.join('');

	const j01 = snap.familyEnvironmentData.maritalStatus;
	const j0101 = snap.familyEnvironmentData.spouseSurvivalStatus;
	const j02 = snap.familyEnvironmentData.primaryCaregiver;
	const j0202 = snap.familyEnvironmentData.primaryCaregiverRelationship;
	const j0204 = snap.familyEnvironmentData.primaryCaregiverEconomicStatus;
	const j03 = snap.familyEnvironmentData.cohabitant;
	const k01 = snap.resourceUtilizationData.religion;
	const k01Label = labelOf(k01, K01_OPTIONS);

	const communityHtml = COMMUNITY_SERVICE_ITEMS.map((it) => {
		const on =
			it.col === 'K03_03'
				? snap.resourceUtilizationData.housingImprovementProject
				: !!snap.resourceUtilizationData.communityServices[it.key];
		return `<span class="opt">${on ? '<b>V</b> ' : ''}${esc(it.label)}</span>`;
	}).join('&nbsp;&nbsp;');

	const coreNeedHeads = INDIVIDUAL_NEED_ITEMS.slice(0, 3)
		.map((it) => `<th>${esc(it.label)}</th>`)
		.join('');
	const coreNeeds = INDIVIDUAL_NEED_ITEMS.slice(0, 3)
		.map((it) => {
			const on = !!(snap.individualNeedsData as Record<string, unknown>)[it.field];
			return `<td class="center chkBig">${mark(on)}</td>`;
		})
		.join('');
	const extraNeeds = INDIVIDUAL_NEED_ITEMS.slice(3)
		.map((it) => {
			const on = !!(snap.individualNeedsData as Record<string, unknown>)[it.field];
			return `<span class="opt">${on ? '<b>V</b> ' : ''}${esc(it.label)}</span>`;
		})
		.join('&nbsp;&nbsp;');

	const page1 = `
<div class="page p1">
	<div class="topMeta">
		<table class="metaBox">
			<tr>
				<th>작성일</th><td>${esc(rqdt)}</td>
				<th>작성자</th><td>${esc(creator)}</td>
			</tr>
		</table>
	</div>
	<h1 class="title">욕구사정 기록지${esc(titleSuffix)}</h1>
	<table class="info">
		<tr>
			<th>수급자성명</th><td>${esc(name)}</td>
			<th>키</th><td>${esc(height)}</td>
			<th>생년월일</th><td>${esc(birth)}</td>
		</tr>
		<tr>
			<th>인정번호/등급</th><td>${esc(recog)}</td>
			<th>체중</th><td>${esc(weight)}</td>
			<th>성별/연령</th><td>${esc(sex)}${age ? ` / ${esc(age)}` : ''}</td>
		</tr>
	</table>

	${sectionTitle('1. 신체상태(일상생활동작 수행능력)', '※ 표기 : Ⅹ 완전도움, △ 간접도움, ▲ 직접도움, ○ 완전자립')}
	<table class="adlWrap"><tr>${adlHtml}</tr></table>
	<table class="block compact2">
		<tr>
			<th>배설양상</th><td>${optionMarks(snap.nutritionData.excretionPattern, I05_OPTIONS)}</td>
			<th>배뇨기능</th><td>${optionMarks(snap.physicalExtra.urineFunction, C20_OPTIONS)}</td>
		</tr>
		<tr>
			<th>배변기능</th><td>${optionMarks(snap.physicalExtra.bowelFunction, C21_OPTIONS)}</td>
			<th>배뇨방법</th><td>${optionMarks(snap.physicalExtra.urineMethod, C22_OPTIONS)}</td>
		</tr>
		<tr>
			<th>배변방법</th><td colspan="3">${optionMarks(snap.physicalExtra.bowelMethod, C23_OPTIONS)}</td>
		</tr>
		<tr><th>판단근거</th><td colspan="3" class="basisText fillPhys">${nl(snap.formData.judgmentBasis)}</td></tr>
	</table>

	${sectionTitle('2. 질병상태')}
	<div class="grow">
	<table class="block fillTable">
		<tr><th class="cat">질병분류</th><th>질병명</th></tr>
		${diseaseRowsHtml(DISEASE1_CATEGORIES, snap.disease1Data)}
		${diseaseRowsHtml(DISEASE2_CATEGORIES, snap.disease2Data)}
		<tr class="fill"><th>기타 질환 상세</th><td class="basisText">${nl(snap.diseaseFormData.otherDiseaseNote)}</td></tr>
		<tr class="fill"><th>과거병력</th><td class="basisText">${esc(snap.diseaseFormData.pastMedicalHistory)}</td></tr>
		<tr class="fill"><th>현 진단명</th><td class="basisText">${esc(snap.diseaseFormData.currentDiagnosis)}</td></tr>
		<tr class="growRow"><th>판단근거</th><td class="basisText">${nl(snap.diseaseFormData.judgmentBasis)}</td></tr>
	</table>
	</div>
	${pageFooter(1)}
</div>`;

	const page2 = `
<div class="page p2">
	${sectionTitle('3. 재활상태')}
	<table class="block rehabTable">${rehabHtml}</table>
	<table class="block">
		<tr><th>관절구축</th><td>${optionMarks(snap.rehabilitationExtra.contractureYn, E13_OPTIONS)}${snap.rehabilitationExtra.contractureSite ? ` / 부위: ${esc(snap.rehabilitationExtra.contractureSite)}` : ''}</td></tr>
		<tr><th>마비(운동장애)</th><td>${optionMarks(snap.rehabilitationExtra.paralysis, E14_OPTIONS)}</td></tr>
		<tr><th>근위축</th><td>${optionMarks(snap.rehabilitationExtra.atrophyYn, E13_OPTIONS)}${snap.rehabilitationExtra.atrophySite ? ` / 부위: ${esc(snap.rehabilitationExtra.atrophySite)}` : ''}</td></tr>
		<tr><th>보행</th><td>${optionMarks(snap.rehabilitationExtra.gait, E16_OPTIONS)}</td></tr>
		<tr><th>신체기능</th><td>${optionMarks(snap.rehabilitationExtra.physicalFunction, E17_OPTIONS)}</td></tr>
	</table>
	<div class="grow">
		<table class="block fillTable">
			<tr class="growRow"><th class="basis">판단근거</th><td class="basisText">${nl(snap.rehabilitationJudgmentBasis)}</td></tr>
		</table>
	</div>

	${sectionTitle('4. 간호처치 상태')}
	<table class="block nurseTable">${nursingHtml}</table>
	<div class="grow">
		<table class="block fillTable">
			<tr class="growRow"><th class="basis">판단근거</th><td class="basisText">${nl(snap.nursingJudgmentBasis)}</td></tr>
		</table>
	</div>

	${sectionTitle('5. 인지상태')}
	<p class="subNote">(인지기능저하, 정신상태, 감정, 문제행동 등)</p>
	<table class="block cog">
		<tr><th style="width:36px">No</th><th>구분</th><th style="width:48px">확인</th></tr>
		${cogHtml}
	</table>
	<div class="grow">
		<table class="block fillTable">
			<tr class="growRow"><th class="basis">판단근거</th><td class="basisText">${nl(snap.cognitionJudgmentBasis)}</td></tr>
		</table>
	</div>
	${pageFooter(2)}
</div>`;

	const page3 = `
<div class="page p3">
	${sectionTitle('6. 의사소통')}
	<table class="block">
		<tr><th>청취능력</th><td>${optionMarks(snap.communicationData.listeningAbility, H01_OPTIONS)}</td></tr>
		<tr><th>의사소통</th><td>${optionMarks(snap.communicationData.communication, H02_OPTIONS)}</td></tr>
		<tr><th>발음능력</th><td>${optionMarks(snap.communicationData.pronunciationAbility, H03_OPTIONS)}</td></tr>
		<tr><th>시력상태</th><td>${optionMarks(snap.communicationData.visionStatus, H04_OPTIONS)}</td></tr>
	</table>
	<div class="grow">
		<table class="block fillTable">
			<tr class="growRow"><th class="basis">판단근거</th><td class="basisText">${nl(snap.communicationData.judgmentBasis)}</td></tr>
		</table>
	</div>

	${sectionTitle('7. 구강과 영양')}
	<table class="block">
		<tr><th>치아상태</th><td>${optionMarks(snap.nutritionData.dentalCondition, I01_OPTIONS)}</td></tr>
		<tr><th>구강건강</th><td>${optionWithOther(snap.nutritionData.oralHealth, I06_OPTIONS, '5', snap.nutritionData.oralHealthOther)}</td></tr>
		<tr><th>식사 시 문제점</th><td>${optionMarks(snap.nutritionData.eatingProblems, I02_OPTIONS)}</td></tr>
		<tr><th>식사형태</th><td>${optionMarks(snap.nutritionData.eatingStatus, I03_OPTIONS)}</td></tr>
		<tr><th>치료식</th><td>${optionWithOther(snap.nutritionData.therapeuticDiet, I07_OPTIONS, '4', snap.nutritionData.therapeuticDietOther)}</td></tr>
		<tr><th>영양상태</th><td>${optionWithOther(snap.nutritionData.nutritionStatus, I08_OPTIONS, '5', snap.nutritionData.nutritionStatusOther)}</td></tr>
	</table>
	<div class="grow">
		<table class="block fillTable">
			<tr class="growRow"><th class="basis">판단근거</th><td class="basisText">${nl(snap.nutritionData.judgmentBasis)}</td></tr>
		</table>
	</div>

	${sectionTitle('8. 가족 및 환경 상태')}
	<table class="block">
		<tr><th>결혼여부</th><td>${optionMarks(j01, J01_OPTIONS)}</td></tr>
		<tr><th>배우자 생존여부</th><td>${optionMarks(j0101, J01_01_OPTIONS)}</td></tr>
		<tr><th>자녀수</th><td>${esc(snap.familyEnvironmentData.numberOfChildren)}${snap.familyEnvironmentData.numberOfChildren ? ' 명' : ''}</td></tr>
		<tr><th>주수발자</th><td>${optionMarks(j02, J02_OPTIONS)}</td></tr>
		<tr><th>주수발자 연령</th><td>${esc(snap.familyEnvironmentData.primaryCaregiverAge)}${snap.familyEnvironmentData.primaryCaregiverAge ? ' 세' : ''}</td></tr>
		<tr><th>주수발자 관계</th><td>${optionMarks(j0202, J02_02_OPTIONS)}${snap.familyEnvironmentData.otherRelationship ? ` (기타: ${esc(snap.familyEnvironmentData.otherRelationship)})` : ''}</td></tr>
		<tr><th>주수발자 경제상태</th><td>${optionMarks(j0204, J02_04_OPTIONS)}</td></tr>
		<tr><th>동거인</th><td>${optionMarks(j03, J03_OPTIONS)}</td></tr>
		<tr><th>주거형태</th><td>${optionWithOther(snap.familyEnvironmentData.housingType, J04_OPTIONS, '6', snap.familyEnvironmentData.housingTypeOther)}</td></tr>
		<tr><th>사회적교류</th><td>${optionMarks(snap.familyEnvironmentData.socialExchange, J05_OPTIONS)}</td></tr>
	</table>
	<div class="grow">
		<table class="block fillTable">
			<tr class="growRow"><th class="basis">판단근거</th><td class="basisText">${nl(snap.familyEnvironmentData.judgmentBasis)}</td></tr>
		</table>
	</div>
	${pageFooter(3)}
</div>`;

	const page4 = `
<div class="page p4">
	${sectionTitle('9. 자원이용 욕구', '※ 표기 : □에 V표 ___에 기재')}
	<table class="block">
		<tr><th>종교</th><td>${optionMarks(k01, K01_OPTIONS)}${k01 === '4' && snap.resourceUtilizationData.religionOther ? ` : ${esc(snap.resourceUtilizationData.religionOther)}` : k01Label === '기타' && snap.resourceUtilizationData.religionOther ? ` : ${esc(snap.resourceUtilizationData.religionOther)}` : ''}</td></tr>
		<tr><th>주이용의료기관</th><td>${esc(snap.resourceUtilizationData.primaryMedicalInstitution)}&nbsp;&nbsp;전화번호: ${esc(snap.resourceUtilizationData.phoneNumber)}</td></tr>
		<tr><th>지역사회</th><td>${communityHtml}<br/>기타: ${esc(snap.resourceUtilizationData.other)}</td></tr>
	</table>
	<div class="grow">
		<table class="block fillTable">
			<tr class="growRow"><th class="basis">판단근거</th><td class="basisText">${nl(snap.resourceUtilizationData.judgmentBasis)}</td></tr>
		</table>
	</div>

	${sectionTitle('10. 수급자 및 보호자 개별 욕구', '※ 표기 : □에 V표')}
	<table class="block needs3">
		<tr>${coreNeedHeads}</tr>
		<tr>${coreNeeds}</tr>
		<tr><td colspan="3">${extraNeeds || ''}</td></tr>
	</table>
	<div class="grow">
		<table class="block fillTable">
			<tr class="fill"><th>수급자 희망</th><td class="basisText">${nl(snap.individualNeedsData.notes)}</td></tr>
			<tr class="growRow"><th>보호자 희망</th><td class="basisText">${nl(snap.individualNeedsData.guardianNotes)}</td></tr>
		</table>
	</div>

	${sectionTitle('11. 총평', '※ 표기 : 서술형 작성')}
	<div class="grow growLg">
		<table class="block fillTable">
			<tr class="growRow"><td class="basisText overall">${nl(snap.overallAssessmentData.content)}</td></tr>
		</table>
	</div>
	${pageFooter(4)}
</div>`;

	return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title></title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
	font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
	font-size: 9.5pt;
	color: #000;
	background: #fff;
	line-height: 1.28;
	padding: 7mm 7mm 8mm;
}
@page { size: A4 portrait; margin: 0; }
@media print {
	body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.page {
	page-break-after: always;
	position: relative;
	display: flex;
	flex-direction: column;
	min-height: 282mm;
	padding-bottom: 2mm;
	box-sizing: border-box;
}
.record:last-child .page:last-child { page-break-after: auto; }
.title { text-align: center; font-size: 16pt; font-weight: 700; margin: 1.5mm 0 2mm; letter-spacing: 2px; }
.topMeta { display: flex; justify-content: flex-end; margin-bottom: 1mm; }
.metaBox { border-collapse: collapse; font-size: 9pt; table-layout: auto; }
.metaBox th, .metaBox td {
	border: 1px solid #000;
	padding: 1px 10px;
	height: 16px;
	line-height: 16px;
	white-space: nowrap;
	vertical-align: middle;
}
.metaBox th { background: #f3f3f3; min-width: 58px; width: 58px; text-align: center; font-weight: 700; }
.metaBox td { min-width: 92px; }
table.info, table.block, table.inner, table.adlWrap, table.rehabTable, table.nurseTable {
	width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 1.6mm;
}
table.info th, table.info td,
table.block th, table.block td,
table.inner th, table.inner td {
	border: 1px solid #000; padding: 2px 4px; vertical-align: middle; word-break: break-word;
}
table.info th, table.block th, table.inner th {
	background: #f5f5f5; font-weight: 700; text-align: center; width: 22%;
}
table.inner th { width: auto; padding: 1px 3px; }
table.inner td { padding: 1px 3px; }
table.inner td.item { width: 70%; }
table.inner td.chk, .chk { text-align: center; font-weight: 700; width: 30%; }
table.adlWrap > tbody > tr > td { border: none; border-right: 1px solid #000; padding: 2px 3px; vertical-align: top; width: 33.33%; }
table.adlWrap > tbody > tr > td:last-child { border-right: none; }
table.adlWrap { border: 1px solid #000; }
.adlHead { font-weight: 700; font-size: 8.5pt; margin-bottom: 1px; }
.secHead {
	display: flex; justify-content: space-between; align-items: baseline;
	font-weight: 700; font-size: 10.5pt; margin: 1.8mm 0 1mm;
}
.secHead .note { font-size: 7.5pt; font-weight: 400; }
.basis { width: 18% !important; }
.basisText { vertical-align: top !important; white-space: normal; min-height: 8mm; }
.basisText.tall { min-height: 16mm; }
.basisText.overall { min-height: 36mm; }
.cat { width: 16%; text-align: center; font-weight: 700; background: #fafafa; }
.opt { white-space: nowrap; display: inline-block; margin: 0 3px 0 0; }
.rehabTable td { border: 1px solid #000; vertical-align: middle; padding: 3px 5px; width: 25%; }
.nurseTable td { border: 1px solid #000; vertical-align: middle; padding: 3px 4px; width: 20%; white-space: nowrap; }
.chkBox {
	display: inline-block; width: 14px; text-align: center; font-weight: 700; margin-right: 3px;
}
.subNote { font-size: 8pt; margin: -0.5mm 0 1mm; }
.chkBig { font-weight: 700; font-size: 12pt; min-height: 8mm; padding-top: 1mm; }
table.needs3 td.center { text-align: center; vertical-align: top; }
table.cog td.num { width: 36px; text-align: center; }
table.cog .grp { text-align: left; background: #eee; }
.p1 {
	font-size: 8.5pt;
	line-height: 1.2;
}
.p1 .title { font-size: 15pt; margin: 0.5mm 0 1.5mm; }
.p1 .secHead { font-size: 10pt; margin: 1.2mm 0 0.7mm; }
.p1 table.info, .p1 table.block, .p1 table.adlWrap { margin-bottom: 1.1mm; }
.p1 table.block th, .p1 table.block td,
.p1 table.info th, .p1 table.info td { padding: 2px 4px; }
.p1 .basisText { min-height: 10mm; }
.p1 table.compact2 th { width: 14%; }
.p1 table.compact2 td { width: 36%; }
.p1 table.compact2 td.fillPhys { min-height: 16mm; height: 16mm; vertical-align: top; }
.grow { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }
.grow.growLg { flex: 2 1 auto; }
.fillTable { flex: 1 1 auto; height: 100%; margin-bottom: 0; }
.fillTable tbody { height: 100%; }
.fillTable tr.fill td { height: 14mm; min-height: 14mm; vertical-align: top; }
.fillTable tr.growRow { height: 100%; }
.fillTable tr.growRow td { height: 100%; min-height: 22mm; vertical-align: top; }
.footer {
	text-align: center; font-size: 9pt; margin-top: 2mm; margin-bottom: 0;
}
</style>
</head>
<body>
<div class="record">
${page1}
${page2}
${page3}
${page4}
</div>
</body>
</html>`;
}

function openPrintWindow(html: string): void {
	const w = window.open('', '_blank');
	if (!w) {
		alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
		return;
	}
	w.document.write(html);
	w.document.close();
	try {
		w.document.title = '';
	} catch {
		/* ignore */
	}
	setTimeout(() => {
		try {
			w.focus();
			w.print();
		} catch {
			/* ignore */
		}
	}, 250);
}

export function openNeedsAssessmentPrint(
	snap: F51012UiSnapshot,
	member: NeedsAssessmentPrintMember
): void {
	openPrintWindow(buildNeedsAssessmentPrintHtml(snap, member));
}

export function openNeedsAssessmentBlankPrint(member?: NeedsAssessmentPrintMember | null): void {
	const m = member || {};
	const snap = emptySnapshot(String(m.P_NM ?? '').trim(), '');
	openPrintWindow(buildNeedsAssessmentPrintHtml(snap, m, { blank: true }));
}

/** 여러 건을 한 번에 인쇄 */
export function openNeedsAssessmentBatchPrint(
	items: Array<{ snap: F51012UiSnapshot; member: NeedsAssessmentPrintMember }>
): void {
	if (!items.length) {
		alert('출력할 기록이 없습니다.');
		return;
	}
	const firstHtml = buildNeedsAssessmentPrintHtml(items[0].snap, items[0].member);
	const styleMatch = firstHtml.match(/<style>([\s\S]*?)<\/style>/i);
	const styles = styleMatch ? styleMatch[1] : '';
	const recordsHtml = items
		.map(({ snap, member }) => {
			const full = buildNeedsAssessmentPrintHtml(snap, member);
			const bodyMatch = full.match(/<body>([\s\S]*?)<\/body>/i);
			return bodyMatch ? bodyMatch[1].trim() : '';
		})
		.filter(Boolean)
		.join('\n');
	const title = `욕구사정 기록지 일괄출력 (${items.length}건)`;
	const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<title></title>
<style>${styles}</style>
</head>
<body>
${recordsHtml}
</body>
</html>`;
	openPrintWindow(html);
}
