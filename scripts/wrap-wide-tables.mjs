/**
 * For each page file: if a <table has min-w-[...] and the preceding ~200 chars
 * of opening context don't include overflow-x-auto, wrap that table in a scroll div.
 * Conservative: only wrap when table className contains min-w-[
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

let filesChanged = 0;
let wraps = 0;

for (const file of walk(ROOT)) {
	let src = fs.readFileSync(file, "utf8");
	const before = src;

	// Match table tags with min-w in className
	src = src.replace(/<table\b([^>]*className="[^"]*min-w-\[[^\]]+\][^"]*"[^>]*)>/g, (match, attrs, offset) => {
		const lookback = src.slice(Math.max(0, offset - 180), offset);
		if (
			lookback.includes("overflow-x-auto") ||
			lookback.includes("overflow-auto") ||
			lookback.includes("overscroll-x-contain")
		) {
			return match;
		}
		// Avoid wrapping inside already-wrapped patterns we just added
		if (lookback.includes("nh-table-scroll")) return match;
		wraps++;
		return `<div className="nh-table-scroll w-full max-w-full min-w-0 overflow-x-auto">${match}`;
	});

	// Close wrappers: naive approach — for each opened nh-table-scroll, close after </table>
	// Only process if we added opens
	if (src !== before) {
		// Balance: after each <div className="nh-table-scroll...><table...>...</table> insert </div>
		src = src.replace(
			/(<div className="nh-table-scroll w-full max-w-full min-w-0 overflow-x-auto"><table\b[\s\S]*?<\/table>)/g,
			"$1</div>"
		);
		fs.writeFileSync(file, src);
		filesChanged++;
		console.log("updated", path.relative(process.cwd(), file));
	}
}

console.log(`files ${filesChanged}, wraps ~${wraps}`);
