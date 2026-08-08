/**
 * Second pass: toolbar flex-wrap on remaining justify-between headers.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("src/component/nursing-home/pages");

const REPLACEMENTS = [
	[
		/className="flex items-center justify-between(?! gap)/g,
		'className="flex flex-wrap items-center justify-between gap-2',
	],
	[
		/className="flex items-center justify-between gap-3/g,
		'className="flex flex-wrap items-center justify-between gap-3',
	],
	[
		/className="flex items-center justify-between gap-4/g,
		'className="flex flex-wrap items-center justify-between gap-4',
	],
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

let n = 0;
for (const file of walk(ROOT)) {
	let src = fs.readFileSync(file, "utf8");
	const before = src;
	for (const [re, to] of REPLACEMENTS) {
		// Avoid double flex-wrap
		src = src.replace(re, (match) => {
			if (match.includes("flex-wrap")) return match;
			return to;
		});
	}
	// Clean accidental double flex-wrap
	src = src.replace(/flex flex-wrap flex-wrap/g, "flex flex-wrap");
	if (src !== before) {
		fs.writeFileSync(file, src);
		n++;
		console.log("updated", path.relative(process.cwd(), file));
	}
}
console.log("files", n);
