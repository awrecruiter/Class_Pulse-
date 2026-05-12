// Miami-Dade Grade 5 Mathematics Year-At-A-Glance 2025–2026
// Course Code: 5012070G1 — Big Ideas Learning Series
// Dates are calendar ranges (school days within); topic.days = instructional days

export type YAAGLesson = {
	number: string; // "1.1", "14.3"
	title: string;
	homeworkRef?: string; // Practice page ref when known from topic pacing guide PDF
	lessonDate?: string; // YYYY-MM-DD when exact date known
};

export type YAAGTopic = {
	number: number;
	roman: string;
	title: string;
	quarter: 1 | 2 | 3 | 4;
	startDate: string; // YYYY-MM-DD (inclusive)
	endDate: string; // YYYY-MM-DD (inclusive)
	days: number; // instructional days
	lessons: YAAGLesson[];
	standardCodes: string[];
	isReview?: boolean; // Topic XV – FAST Spiral Review
	isG6Prep?: boolean; // Topics XVI–XVIII – Preparing for Grade 6
};

export const YAAG_TOPICS: YAAGTopic[] = [
	// ─── Q1: Aug 14 – Oct 17 ───────────────────────────────────────────────────
	{
		number: 1,
		roman: "I",
		title: "Place Value Concepts with Decimals",
		quarter: 1,
		startDate: "2025-08-14",
		endDate: "2025-08-28",
		days: 11,
		standardCodes: ["MA.5.NSO.1.1", "MA.5.NSO.1.2", "MA.5.NSO.1.3", "MA.5.NSO.1.4", "MA.5.NSO.1.5"],
		lessons: [
			{ number: "1.1", title: "Decimals to Thousandths" },
			{ number: "1.2", title: "Read and Write Decimals" },
			{ number: "1.3", title: "Represent Decimals in Different Ways" },
			{ number: "1.4", title: "Place Value Patterns" },
			{ number: "1.5", title: "Compare Decimals" },
			{ number: "1.6", title: "Round Decimals" },
		],
	},
	{
		number: 2,
		roman: "II",
		title: "Numerical Expressions",
		quarter: 1,
		startDate: "2025-08-29",
		endDate: "2025-09-10",
		days: 8,
		standardCodes: ["MA.5.AR.2.1", "MA.5.AR.2.2", "MA.5.AR.2.3", "MA.5.AR.2.4"],
		lessons: [
			{ number: "2.1", title: "Number Properties" },
			{ number: "2.2", title: "Order of Operations" },
			{ number: "2.3", title: "Write Numerical Expressions" },
			{ number: "2.4", title: "True or False Equations" },
		],
	},
	{
		number: 3,
		roman: "III",
		title: "Add and Subtract Decimals",
		quarter: 1,
		startDate: "2025-09-11",
		endDate: "2025-09-25",
		days: 10,
		standardCodes: ["MA.5.NSO.2.3", "MA.5.AR.2.2"],
		lessons: [
			{ number: "3.1", title: "Estimate Sums and Differences" },
			{ number: "3.2", title: "Use Models to Add or Subtract Decimals" },
			{ number: "3.3", title: "Add Decimals" },
			{ number: "3.4", title: "Subtract Decimals" },
			{ number: "3.5", title: "Add and Subtract Decimals" },
			{ number: "3.6", title: "Use Mental Math to Add or Subtract Decimals" },
			{ number: "3.7", title: "Problem Solving: Money" },
		],
	},
	{
		number: 4,
		roman: "IV",
		title: "Multiply Whole Numbers",
		quarter: 1,
		startDate: "2025-09-26",
		endDate: "2025-10-09",
		days: 9,
		standardCodes: ["MA.5.NSO.2.1", "MA.5.AR.2.4"],
		lessons: [
			{ number: "4.1", title: "Multiplication Patterns" },
			{ number: "4.2", title: "Estimate Products" },
			{ number: "4.3", title: "Multiply by One-Digit Numbers" },
			{ number: "4.4", title: "Multiply by Two-Digit Numbers" },
			{ number: "4.5", title: "Multiply Multi-Digit Whole Numbers" },
		],
	},
	{
		number: 5,
		roman: "V",
		title: "Multiply Decimals",
		quarter: 1,
		startDate: "2025-10-10",
		endDate: "2025-10-27", // spans Q1 end and Q2 start
		days: 12, // 6 in Q1 + 6 in Q2
		standardCodes: ["MA.5.NSO.2.4", "MA.5.NSO.2.5", "MA.5.M.2.1", "MA.5.GR.2.1"],
		lessons: [
			{ number: "5.1", title: "Multiplication Patterns with Decimals" },
			{ number: "5.2", title: "Estimate Products of Decimals and Whole Numbers" },
			{ number: "5.3", title: "Use Models to Multiply Decimals and Whole Numbers" },
			{ number: "5.4", title: "Multiply Decimals and Whole Numbers" },
			{ number: "5.5", title: "Use Models to Multiply Decimals" },
			{ number: "5.6", title: "Use Partial Products to Multiply Decimals" },
			{ number: "5.7", title: "Use Strategies to Multiply Decimals" },
			{ number: "5.8", title: "Multiply Decimals" },
			{ number: "5.9", title: "Problem Solving: Multiply with Money" },
		],
	},
	// ─── Q2: Oct 20 – Jan 15 ──────────────────────────────────────────────────
	{
		number: 6,
		roman: "VI",
		title: "Divide Whole Numbers",
		quarter: 2,
		startDate: "2025-10-28",
		endDate: "2025-11-17",
		days: 13,
		standardCodes: ["MA.5.NSO.2.2", "MA.5.AR.1.1", "MA.5.AR.2.4"],
		lessons: [
			{ number: "6.1", title: "Relate Multiplication and Division" },
			{ number: "6.2", title: "Division Patterns" },
			{ number: "6.3", title: "Estimate Quotients" },
			{ number: "6.4", title: "Divide by One-Digit Numbers" },
			{ number: "6.5", title: "Use Partial Quotients to Divide by Two-Digit Numbers" },
			{ number: "6.6", title: "Use Partial Quotients with a Remainder" },
			{ number: "6.7", title: "Divide Three-Digit Numbers by Two-Digit Numbers" },
			{ number: "6.8", title: "Divide Multi-Digit Numbers by Two-Digit Numbers" },
			{ number: "6.9", title: "Problem Solving: Division" },
		],
	},
	{
		number: 7,
		roman: "VII",
		title: "Divide Decimals",
		quarter: 2,
		startDate: "2025-11-18",
		endDate: "2025-12-11",
		days: 13,
		standardCodes: ["MA.5.NSO.2.4", "MA.5.NSO.2.5", "MA.5.M.2.1"],
		lessons: [
			{ number: "7.1", title: "Division Patterns with Decimals" },
			{ number: "7.2", title: "Estimate Decimal Quotients" },
			{ number: "7.3", title: "Use Models to Divide Decimals by Whole Numbers" },
			{ number: "7.4", title: "Divide Decimals by One-Digit Numbers" },
			{ number: "7.5", title: "Divide Decimals by Two-Digit Numbers" },
			{ number: "7.6", title: "Use Models to Divide Decimals" },
			{ number: "7.7", title: "Divide Decimals" },
			{ number: "7.8", title: "Insert Zeros in the Dividends" },
			{ number: "7.9", title: "Problem Solving: Divide with Money" },
		],
	},
	{
		number: 8,
		roman: "VIII",
		title: "Add and Subtract Fractions",
		quarter: 2,
		startDate: "2025-12-12",
		endDate: "2026-01-08",
		days: 10,
		standardCodes: ["MA.5.FR.2.1", "MA.5.AR.1.2"],
		lessons: [
			{ number: "8.1", title: "Estimate Sums and Differences of Fractions" },
			{ number: "8.2", title: "Find Common Denominators" },
			{ number: "8.3", title: "Add Fractions with Unlike Denominators" },
			{ number: "8.4", title: "Subtract Fractions with Unlike Denominators" },
			{ number: "8.5", title: "Add Mixed Numbers" },
			{ number: "8.6", title: "Subtract Mixed Numbers" },
			{ number: "8.7", title: "Problem Solving: Fractions" },
		],
	},
	{
		number: 9,
		roman: "IX",
		title: "Multiply Fractions",
		quarter: 2,
		startDate: "2026-01-09",
		endDate: "2026-01-23", // spans Q2 end and Q3 start
		days: 9, // 5 in Q2 + 4 in Q3
		standardCodes: ["MA.5.FR.2.2", "MA.5.FR.2.3", "MA.5.AR.1.2", "MA.5.GR.2.1"],
		lessons: [
			{ number: "9.1", title: "Multiply Fractions and Whole Numbers" },
			{ number: "9.2", title: "Use Models to Multiply Fractions" },
			{ number: "9.3", title: "Multiply Fractions" },
			{ number: "9.4", title: "Multiply Mixed Numbers" },
			{ number: "9.5", title: "Compare Factors and Products" },
		],
	},
	// ─── Q3: Jan 20 – Apr 02 ──────────────────────────────────────────────────
	{
		number: 10,
		roman: "X",
		title: "Divide Fractions",
		quarter: 3,
		startDate: "2026-01-26",
		endDate: "2026-02-05",
		days: 9,
		standardCodes: ["MA.5.FR.1.1", "MA.5.FR.2.4", "MA.5.AR.1.3"],
		lessons: [
			{ number: "10.1", title: "Interpret Fractions as Division" },
			{ number: "10.2", title: "Mixed Numbers as Quotients" },
			{ number: "10.3", title: "Divide Whole Numbers by Unit Fractions" },
			{ number: "10.4", title: "Divide Unit Fractions by Whole Numbers" },
			{ number: "10.5", title: "Problem Solving: Fraction Division" },
		],
	},
	{
		number: 11,
		roman: "XI",
		title: "Convert and Display Units of Measure",
		quarter: 3,
		startDate: "2026-02-06",
		endDate: "2026-02-23",
		days: 11,
		standardCodes: ["MA.5.M.1.1"],
		lessons: [
			{ number: "11.1", title: "Length in Metric Units" },
			{ number: "11.2", title: "Mass and Capacity in Metric Units" },
			{ number: "11.3", title: "Length in Customary Units" },
			{ number: "11.4", title: "Weight in Customary Units" },
			{ number: "11.5", title: "Capacity in Customary Units" },
			{ number: "11.6", title: "Problem Solving: Measurement" },
		],
	},
	{
		number: 12,
		roman: "XII",
		title: "Understand the Coordinate Plane and Data",
		quarter: 3,
		startDate: "2026-02-24",
		endDate: "2026-03-12",
		days: 13,
		standardCodes: [
			"MA.5.AR.3.1",
			"MA.5.AR.3.2",
			"MA.5.GR.4.1",
			"MA.5.GR.4.2",
			"MA.5.DP.1.1",
			"MA.5.DP.1.2",
		],
		lessons: [
			{ number: "12.1", title: "Plot Points in a Coordinate Plane" },
			{ number: "12.2", title: "Graph Data" },
			{ number: "12.3", title: "Make and Interpret Line Graphs" },
			{ number: "12.4", title: "Represent Rules" },
			{ number: "12.5", title: "Numerical Patterns" },
			{ number: "12.6", title: "Make and Interpret Line Plots" },
			{ number: "12.7", title: "Find Mean" },
			{ number: "12.8", title: "Find Median, Mode, and Range" },
		],
	},
	{
		number: 13,
		roman: "XIII",
		title: "Understand Volume",
		quarter: 3,
		startDate: "2026-03-13",
		endDate: "2026-04-02",
		days: 9,
		standardCodes: ["MA.5.GR.3.1", "MA.5.GR.3.2", "MA.5.GR.3.3"],
		lessons: [
			{ number: "13.1", title: "Understand the Concept of Volume" },
			{ number: "13.2", title: "Find Volumes of Right Rectangular Prisms" },
			{ number: "13.3", title: "Apply the Volume Formula" },
			{ number: "13.4", title: "Find Unknown Dimensions" },
			{ number: "13.5", title: "Find Volumes of Composite Figures" },
		],
	},
	// ─── Q4: Apr 06 – Jun 04 ──────────────────────────────────────────────────
	{
		number: 14,
		roman: "XIV",
		title: "Classify Two- and Three-Dimensional Shapes",
		quarter: 4,
		startDate: "2026-04-06",
		endDate: "2026-04-16",
		days: 9,
		standardCodes: ["MA.5.GR.1.1", "MA.5.GR.1.2"],
		lessons: [
			// Exact dates + homework refs from Topic XIV pacing guide PDF
			{
				number: "14.1",
				title: "Classify Triangles",
				lessonDate: "2026-04-07",
				homeworkRef: "Lesson 14.1 Practice, SE pp. 657–658",
			},
			{
				number: "14.2",
				title: "Classify Quadrilaterals",
				lessonDate: "2026-04-08",
				homeworkRef: "Lesson 14.2 Practice, SE pp. 663–664",
			},
			{
				number: "14.3",
				title: "Relate Quadrilaterals",
				lessonDate: "2026-04-09",
				homeworkRef: "Lesson 14.3 Practice, SE pp. 669–670",
			},
			{
				number: "14.4",
				title: "Classify Prisms and Cylinders",
				lessonDate: "2026-04-10",
				homeworkRef: "Lesson 14.4 Practice, SE pp. 675–676",
			},
			{
				number: "14.5",
				title: "Classify Pyramids, Cones, and Spheres",
				lessonDate: "2026-04-13",
				homeworkRef: "Lesson 14.5 Practice, SE pp. 681–682",
			},
		],
	},
	{
		number: 15,
		roman: "XV",
		title: "F.A.S.T. Spiral Review",
		quarter: 4,
		startDate: "2026-04-17",
		endDate: "2026-04-30",
		days: 10,
		standardCodes: [], // all tested standards — spiral review
		lessons: [],
		isReview: true,
	},
	{
		number: 16,
		roman: "XVI",
		title: "Numerical Expressions (Preparing for Grade 6)",
		quarter: 4,
		startDate: "2026-05-01",
		endDate: "2026-05-12",
		days: 8,
		standardCodes: ["MA.6.NSO.3.1", "MA.6.NSO.3.2", "MA.6.AR.1.4"],
		lessons: [
			{ number: "1", title: "Find the Greatest Common Factor" },
			{ number: "2", title: "Use the Distributive Property to Factor Expressions" },
			{ number: "3", title: "Write Equivalent Numerical Expressions" },
			{ number: "4", title: "Write Equivalent Expressions" },
		],
		isG6Prep: true,
	},
	{
		number: 17,
		roman: "XVII",
		title: "Operations with Decimals (Preparing for Grade 6)",
		quarter: 4,
		startDate: "2026-05-13",
		endDate: "2026-05-22",
		days: 8,
		standardCodes: ["MA.6.NSO.2.1", "MA.6.NSO.2.3"],
		lessons: [
			{ number: "1", title: "Add Decimals" },
			{ number: "2", title: "Add and Subtract Decimals" },
			{ number: "3", title: "Multiply Decimals" },
			{ number: "4", title: "Divide Decimals" },
		],
		isG6Prep: true,
	},
	{
		number: 18,
		roman: "XVIII",
		title: "Operations with Fractions (Preparing for Grade 6)",
		quarter: 4,
		startDate: "2026-05-26",
		endDate: "2026-06-04",
		days: 8,
		standardCodes: ["MA.6.NSO.2.1", "MA.6.NSO.2.2", "MA.6.NSO.2.3"],
		lessons: [
			{ number: "1", title: "Add and Subtract Fractions and Mixed Numbers" },
			{ number: "2", title: "Multiply Fractions" },
			{ number: "3", title: "Compute Quotients with Fractions" },
		],
		isG6Prep: true,
	},
];

// FAST testing window
export const FAST_WINDOW = { start: "2026-05-01", end: "2026-05-29" };
