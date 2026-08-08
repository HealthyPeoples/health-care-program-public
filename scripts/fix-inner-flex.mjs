import fs from "fs";

const files = [
	"src/component/nursing-home/pages/bedsore-risk-measurement/BedsoreRiskMeasurement.tsx",
	"src/component/nursing-home/pages/fall-risk-measurement/FallRiskMeasurement.tsx",
	"src/component/nursing-home/pages/cognitive-assessment-record/CognitiveAssessmentRecord.tsx",
	"src/component/nursing-home/pages/position-change-record/PositionChangeRecord.tsx",
	"src/component/nursing-home/pages/excretion-observation/ExcretionObservation.tsx",
	"src/component/nursing-home/pages/intensive-excretion-observation/IntensiveExcretionObservation.tsx",
	"src/component/nursing-home/pages/bath-service/BathService.tsx",
	"src/component/nursing-home/pages/bedsore-management/BedsoreManagement.tsx",
	"src/component/nursing-home/pages/indwelling-catheter/IndwellingCatheter.tsx",
];

for (const f of files) {
	if (!fs.existsSync(f)) {
		console.log("missing", f);
		continue;
	}
	let s = fs.readFileSync(f, "utf8");
	const before = s;
	s = s.replaceAll(
		'className="flex flex-1 overflow-hidden bg-white"',
		'className="flex flex-col xl:flex-row flex-1 min-w-0 min-h-0 overflow-hidden bg-white"'
	);
	s = s.replaceAll(
		'className="flex flex-1 overflow-hidden"',
		'className="flex flex-col xl:flex-row flex-1 min-w-0 min-h-0 overflow-hidden"'
	);
	if (s !== before) {
		fs.writeFileSync(f, s);
		console.log("updated", f);
	} else {
		console.log("no change", f);
	}
}
