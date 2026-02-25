export type Strand = "NSO" | "FR" | "AR" | "M" | "GR" | "DP";

export type Benchmark = {
	code: string;
	grade: 3 | 4 | 5;
	strand: Strand;
	description: string;
	prerequisites: string[];
};

export const FL_BEST_STANDARDS: Benchmark[] = [
	// ─── Grade 3 ──────────────────────────────────────────────────────────────

	// NSO – Number Sense and Operations
	{
		code: "MA.3.NSO.1.1",
		grade: 3,
		strand: "NSO",
		description:
			"Read and write numbers from 0 to 10,000 using standard form, expanded form, and word form.",
		prerequisites: [],
	},
	{
		code: "MA.3.NSO.1.2",
		grade: 3,
		strand: "NSO",
		description:
			"Compose and decompose four-digit numbers in multiple ways using thousands, hundreds, tens, and ones.",
		prerequisites: ["MA.3.NSO.1.1"],
	},
	{
		code: "MA.3.NSO.1.3",
		grade: 3,
		strand: "NSO",
		description: "Plot, order, and compare whole numbers up to 10,000.",
		prerequisites: ["MA.3.NSO.1.1"],
	},
	{
		code: "MA.3.NSO.1.4",
		grade: 3,
		strand: "NSO",
		description: "Round whole numbers from 0 to 1,000 to the nearest 10 or 100.",
		prerequisites: ["MA.3.NSO.1.3"],
	},
	{
		code: "MA.3.NSO.2.1",
		grade: 3,
		strand: "NSO",
		description:
			"Add and subtract multi-digit whole numbers including using a standard algorithm with procedural fluency.",
		prerequisites: [],
	},
	{
		code: "MA.3.NSO.2.2",
		grade: 3,
		strand: "NSO",
		description:
			"Explore multiplication of two whole numbers with products from 0 to 144 and related division facts.",
		prerequisites: [],
	},
	{
		code: "MA.3.NSO.2.3",
		grade: 3,
		strand: "NSO",
		description:
			"Multiply a one-digit whole number by a multiple of 10, up to 90, or a multiple of 100, up to 900.",
		prerequisites: ["MA.3.NSO.2.2"],
	},
	{
		code: "MA.3.NSO.2.4",
		grade: 3,
		strand: "NSO",
		description:
			"Multiply two whole numbers, each up to 12, and divide using related facts with automaticity.",
		prerequisites: ["MA.3.NSO.2.2"],
	},

	// FR – Fractions
	{
		code: "MA.3.FR.1.1",
		grade: 3,
		strand: "FR",
		description:
			"Represent and interpret unit fractions in the form 1/n as the quantity formed by one part when a whole is partitioned into n equal parts.",
		prerequisites: [],
	},
	{
		code: "MA.3.FR.1.2",
		grade: 3,
		strand: "FR",
		description:
			"Represent and interpret fractions, including fractions greater than one, in the form of m/n.",
		prerequisites: ["MA.3.FR.1.1"],
	},
	{
		code: "MA.3.FR.1.3",
		grade: 3,
		strand: "FR",
		description:
			"Read and write fractions, including fractions greater than one, using standard form, numeral-word form, and word form.",
		prerequisites: ["MA.3.FR.1.2"],
	},
	{
		code: "MA.3.FR.2.1",
		grade: 3,
		strand: "FR",
		description:
			"Plot, order, and compare fractional numbers with the same numerator or the same denominator.",
		prerequisites: ["MA.3.FR.1.2"],
	},
	{
		code: "MA.3.FR.2.2",
		grade: 3,
		strand: "FR",
		description: "Identify equivalent fractions and explain why they are equivalent.",
		prerequisites: ["MA.3.FR.1.2", "MA.3.FR.2.1"],
	},

	// AR – Algebraic Reasoning
	{
		code: "MA.3.AR.1.1",
		grade: 3,
		strand: "AR",
		description:
			"Apply the distributive property to multiply a one-digit number and two-digit number.",
		prerequisites: ["MA.3.NSO.2.2"],
	},
	{
		code: "MA.3.AR.1.2",
		grade: 3,
		strand: "AR",
		description:
			"Solve one- and two-step real-world problems involving any of four operations with whole numbers.",
		prerequisites: ["MA.3.NSO.2.1", "MA.3.NSO.2.2"],
	},
	{
		code: "MA.3.AR.2.1",
		grade: 3,
		strand: "AR",
		description:
			"Restate a division problem as a missing factor problem using the relationship between multiplication and division.",
		prerequisites: ["MA.3.NSO.2.2"],
	},
	{
		code: "MA.3.AR.2.2",
		grade: 3,
		strand: "AR",
		description:
			"Determine and explain whether an equation involving multiplication or division is true or false.",
		prerequisites: ["MA.3.NSO.2.4"],
	},
	{
		code: "MA.3.AR.2.3",
		grade: 3,
		strand: "AR",
		description:
			"Determine the unknown whole number in a multiplication or division equation, relating three whole numbers.",
		prerequisites: ["MA.3.AR.2.2"],
	},

	// M – Measurement
	{
		code: "MA.3.M.1.1",
		grade: 3,
		strand: "M",
		description:
			"Select and use appropriate tools to measure the length of an object to the nearest half inch, quarter inch, or centimeter.",
		prerequisites: [],
	},
	{
		code: "MA.3.M.1.2",
		grade: 3,
		strand: "M",
		description:
			"Solve real-world problems involving any of the four operations with whole-number lengths or distances.",
		prerequisites: ["MA.3.M.1.1", "MA.3.NSO.2.1"],
	},
	{
		code: "MA.3.M.2.1",
		grade: 3,
		strand: "M",
		description:
			"Using analog and digital clocks, tell and write time to the nearest minute using a.m. and p.m. appropriately.",
		prerequisites: [],
	},
	{
		code: "MA.3.M.2.2",
		grade: 3,
		strand: "M",
		description: "Solve one- and two-step real-world problems involving elapsed time.",
		prerequisites: ["MA.3.M.2.1"],
	},

	// GR – Geometric Reasoning
	{
		code: "MA.3.GR.1.1",
		grade: 3,
		strand: "GR",
		description:
			"Describe and draw points, lines, line segments, rays, intersecting lines, perpendicular lines, and parallel lines.",
		prerequisites: [],
	},
	{
		code: "MA.3.GR.1.2",
		grade: 3,
		strand: "GR",
		description:
			"Identify and draw quadrilaterals based on their defining attributes including parallelograms, rhombuses, rectangles, squares, and trapezoids.",
		prerequisites: ["MA.3.GR.1.1"],
	},
	{
		code: "MA.3.GR.1.3",
		grade: 3,
		strand: "GR",
		description:
			"Draw line(s) of symmetry in a two-dimensional figure and identify line-symmetric two-dimensional figures.",
		prerequisites: ["MA.3.GR.1.2"],
	},
	{
		code: "MA.3.GR.2.1",
		grade: 3,
		strand: "GR",
		description:
			"Explore the concept of area as an attribute of a two-dimensional figure by covering the figure with unit squares without gaps or overlaps.",
		prerequisites: [],
	},
	{
		code: "MA.3.GR.2.2",
		grade: 3,
		strand: "GR",
		description:
			"Find the area of a rectangle with whole-number side lengths using a visual model and a multiplication formula.",
		prerequisites: ["MA.3.GR.2.1", "MA.3.NSO.2.2"],
	},
	{
		code: "MA.3.GR.2.3",
		grade: 3,
		strand: "GR",
		description:
			"Solve mathematical and real-world problems involving the perimeter and area of rectangles with whole-number side lengths.",
		prerequisites: ["MA.3.GR.2.2"],
	},
	{
		code: "MA.3.GR.2.4",
		grade: 3,
		strand: "GR",
		description:
			"Solve mathematical and real-world problems involving the perimeter and area of composite figures composed of non-overlapping rectangles.",
		prerequisites: ["MA.3.GR.2.3"],
	},

	// DP – Data Analysis and Probability
	{
		code: "MA.3.DP.1.1",
		grade: 3,
		strand: "DP",
		description:
			"Collect and represent numerical and categorical data with whole-number values using tables, scaled pictographs, scaled bar graphs, or line plots.",
		prerequisites: [],
	},
	{
		code: "MA.3.DP.1.2",
		grade: 3,
		strand: "DP",
		description:
			"Interpret data represented with tables, scaled pictographs, scaled bar graphs, or line plots by solving one- and two-step problems.",
		prerequisites: ["MA.3.DP.1.1"],
	},

	// ─── Grade 4 ──────────────────────────────────────────────────────────────

	// NSO
	{
		code: "MA.4.NSO.1.1",
		grade: 4,
		strand: "NSO",
		description:
			"Express how the value of a digit changes when a multi-digit whole number is multiplied or divided by 10.",
		prerequisites: ["MA.3.NSO.1.1"],
	},
	{
		code: "MA.4.NSO.1.2",
		grade: 4,
		strand: "NSO",
		description:
			"Read and write multi-digit whole numbers from 0 to 1,000,000 using standard form, expanded form, and word form.",
		prerequisites: ["MA.4.NSO.1.1"],
	},
	{
		code: "MA.4.NSO.1.3",
		grade: 4,
		strand: "NSO",
		description: "Plot, order, and compare multi-digit whole numbers up to 1,000,000.",
		prerequisites: ["MA.4.NSO.1.2"],
	},
	{
		code: "MA.4.NSO.1.4",
		grade: 4,
		strand: "NSO",
		description: "Round whole numbers from 0 to 10,000 to the nearest 10, 100, or 1,000.",
		prerequisites: ["MA.4.NSO.1.3"],
	},
	{
		code: "MA.4.NSO.2.1",
		grade: 4,
		strand: "NSO",
		description:
			"Recall multiplication facts with factors up to 12 and related division facts with automaticity.",
		prerequisites: ["MA.3.NSO.2.4"],
	},
	{
		code: "MA.4.NSO.2.2",
		grade: 4,
		strand: "NSO",
		description:
			"Multiply two whole numbers, up to three digits by up to two digits, with procedural reliability.",
		prerequisites: ["MA.4.NSO.2.1"],
	},
	{
		code: "MA.4.NSO.2.3",
		grade: 4,
		strand: "NSO",
		description:
			"Multiply two whole numbers, each up to two digits, including using a standard algorithm with procedural fluency.",
		prerequisites: ["MA.4.NSO.2.2"],
	},
	{
		code: "MA.4.NSO.2.4",
		grade: 4,
		strand: "NSO",
		description:
			"Divide a whole number up to four digits by a one-digit whole number with procedural reliability.",
		prerequisites: ["MA.4.NSO.2.1"],
	},
	{
		code: "MA.4.NSO.2.5",
		grade: 4,
		strand: "NSO",
		description:
			"Explore the multiplication and division of multi-digit whole numbers using estimation, rounding, and place value.",
		prerequisites: ["MA.4.NSO.2.3", "MA.4.NSO.2.4"],
	},

	// FR – Grade 4
	{
		code: "MA.4.FR.1.1",
		grade: 4,
		strand: "FR",
		description:
			"Model and express a fraction, including fractions greater than one, with the denominator 10 as an equivalent fraction with the denominator 100.",
		prerequisites: ["MA.3.FR.2.2"],
	},
	{
		code: "MA.4.FR.1.2",
		grade: 4,
		strand: "FR",
		description:
			"Use decimal notation to represent fractions with denominators of 10 or 100, including mixed numbers, and use fractional notation with denominators of 10 or 100 to represent decimals.",
		prerequisites: ["MA.4.FR.1.1"],
	},
	{
		code: "MA.4.FR.1.3",
		grade: 4,
		strand: "FR",
		description:
			"Identify and generate equivalent fractions, including fractions greater than one. Describe how the numerator and denominator are affected when the equivalent fraction is created.",
		prerequisites: ["MA.3.FR.2.2"],
	},
	{
		code: "MA.4.FR.1.4",
		grade: 4,
		strand: "FR",
		description:
			"Plot, order, and compare benchmarks fractions (0, 1/4, 1/2, 3/4, 1) and fractions with the same numerator or same denominator.",
		prerequisites: ["MA.4.FR.1.3"],
	},
	{
		code: "MA.4.FR.2.1",
		grade: 4,
		strand: "FR",
		description:
			"Decompose a fraction, including mixed numbers and fractions greater than one, into a sum of fractions with the same denominator in multiple ways.",
		prerequisites: ["MA.3.FR.1.2", "MA.4.FR.1.3"],
	},
	{
		code: "MA.4.FR.2.2",
		grade: 4,
		strand: "FR",
		description:
			"Add and subtract fractions with like denominators, including mixed numbers and fractions greater than one, with procedural reliability.",
		prerequisites: ["MA.4.FR.2.1"],
	},
	{
		code: "MA.4.FR.2.3",
		grade: 4,
		strand: "FR",
		description:
			"Solve real-world problems involving addition and subtraction of fractions with like denominators, including mixed numbers and fractions greater than one.",
		prerequisites: ["MA.4.FR.2.2"],
	},
	{
		code: "MA.4.FR.2.4",
		grade: 4,
		strand: "FR",
		description:
			"Extend previous understanding of multiplication to multiply a fraction by a whole number or a whole number by a fraction.",
		prerequisites: ["MA.3.NSO.2.4", "MA.4.FR.1.3"],
	},
	{
		code: "MA.4.FR.2.5",
		grade: 4,
		strand: "FR",
		description:
			"Solve real-world problems involving multiplication of a fraction by a whole number or a whole number by a fraction.",
		prerequisites: ["MA.4.FR.2.4"],
	},

	// AR – Grade 4
	{
		code: "MA.4.AR.1.1",
		grade: 4,
		strand: "AR",
		description:
			"Solve real-world problems involving addition and subtraction of multi-digit numbers including using a standard algorithm.",
		prerequisites: ["MA.3.NSO.2.1"],
	},
	{
		code: "MA.4.AR.1.2",
		grade: 4,
		strand: "AR",
		description:
			"Solve real-world problems involving multiplication of a multi-digit number by a one-digit whole number.",
		prerequisites: ["MA.4.NSO.2.2"],
	},
	{
		code: "MA.4.AR.1.3",
		grade: 4,
		strand: "AR",
		description:
			"Solve real-world problems involving division of a whole number by a one-digit divisor, excluding cases where the quotient has a remainder.",
		prerequisites: ["MA.4.NSO.2.4"],
	},
	{
		code: "MA.4.AR.2.1",
		grade: 4,
		strand: "AR",
		description:
			"Determine and explain whether an equation involving any of the four operations with whole numbers is true or false.",
		prerequisites: ["MA.3.AR.2.2"],
	},
	{
		code: "MA.4.AR.2.2",
		grade: 4,
		strand: "AR",
		description:
			"Given a mathematical or real-world context, write an equation involving multiplication or division to determine the unknown whole number.",
		prerequisites: ["MA.4.AR.2.1"],
	},
	{
		code: "MA.4.AR.3.1",
		grade: 4,
		strand: "AR",
		description: "Determine factor pairs for a whole number from 0 to 144.",
		prerequisites: ["MA.4.NSO.2.1"],
	},
	{
		code: "MA.4.AR.3.2",
		grade: 4,
		strand: "AR",
		description: "Identify prime and composite numbers to 144.",
		prerequisites: ["MA.4.AR.3.1"],
	},

	// M – Grade 4
	{
		code: "MA.4.M.1.1",
		grade: 4,
		strand: "M",
		description:
			"Convert units of length, time, volume/capacity, and mass/weight within the same system of measurement.",
		prerequisites: ["MA.3.M.1.1"],
	},
	{
		code: "MA.4.M.1.2",
		grade: 4,
		strand: "M",
		description:
			"Solve real-world problems involving distances and intervals of time using any of the four operations.",
		prerequisites: ["MA.4.M.1.1"],
	},
	{
		code: "MA.4.M.2.1",
		grade: 4,
		strand: "M",
		description:
			"Solve perimeter and area mathematical and real-world problems, including problems with unknown sides, for rectangles with whole-number side lengths.",
		prerequisites: ["MA.3.GR.2.3"],
	},

	// GR – Grade 4
	{
		code: "MA.4.GR.1.1",
		grade: 4,
		strand: "GR",
		description:
			"Informally explore angles as an attribute of two-dimensional figures. Identify and classify angles as acute, right, obtuse, straight, or reflex.",
		prerequisites: ["MA.3.GR.1.1"],
	},
	{
		code: "MA.4.GR.1.2",
		grade: 4,
		strand: "GR",
		description:
			"Estimate angle measures and use a protractor to measure angles in whole-number degrees.",
		prerequisites: ["MA.4.GR.1.1"],
	},
	{
		code: "MA.4.GR.1.3",
		grade: 4,
		strand: "GR",
		description:
			"Draw and identify triangles and quadrilaterals based on their defining attributes.",
		prerequisites: ["MA.4.GR.1.1", "MA.3.GR.1.2"],
	},
	{
		code: "MA.4.GR.2.1",
		grade: 4,
		strand: "GR",
		description:
			"Solve perimeter and area mathematical and real-world problems, including problems with an unknown side, for rectangles with whole-number side lengths.",
		prerequisites: ["MA.3.GR.2.3"],
	},
	{
		code: "MA.4.GR.2.2",
		grade: 4,
		strand: "GR",
		description:
			"Solve mathematical and real-world problems involving the area of a figure composed of non-overlapping rectangles.",
		prerequisites: ["MA.4.GR.2.1"],
	},

	// DP – Grade 4
	{
		code: "MA.4.DP.1.1",
		grade: 4,
		strand: "DP",
		description:
			"Collect and represent numerical data, including fractional values, using tables, stem-and-leaf plots, or line plots.",
		prerequisites: ["MA.3.DP.1.1", "MA.3.FR.1.2"],
	},
	{
		code: "MA.4.DP.1.2",
		grade: 4,
		strand: "DP",
		description: "Determine the mode, median, and range of a numerical data set.",
		prerequisites: ["MA.4.DP.1.1"],
	},
	{
		code: "MA.4.DP.1.3",
		grade: 4,
		strand: "DP",
		description:
			"Interpret data represented in tables, stem-and-leaf plots, or line plots by solving one- and two-step problems.",
		prerequisites: ["MA.4.DP.1.1"],
	},

	// ─── Grade 5 ──────────────────────────────────────────────────────────────

	// NSO – Grade 5
	{
		code: "MA.5.NSO.1.1",
		grade: 5,
		strand: "NSO",
		description:
			"Express how the value of a digit in a multi-digit number with decimals to the thousandths changes if the digit moves one or more places to the left or right.",
		prerequisites: ["MA.4.NSO.1.1"],
	},
	{
		code: "MA.5.NSO.1.2",
		grade: 5,
		strand: "NSO",
		description:
			"Read and write multi-digit numbers with decimals to the thousandths using standard form, expanded form, and word form.",
		prerequisites: ["MA.5.NSO.1.1"],
	},
	{
		code: "MA.5.NSO.1.3",
		grade: 5,
		strand: "NSO",
		description:
			"Plot, order, and compare multi-digit numbers with decimals up to the thousandths.",
		prerequisites: ["MA.5.NSO.1.2"],
	},
	{
		code: "MA.5.NSO.1.4",
		grade: 5,
		strand: "NSO",
		description:
			"Round multi-digit numbers with decimals to the thousandths to the nearest hundredth, tenth, or whole number.",
		prerequisites: ["MA.5.NSO.1.3"],
	},
	{
		code: "MA.5.NSO.2.1",
		grade: 5,
		strand: "NSO",
		description:
			"Multiply multi-digit whole numbers including using a standard algorithm with procedural fluency.",
		prerequisites: ["MA.4.NSO.2.3"],
	},
	{
		code: "MA.5.NSO.2.2",
		grade: 5,
		strand: "NSO",
		description:
			"Divide multi-digit whole numbers, up to five digits by two digits, including using a standard algorithm with procedural fluency.",
		prerequisites: ["MA.4.NSO.2.4", "MA.4.NSO.2.1"],
	},
	{
		code: "MA.5.NSO.2.3",
		grade: 5,
		strand: "NSO",
		description:
			"Add and subtract multi-digit numbers with decimals to the thousandths, including using a standard algorithm with procedural fluency.",
		prerequisites: ["MA.5.NSO.1.3"],
	},
	{
		code: "MA.5.NSO.2.4",
		grade: 5,
		strand: "NSO",
		description:
			"Explore the multiplication and division of multi-digit numbers with decimals to the hundredths using estimation, rounding, and place value.",
		prerequisites: ["MA.5.NSO.2.1", "MA.5.NSO.2.3"],
	},
	{
		code: "MA.5.NSO.2.5",
		grade: 5,
		strand: "NSO",
		description:
			"Multiply and divide a multi-digit number with decimals to the tenths by one-tenth and one-hundredth.",
		prerequisites: ["MA.5.NSO.2.4"],
	},

	// FR – Grade 5
	{
		code: "MA.5.FR.1.1",
		grade: 5,
		strand: "FR",
		description:
			"Given a mathematical or real-world problem, represent the division of two whole numbers as a fraction.",
		prerequisites: ["MA.4.FR.1.3", "MA.4.NSO.2.4"],
	},
	{
		code: "MA.5.FR.2.1",
		grade: 5,
		strand: "FR",
		description:
			"Add and subtract fractions with unlike denominators, including mixed numbers and fractions greater than one, with procedural reliability.",
		prerequisites: ["MA.4.FR.2.2", "MA.4.FR.1.3"],
	},
	{
		code: "MA.5.FR.2.2",
		grade: 5,
		strand: "FR",
		description:
			"Extend previous understanding of multiplication to multiply a fraction by a fraction, including mixed numbers and fractions greater than one, with procedural reliability.",
		prerequisites: ["MA.4.FR.2.4", "MA.3.NSO.2.4"],
	},
	{
		code: "MA.5.FR.2.3",
		grade: 5,
		strand: "FR",
		description:
			"Solve real-world problems involving multiplication of a fraction by a fraction, including mixed numbers and fractions greater than one.",
		prerequisites: ["MA.5.FR.2.2"],
	},
	{
		code: "MA.5.FR.2.4",
		grade: 5,
		strand: "FR",
		description:
			"Extend previous understanding of division to explore the division of a unit fraction by a whole number and a whole number by a unit fraction.",
		prerequisites: ["MA.5.FR.2.2", "MA.4.NSO.2.4"],
	},

	// AR – Grade 5
	{
		code: "MA.5.AR.1.1",
		grade: 5,
		strand: "AR",
		description:
			"Solve multi-step real-world problems involving any combination of the four operations with whole numbers, including problems in which remainders must be interpreted.",
		prerequisites: ["MA.5.NSO.2.1", "MA.5.NSO.2.2"],
	},
	{
		code: "MA.5.AR.1.2",
		grade: 5,
		strand: "AR",
		description:
			"Solve real-world problems involving the addition, subtraction or multiplication of fractions, including mixed numbers and fractions greater than one.",
		prerequisites: ["MA.5.FR.2.1", "MA.5.FR.2.2"],
	},
	{
		code: "MA.5.AR.1.3",
		grade: 5,
		strand: "AR",
		description:
			"Solve real-world problems involving division of a whole number by a unit fraction or a unit fraction by a whole number.",
		prerequisites: ["MA.5.FR.2.4"],
	},
	{
		code: "MA.5.AR.2.1",
		grade: 5,
		strand: "AR",
		description: "Express whole numbers as fractions and fractions as whole numbers.",
		prerequisites: ["MA.4.AR.2.1"],
	},
	{
		code: "MA.5.AR.2.2",
		grade: 5,
		strand: "AR",
		description:
			"Given a mathematical or real-world context, write an equation involving any of the four operations to determine the unknown whole number with variables.",
		prerequisites: ["MA.5.AR.2.1", "MA.4.AR.2.1", "MA.3.AR.2.2"],
	},
	{
		code: "MA.5.AR.3.1",
		grade: 5,
		strand: "AR",
		description:
			"Given a numerical pattern, identify and write a rule that can describe the pattern as an expression.",
		prerequisites: ["MA.5.AR.2.2"],
	},
	{
		code: "MA.5.AR.3.2",
		grade: 5,
		strand: "AR",
		description:
			"Given a rule for a numerical pattern, use a two-column table to record the inputs and outputs.",
		prerequisites: ["MA.5.AR.3.1"],
	},

	// M – Grade 5
	{
		code: "MA.5.M.1.1",
		grade: 5,
		strand: "M",
		description:
			"Solve multi-step real-world problems that involve converting measurement units to equivalent measurements within a single system.",
		prerequisites: ["MA.4.M.1.1"],
	},
	{
		code: "MA.5.M.2.1",
		grade: 5,
		strand: "M",
		description:
			"Find the perimeter and area of a rectangle with fractional or decimal side lengths.",
		prerequisites: ["MA.4.GR.2.1", "MA.5.FR.2.2", "MA.5.NSO.2.3"],
	},

	// GR – Grade 5
	{
		code: "MA.5.GR.1.1",
		grade: 5,
		strand: "GR",
		description:
			"Classify triangles or quadrilaterals into different categories based on shared defining attributes.",
		prerequisites: ["MA.4.GR.1.3"],
	},
	{
		code: "MA.5.GR.1.2",
		grade: 5,
		strand: "GR",
		description:
			"Identify and classify three-dimensional figures including cones, cylinders, pyramids, prisms, and spheres based on their defining attributes.",
		prerequisites: ["MA.5.GR.1.1"],
	},
	{
		code: "MA.5.GR.2.1",
		grade: 5,
		strand: "GR",
		description:
			"Find the perimeter and area of a rectangle with fractional or decimal side lengths using visual models and formulas.",
		prerequisites: ["MA.4.GR.2.1", "MA.5.NSO.2.3"],
	},
	{
		code: "MA.5.GR.3.1",
		grade: 5,
		strand: "GR",
		description:
			"Explore volume as an attribute of three-dimensional figures by packing them with unit cubes without gaps.",
		prerequisites: ["MA.3.GR.2.2"],
	},
	{
		code: "MA.5.GR.3.2",
		grade: 5,
		strand: "GR",
		description:
			"Find the volume of a right rectangular prism with whole-number side lengths using a visual model and a formula.",
		prerequisites: ["MA.5.GR.3.1", "MA.3.GR.2.2"],
	},
	{
		code: "MA.5.GR.3.3",
		grade: 5,
		strand: "GR",
		description:
			"Solve real-world problems involving the volume of right rectangular prisms, including problems with an unknown edge length, with whole-number edge lengths.",
		prerequisites: ["MA.5.GR.3.2"],
	},
	{
		code: "MA.5.GR.4.1",
		grade: 5,
		strand: "GR",
		description: "Identify and plot ordered pairs in all four quadrants of a coordinate plane.",
		prerequisites: ["MA.5.NSO.1.3"],
	},
	{
		code: "MA.5.GR.4.2",
		grade: 5,
		strand: "GR",
		description:
			"Represent mathematical and real-world problems by plotting points in the first quadrant of the coordinate plane and interpret coordinate values of points in context.",
		prerequisites: ["MA.5.GR.4.1"],
	},

	// DP – Grade 5
	{
		code: "MA.5.DP.1.1",
		grade: 5,
		strand: "DP",
		description:
			"Collect and represent numerical data, including fractional and decimal values, using tables, line graphs, or line plots.",
		prerequisites: ["MA.4.DP.1.1", "MA.5.FR.1.1"],
	},
	{
		code: "MA.5.DP.1.2",
		grade: 5,
		strand: "DP",
		description:
			"Interpret data represented in tables, line graphs, or line plots and solve real-world problems using the mean, median, mode, and range.",
		prerequisites: ["MA.4.DP.1.2", "MA.5.NSO.2.1"],
	},
];

