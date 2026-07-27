/**
 * Extract open todos from ordered lists in Markdown.
 *
 * Rules (configurable brackets):
 * - Only ordered list items: `1. …`
 * - Only when a status tag `OPEN…CLOSE` sits at the head (after `N.`, allowing **bold**)
 * - Skip when inner text equals completedLabel
 * - Any other head tag = open todo
 * - Skip empty content / code fences / blockquotes
 *
 * Complete write-back:
 * - Replace the head tag with (optional **)OPEN + completedLabel + CLOSE(**)
 */

export interface TagRule {
	/** Opening delimiter, default `【` */
	open: string;
	/** Closing delimiter, default `】` */
	close: string;
	/** Inner text that means done, default `已完成` */
	completedLabel: string;
	/** Wrap completed tag with `**…**` for theme highlight */
	boldCompleted: boolean;
}

export const DEFAULT_TAG_RULE: TagRule = {
	open: "【",
	close: "】",
	completedLabel: "已完成",
	boldCompleted: true,
};

export interface ExtractedTodo {
	filePath: string;
	lineIndex: number;
	originalLine: string;
	/** Display text after the head status tag */
	content: string;
	indent: string;
	number: string;
	/** Raw tag text inside brackets */
	tagInner: string;
}

const ORDERED_PREFIX = /^(\s*)(\d+)\.\s+(.*)$/;

export interface ParsedHead {
	openEm: string;
	tagFull: string;
	tagInner: string;
	closeEm: string;
	gap: string;
	after: string;
}

export function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeTagRule(partial?: Partial<TagRule> | null): TagRule {
	const open = (partial?.open ?? DEFAULT_TAG_RULE.open).trim() || DEFAULT_TAG_RULE.open;
	const close =
		(partial?.close ?? DEFAULT_TAG_RULE.close).trim() || DEFAULT_TAG_RULE.close;
	const completedLabel =
		(partial?.completedLabel ?? DEFAULT_TAG_RULE.completedLabel).trim() ||
		DEFAULT_TAG_RULE.completedLabel;
	const boldCompleted =
		partial?.boldCompleted === undefined
			? DEFAULT_TAG_RULE.boldCompleted
			: !!partial.boldCompleted;
	return { open, close, completedLabel, boldCompleted };
}

export function buildHeadTagRegex(rule: TagRule): RegExp {
	const o = escapeRegExp(rule.open);
	const c = escapeRegExp(rule.close);
	const inner = `(?:(?!${c}).)*`;
	return new RegExp(
		`^(\\*{1,2}|_{1,2})?\\s*(${o}(${inner})${c})(\\*{1,2}|_{1,2})?(\\s*)(.*)$`,
	);
}

export function parseHeadTag(rest: string, rule: TagRule): ParsedHead | null {
	const m = rest.trim().match(buildHeadTagRegex(rule));
	if (!m) return null;
	return {
		openEm: m[1] ?? "",
		tagFull: m[2],
		tagInner: (m[3] ?? "").trim(),
		closeEm: m[4] ?? "",
		gap: m[5] ?? "",
		after: m[6] ?? "",
	};
}

export function isCompletedTag(tagInner: string, rule: TagRule): boolean {
	return tagInner === rule.completedLabel;
}

export function formatCompletedTag(rule: TagRule): string {
	const core = `${rule.open}${rule.completedLabel}${rule.close}`;
	return rule.boldCompleted ? `**${core}**` : core;
}

export function extractTodosFromMarkdown(
	filePath: string,
	markdown: string,
	ruleInput?: Partial<TagRule> | null,
): ExtractedTodo[] {
	const rule = normalizeTagRule(ruleInput);
	const lines = markdown.split(/\r?\n/);
	const results: ExtractedTodo[] = [];
	let inFence = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		const fence = line.match(/^\s*(```|~~~)/);
		if (fence) {
			inFence = !inFence;
			continue;
		}
		if (inFence) continue;
		if (/^\s*>/.test(line)) continue;

		const m = line.match(ORDERED_PREFIX);
		if (!m) continue;

		const indent = m[1];
		const number = m[2];
		const rest = m[3] ?? "";

		const head = parseHeadTag(rest, rule);
		if (!head) continue;
		if (isCompletedTag(head.tagInner, rule)) continue;

		const content = head.after.trim();
		if (!content) continue;

		results.push({
			filePath,
			lineIndex: i,
			originalLine: line,
			content,
			indent,
			number,
			tagInner: head.tagInner,
		});
	}

	return results;
}

/**
 * Replace the head status tag with the configured completed marker.
 */
export function toCompletedLine(
	originalLine: string,
	ruleInput?: Partial<TagRule> | null,
): string | null {
	const rule = normalizeTagRule(ruleInput);
	const m = originalLine.match(ORDERED_PREFIX);
	if (!m) return null;

	const indent = m[1];
	const number = m[2];
	const rest = m[3] ?? "";
	const head = parseHeadTag(rest, rule);
	if (!head) return null;
	if (isCompletedTag(head.tagInner, rule)) return null;

	const body = head.after;
	const gap = body.length > 0 ? head.gap : "";
	const tag = formatCompletedTag(rule);
	return `${indent}${number}. ${tag}${gap}${body}`.replace(/\s+$/, "");
}
