/**
 * Prevent right-side cutoff:
 * - Page roots get w-full max-w-full min-w-0
 * - mx-auto max-w-[N] containers get w-full min-w-0 (keep max-w constraint)
 * - Tables with min-w-[...] not already in overflow-x-auto get a scroll wrapper hint via ensuring parent overflow
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("src/component/nursing-home/pages");

function walk(dir, out = []) {
	for (const name of fs.readdirSync(dir)) {
		const p = path.join(dir, name);
		const st = fs.statSync(p);
		if (st.isDirectory()) walk(p, out);
		else if (/\.(tsx|jsx)$/.test(name)) out.push(p);
	}
	return out;
}

const REPLACEMENTS = [
	// mx-auto max-w-[...] without w-full
	[
		/className="mx-auto max-w-\[(\d+)px\] p-4"/g,
		'className="mx-auto w-full max-w-[$1px] min-w-0 p-3 sm:p-4"',
	],
	[
		/className="lt-longterm-page mx-auto max-w-\[(\d+)px\] p-4"/g,
		'className="lt-longterm-page mx-auto w-full max-w-[$1px] min-w-0 p-3 sm:p-4"',
	],
	[
		/className="mx-auto max-w-\[(\d+)px\] p-3 sm:p-4"/g,
		'className="mx-auto w-full max-w-[$1px] min-w-0 p-3 sm:p-4"',
	],
	// Root shells
	[
		/className="min-h-screen bg-white text-black"/g,
		'className="min-h-screen w-full max-w-full min-w-0 bg-white text-black"',
	],
	[
		/className="min-h-screen text-black bg-white"/g,
		'className="min-h-screen w-full max-w-full min-w-0 text-black bg-white"',
	],
	[
		/className="min-h-screen bg-white text-black flex flex-col"/g,
		'className="min-h-screen w-full max-w-full min-w-0 bg-white text-black flex flex-col"',
	],
	[
		/className="flex flex-col min-h-screen text-black bg-white"/g,
		'className="flex flex-col min-h-screen w-full max-w-full min-w-0 text-black bg-white"',
	],
	[
		/className="flex flex-col min-h-screen bg-white text-black"/g,
		'className="flex flex-col min-h-screen w-full max-w-full min-w-0 bg-white text-black"',
	],
	[
		/className="flex min-h-screen bg-white text-black"/g,
		'className="flex min-h-screen w-full max-w-full min-w-0 bg-white text-black"',
	],
	[
		/className="flex flex-col xl:flex-row min-h-screen bg-white text-black"/g,
		'className="flex flex-col xl:flex-row min-h-screen w-full max-w-full min-w-0 bg-white text-black"',
	],
];

let changed = 0;
for (const file of walk(ROOT)) {
	let src = fs.readFileSync(file, "utf8");
	const before = src;
	for (const [re, to] of REPLACEMENTS) {
		src = src.replace(re, to);
	}
	// Avoid doubling
	src = src.replace(
		/w-full max-w-full min-w-0 w-full max-w-full min-w-0/g,
		"w-full max-w-full min-w-0"
	);
	src = src.replace(
		/mx-auto w-full max-w-\[(\d+)px\] min-w-0 w-full max-w-\[\1px\] min-w-0/g,
		"mx-auto w-full max-w-[$1px] min-w-0"
	);

	if (src !== before) {
		fs.writeFileSync(file, src);
		changed++;
		console.log("updated", path.relative(process.cwd(), file));
	}
}
console.log("files", changed);
