/**
 * Page: no horizontal scroll (overflow-x-hidden).
 * Wide tables: scroll only inside overflow-x-auto wrappers; prefer w-max on table.
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

let n = 0;
for (const file of walk(ROOT)) {
	let src = fs.readFileSync(file, "utf8");
	const before = src;

	// Page roots: keep width clamp + hide page-level x overflow
	src = src.replace(
		/className="(min-h-screen w-full max-w-full min-w-0)(?! overflow-x-hidden)([^"]*)"/g,
		'className="$1 overflow-x-hidden$2"'
	);
	src = src.replace(
		/className="(flex flex-col min-h-screen w-full max-w-full min-w-0)(?! overflow-x-hidden)([^"]*)"/g,
		'className="$1 overflow-x-hidden$2"'
	);
	src = src.replace(
		/className="(flex min-h-screen w-full max-w-full min-w-0)(?! overflow-x-hidden)([^"]*)"/g,
		'className="$1 overflow-x-hidden$2"'
	);
	src = src.replace(
		/className="(flex flex-col xl:flex-row min-h-screen w-full max-w-full min-w-0)(?! overflow-x-hidden)([^"]*)"/g,
		'className="$1 overflow-x-hidden$2"'
	);
	src = src.replace(
		/className="(relative min-h-screen w-full max-w-full min-w-0)(?! overflow-x-hidden)([^"]*)"/g,
		'className="$1 overflow-x-hidden$2"'
	);
	src = src.replace(
		/className="(flex min-h-screen w-full max-w-full min-w-0 flex-col)(?! overflow-x-hidden)([^"]*)"/g,
		'className="$1 overflow-x-hidden$2"'
	);

	// Avoid double overflow-x-hidden
	src = src.replace(/overflow-x-hidden overflow-x-hidden/g, "overflow-x-hidden");

	// Wide tables inside overflow-x-auto: use w-max so scroll is on the wrapper, not page
	src = src.replace(
		/(overflow-x-auto[^>]*>[\s\S]{0,80}?)<table className="w-full ([^"]*min-w-\[[^\]]+\])/g,
		'$1<table className="w-max max-w-none $2'
	);
	src = src.replace(
		/(overflow-x-auto[^>]*>[\s\S]{0,80}?)<table\n(\s*)className=\{`w-full /g,
		"$1<table\n$2className={`w-max max-w-none "
	);

	if (src !== before) {
		fs.writeFileSync(file, src);
		n++;
		console.log("updated", path.relative(process.cwd(), file));
	}
}
console.log("files", n);
