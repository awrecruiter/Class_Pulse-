"use client";

import { ExternalLinkIcon, GlobeIcon } from "lucide-react";
import {
	BigIdeasIcon,
	CleverIcon,
	IreadyIcon,
	IxlIcon,
	McgrawHillIcon,
	MdcpsIcon,
	OnedriveIcon,
	OutlookIcon,
	PinnacleIcon,
	SchoologyIcon,
} from "./app-icons";

const PORTAL_BASE = "https://www3.dadeschools.net";

const QUICK_LINKS = [
	{
		label: "Portal",
		href: "https://www3.dadeschools.net",
		Icon: MdcpsIcon,
	},
	{
		label: "Outlook",
		href: "https://outlook.office365.com",
		Icon: OutlookIcon,
	},
	{
		label: "OneDrive",
		href: "https://portal.office.com/onedrive",
		Icon: OnedriveIcon,
	},
	{
		label: "Pinnacle",
		href: "https://gradebook.dadeschools.net/Pinnacle/Gradebook/",
		Icon: PinnacleIcon,
	},
	{
		label: "Schoology",
		href: "https://dadeschools.schoology.com",
		Icon: SchoologyIcon,
	},
	{
		label: "Clever",
		href: "https://clever.com/in/miami/teacher/resourceHub",
		Icon: CleverIcon,
	},
	{
		label: "iReady",
		href: "https://login.i-ready.com/educator/dashboard/math",
		Icon: IreadyIcon,
	},
	{
		label: "IXL",
		href: "https://clever.com/oauth/authorize?channel=clever-portal&client_id=3513be842ce24d16f779&confirmed=true&district_id=5106cec3a14b17af0f000054&redirect_uri=https%3A%2F%2Fwww.ixl.com%2Fclever%2Fsignin&response_type=code",
		Icon: IxlIcon,
	},
	{
		label: "Big Ideas",
		href: "https://www.bigideasmath.com/MRL/public/app/#/teacher/dashboard",
		Icon: BigIdeasIcon,
	},
	{
		label: "McGraw Hill",
		href: "https://my.mheducation.com/secure/teacher/urn:com.mheducation.openlearning:enterprise.identity.organization:prod.global:organization:8269ebcf-760e-4414-8c3e-60768e306ff4/home",
		Icon: McgrawHillIcon,
	},
];

export function PortalPanel() {
	return (
		<div className="flex flex-col h-full w-full bg-[#0d1525] p-8 overflow-y-auto">
			{/* Header */}
			<div className="flex items-center gap-3 mb-6">
				<div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
					<GlobeIcon className="h-5 w-5 text-indigo-400" />
				</div>
				<div>
					<h2 className="text-lg font-semibold text-slate-100">M-DCPS Portal</h2>
					<p className="text-xs text-slate-500">Links open in a new window — mic keeps listening</p>
				</div>
				<a
					href={PORTAL_BASE}
					target="_blank"
					rel="noopener noreferrer"
					className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors text-sm font-medium text-indigo-300 hover:text-white"
				>
					<ExternalLinkIcon className="h-4 w-4" />
					Open Portal
				</a>
			</div>

			{/* App icon grid — 5 per row */}
			<div className="grid grid-cols-5 gap-3">
				{QUICK_LINKS.map(({ label, href, Icon }) => (
					<a
						key={label}
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 hover:border-slate-600 transition-all group justify-center aspect-square"
					>
						<Icon size={36} />
						<span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors text-center leading-tight">
							{label}
						</span>
					</a>
				))}
			</div>
		</div>
	);
}
