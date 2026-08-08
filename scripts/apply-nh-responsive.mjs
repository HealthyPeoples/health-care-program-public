/**
 * Nursing-home pages: bulk responsive class replacements (Phase A/B patterns).
 * Run: node scripts/apply-nh-responsive.mjs
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("src/component/nursing-home/pages");

const REPLACEMENTS = [
	// Viewport flex roots
	[/className="flex h-\[calc\(100vh-56px\)\]"/g, 'className="flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] min-h-0"'],
	[/className="flex h-\[calc\(100vh-120px\)\]"/g, 'className="flex flex-col xl:flex-row xl:h-[calc(100vh-120px)] min-h-0"'],
	[/className=\{`flex h-\[calc\(100vh-56px\)\]([^`]*)`\}/g, 'className={`flex flex-col xl:flex-row xl:h-[calc(100vh-56px)] min-h-0$1`}'],

	// BeneficiaryListPanel / MemberListPanel className="w-1/4"
	[/className="w-1\/4"/g, 'className="w-full xl:w-1/4 xl:min-w-[240px] xl:max-w-sm shrink-0 border-b xl:border-b-0 max-h-[42vh] xl:max-h-none min-h-0 overflow-hidden"'],

	// Inline quarter panels (member list columns)
	[
		/className="flex flex-col w-1\/4 p-4 bg-white border-r border-blue-200"/g,
		'className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 p-4 bg-white border-r border-blue-200 border-b xl:border-b-0 max-h-[42vh] xl:max-h-none overflow-hidden"',
	],
	[
		/className="flex flex-col w-1\/4 px-4 py-3 border-r border-blue-200 bg-blue-50"/g,
		'className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 px-4 py-3 border-r border-blue-200 bg-blue-50 border-b xl:border-b-0 min-h-[240px] xl:min-h-0 overflow-hidden"',
	],
	[
		/className="flex flex-col w-1\/4 bg-white border-r border-blue-200"/g,
		'className="flex flex-col w-full xl:w-1/4 min-w-0 shrink-0 bg-white border-r border-blue-200 border-b xl:border-b-0 min-h-[240px] xl:min-h-0 overflow-hidden"',
	],
	[
		/className="flex flex-col w-1\/4 min-w-\[240px\] border-r border-blue-200 bg-white"/g,
		'className="flex flex-col w-full xl:w-1/4 xl:min-w-[240px] min-w-0 shrink-0 border-r border-blue-200 bg-white border-b xl:border-b-0 max-h-[42vh] xl:max-h-none overflow-hidden"',
	],

	// Third-width panels
	[
		/className="flex flex-col w-1\/3 bg-white border-r border-blue-200"/g,
		'className="flex flex-col w-full lg:w-1/3 min-w-0 shrink-0 bg-white border-r border-blue-200 border-b lg:border-b-0 max-h-[42vh] lg:max-h-none overflow-hidden"',
	],
	[/aside className="w-1\/3 shrink-0"/g, 'aside className="w-full lg:w-1/3 lg:max-w-md shrink-0 min-w-0"'],
	[/aside className="lt-no-print w-1\/3 shrink-0"/g, 'aside className="lt-no-print w-full lg:w-1/3 lg:max-w-md shrink-0 min-w-0"'],

	// Common toolbars (title + actions)
	[
		/className="flex items-center justify-between gap-2 px-4 py-3 border-b border-blue-200 bg-blue-50"/g,
		'className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-blue-200 bg-blue-50"',
	],
	[
		/className="flex items-center justify-between px-4 py-3 bg-blue-100 border-b border-blue-200"/g,
		'className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 bg-blue-100 border-b border-blue-200"',
	],
	[
		/className="flex items-center justify-between px-4 py-3 border-b border-blue-200 bg-blue-50"/g,
		'className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-blue-200 bg-blue-50"',
	],

	// Main content flex children often missing min-w-0
	[
		/className="relative flex flex-col flex-1 overflow-hidden bg-slate-50"/g,
		'className="relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden bg-slate-50"',
	],
	[
		/className="relative flex flex-1 overflow-hidden bg-slate-50"/g,
		'className="relative flex flex-1 min-w-0 min-h-0 overflow-hidden bg-slate-50"',
	],
	[
		/className="flex flex-col flex-1 overflow-hidden"/g,
		'className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden"',
	],

	// Counseling mid panel
	[
		/className="w-\[320px\] border-r border-blue-200 px-4 py-3 bg-blue-50 flex flex-col"/g,
		'className="w-full md:w-[320px] md:max-w-[40%] shrink-0 min-w-0 border-r border-blue-200 px-4 py-3 bg-blue-50 flex flex-col border-b md:border-b-0"',
	],

	// Fixed-width asides
	[/className="w-\[420px\]/g, 'className="w-full max-w-full lg:w-[420px] min-w-0'],
	[/className="w-96 /g, 'className="w-full max-w-full lg:w-96 min-w-0 '],
	[/className="min-w-\[420px\]/g, 'className="min-w-0 lg:min-w-[420px]'],
];

function walk(dir, out = []) {
	for (const name of fs.readdirSync(dir)) {
		const p = path.join(dir, name);
		const st = fs.statSync(p);
		if (st.isDirectory()) walk(p, out);
		else if (/\.(tsx|jsx)$/.test(name)) out.push(p);
	}
	return out;
}

let changedFiles = 0;
let totalHits = 0;

for (const file of walk(ROOT)) {
	let src = fs.readFileSync(file, "utf8");
	const before = src;
	let hits = 0;
	for (const [re, to] of REPLACEMENTS) {
		const n = (src.match(re) || []).length;
		if (n) {
			hits += n;
			src = src.replace(re, to);
		}
	}
	if (src !== before) {
		fs.writeFileSync(file, src, "utf8");
		changedFiles++;
		totalHits += hits;
		console.log(`updated (${hits}): ${path.relative(process.cwd(), file)}`);
	}
}

console.log(`\nDone. ${changedFiles} files, ~${totalHits} replacements.`);
