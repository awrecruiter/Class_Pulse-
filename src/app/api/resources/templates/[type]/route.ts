export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";

const TEMPLATES: Record<string, { filename: string; content: string }> = {
	"bell-ringer": {
		filename: "bell-ringer-template.csv",
		content: [
			"date,standard_code,problem,answer,time_minutes",
			'2026-01-06,MA.5.FR.1.1,"What is 3/4 expressed as an equivalent fraction with denominator 8?",6/8,5',
			'2026-01-07,MA.5.NSO.1.1,"Write 40000 + 3000 + 200 + 5 in standard form.",43205,5',
		].join("\n"),
	},
	cfu: {
		filename: "cfu-template.csv",
		content: [
			"date,standard_code,problem,answer,deliver_at_minute,is_exit_ticket",
			'2026-01-06,MA.5.FR.2.1,"A recipe calls for 2/3 cup of sugar. If you triple the recipe how much sugar do you need?",2,15,false',
			'2026-01-06,MA.5.FR.2.1,"Write 3/5 + 4/10 as a fraction in simplest form.",1,30,false',
			'2026-01-06,MA.5.FR.2.1,"Solve: 7/8 - 3/4",1/8,45,true',
		].join("\n"),
	},
	"exit-ticket": {
		filename: "exit-ticket-template.csv",
		content: [
			"date,standard_code,problem,answer,deliver_at_minute,is_exit_ticket",
			'2026-01-06,MA.5.FR.1.1,"Explain how you know 2/4 and 1/2 are equivalent.",Multiply/divide numerator and denominator by the same number,,true',
		].join("\n"),
	},
	pacing: {
		filename: "pacing-template.csv",
		content: [
			"week_of,standard_code,topic,lesson,notes",
			"2026-01-06,MA.5.FR.1.1,Topic 9,9.1,Introduce equivalent fractions",
			"2026-01-13,MA.5.FR.1.2,Topic 9,9.2,Compare fractions using benchmarks",
		].join("\n"),
	},
};

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ type: string }> },
) {
	const { type } = await params;
	const template = TEMPLATES[type];
	if (!template) {
		return NextResponse.json({ error: `Unknown template type: ${type}` }, { status: 404 });
	}
	return new NextResponse(template.content, {
		status: 200,
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="${template.filename}"`,
			"Cache-Control": "public, max-age=86400",
		},
	});
}
