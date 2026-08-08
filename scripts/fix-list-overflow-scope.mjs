import fs from "fs";
import path from "path";

const ROOT = path.resolve("src/component/nursing-home/pages");

function walk(dir, out = []) {
	for (const name of fs.readdirSync(dir)) {
		const p = path.join(dir, name);
		const st = fs.statSync(p);
		if (st.isDirectory()) walk(p, out);
		else if (/\.tsx$/.test(name)) out.push(p);
	}
	return out;
}

let n = 0;
for (const f of walk(ROOT)) {
	let s = fs.readFileSync(f, "utf8");
	const before = s;
	s = s.replace(
		/(border-b xl:border-b-0 xl:h-full xl:min-h-0) overflow-hidden/g,
		"$1 xl:overflow-hidden"
	);
	s = s.replace(
		/(border-b lg:border-b-0 lg:h-full lg:min-h-0) overflow-hidden/g,
		"$1 lg:overflow-hidden"
	);
	s = s.replace(
		/(border-b xl:border-b-0 xl:h-full xl:min-h-0 min-h-0) overflow-hidden/g,
		"$1 xl:overflow-hidden"
	);
	if (s !== before) {
		fs.writeFileSync(f, s);
		n++;
		console.log(path.relative(process.cwd(), f));
	}
}
console.log("files", n);
