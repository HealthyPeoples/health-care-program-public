/**
 * Remove stacked max-h-[42vh] (and similar) on member-list side panels so the list
 * stays visible like LongtermPhysicalActivity (document-flow stack).
 * Mid panels that use 30/36/40vh are left alone.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve("src/component/nursing-home");

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
	// Member / left panels
	[/ max-h-\[42vh\] xl:max-h-none/g, " xl:h-full xl:min-h-0"],
	[/ max-h-\[42vh\] lg:max-h-none/g, " lg:h-full lg:min-h-0"],
	[/ max-h-\[38vh\] xl:max-h-none/g, " xl:h-full xl:min-h-0"],
	// BeneficiaryListPanel class strings sometimes omit leading space variants already covered
	[/max-h-\[42vh\] xl:max-h-none min-h-0 overflow-hidden/g, "xl:h-full xl:min-h-0 min-h-0 xl:overflow-hidden"],
	[/max-h-\[42vh\] xl:max-h-none overflow-hidden/g, "xl:h-full xl:min-h-0 xl:overflow-hidden"],
	[/max-h-\[42vh\] lg:max-h-none overflow-hidden/g, "lg:h-full lg:min-h-0 lg:overflow-hidden"],
];

let n = 0;
for (const file of walk(ROOT)) {
	let src = fs.readFileSync(file, "utf8");
	const before = src;
	for (const [re, to] of REPLACEMENTS) {
		src = src.replace(re, to);
	}
	// Cleanup accidental doubles
	src = src.replace(/xl:h-full xl:min-h-0 xl:h-full xl:min-h-0/g, "xl:h-full xl:min-h-0");
	src = src.replace(/lg:h-full lg:min-h-0 lg:h-full lg:min-h-0/g, "lg:h-full lg:min-h-0");
	src = src.replace(/overflow-hidden xl:overflow-hidden/g, "xl:overflow-hidden");
	src = src.replace(/overflow-hidden lg:overflow-hidden/g, "lg:overflow-hidden");

	if (src !== before) {
		fs.writeFileSync(file, src);
		n++;
		console.log("updated", path.relative(process.cwd(), file));
	}
}
console.log("files", n);
