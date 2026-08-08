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

const FROM_A =
	/<div className="flex flex-col overflow-hidden bg-white border border-blue-300 rounded-lg">\r?\n(\s*)<div className="overflow-y-auto">/g;
const TO_A = `<div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white border border-blue-300 rounded-lg">
$1<div className="min-h-[220px] max-h-[min(540px,55vh)] flex-1 overflow-y-auto">`;

const FROM_B =
	/<div className="border border-blue-300 rounded-lg overflow-hidden bg-white flex flex-col flex-1 min-h-0">\r?\n(\s*)<div className="overflow-y-auto">/g;
const TO_B = `<div className="border border-blue-300 rounded-lg overflow-hidden bg-white flex flex-col flex-1 min-h-0">
$1<div className="min-h-[220px] max-h-[min(540px,55vh)] flex-1 overflow-y-auto">`;

const FROM_C = `className="overflow-y-auto max-h-[520px]"`;
const TO_C = `className="min-h-[220px] max-h-[min(540px,55vh)] overflow-y-auto"`;

let n = 0;
for (const f of walk(ROOT)) {
	let s = fs.readFileSync(f, "utf8");
	const before = s;
	s = s.replace(FROM_A, TO_A);
	s = s.replace(FROM_B, TO_B);
	s = s.replaceAll(FROM_C, TO_C);
	if (s !== before) {
		fs.writeFileSync(f, s);
		n++;
		console.log(path.relative(process.cwd(), f));
	}
}
console.log("files", n);
