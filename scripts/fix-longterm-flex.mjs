import fs from "fs";

const files = [
	"src/component/nursing-home/pages/longterm-nursing-instruction/LongtermNursingInstruction.tsx",
	"src/component/nursing-home/pages/longterm-functional-cognitive/LongtermFunctionalCognitive.tsx",
	"src/component/nursing-home/pages/longterm-beneficiary-status/LongtermBeneficiaryStatus.tsx",
	"src/component/nursing-home/pages/longterm-record-format/LongtermRecordFormat.tsx",
	"src/component/nursing-home/pages/longterm-physical-activity/LongtermPhysicalActivity.tsx",
	"src/component/nursing-home/pages/daily-longterm-care/DailyLongtermCare.tsx",
];

for (const f of files) {
	let s = fs.readFileSync(f, "utf8");
	const before = s;
	s = s.replaceAll(
		'className="flex gap-4"',
		'className="flex flex-col lg:flex-row gap-4 min-w-0"'
	);
	if (s !== before) {
		fs.writeFileSync(f, s);
		console.log("updated", f);
	} else {
		console.log("no change", f);
	}
}
