export const PORTAL_URLS: Record<string, string> = {
	portal: "https://www3.dadeschools.net",
	outlook: "https://outlook.office365.com",
	onedrive: "https://portal.office.com/onedrive",
	pinnacle: "https://gradebook.dadeschools.net/Pinnacle/Gradebook/",
	schoology: "https://dadeschools.schoology.com",
	clever: "https://clever.com/in/miami/teacher/resourceHub",
	iready: "https://login.i-ready.com/educator/dashboard/math",
	ixl: "https://clever.com/oauth/authorize?channel=clever-portal&client_id=3513be842ce24d16f779&confirmed=true&district_id=5106cec3a14b17af0f000054&redirect_uri=https%3A%2F%2Fwww.ixl.com%2Fclever%2Fsignin&response_type=code",
	bigideas: "https://www.bigideasmath.com/MRL/public/app/#/teacher/dashboard",
	mcgrawhill:
		"https://my.mheducation.com/secure/teacher/urn:com.mheducation.openlearning:enterprise.identity.organization:prod.global:organization:8269ebcf-760e-4414-8c3e-60768e306ff4/home",
};

export function resolveDocUrl(url: string, linkType: string): string {
	if (linkType === "portal") return PORTAL_URLS[url] ?? url;
	return url;
}
