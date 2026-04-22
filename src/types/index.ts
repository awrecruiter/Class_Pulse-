export type LessonResourceType = "slides" | "book" | "worksheet" | "video" | "other";

export type LessonResource = {
	id: string;
	topicNumber: number;
	lessonNumber: string;
	resourceType: LessonResourceType;
	label: string;
	url: string;
	sortOrder: number;
	isTeacherOverride: boolean;
};