/** Look up a benchmark by its code. Returns undefined if not found. */
export function getBenchmark(code: string): Benchmark | undefined {
	return FL_BEST_STANDARDS.find((b) => b.code === code);
}

/** Return all direct prerequisites, recursively flattened, for a benchmark code. */
export function getPrerequisiteChain(code: string, visited = new Set<string>()): Benchmark[] {
	if (visited.has(code)) return [];
	visited.add(code);

	const benchmark = getBenchmark(code);
	if (!benchmark) return [];

	const result: Benchmark[] = [];
	for (const prereqCode of benchmark.prerequisites) {
		const prereq = getBenchmark(prereqCode);
		if (prereq) {
			result.push(prereq);
			result.push(...getPrerequisiteChain(prereqCode, visited));
		}
	}
	return result;
}

/** Format standards corpus as a compact string for injection into AI system prompt. */
export function formatStandardsForPrompt(): string {
	const lines: string[] = ["FL BEST Math Standards (Grades 3–5) with prerequisite chains:"];
	for (const b of FL_BEST_STANDARDS) {
		const prereqStr = b.prerequisites.length > 0 ? ` [prereqs: ${b.prerequisites.join(", ")}]` : "";
		lines.push(`${b.code} (Gr${b.grade}): ${b.description}${prereqStr}`);
	}
	return lines.join("\n");
}
