import { App, TFile, TFolder, normalizePath } from "obsidian";
import { DiaryTodoSettings, settingsToTagRule } from "./settings";
import {
	ExtractedTodo,
	extractTodosFromMarkdown,
	isCompletedTag,
	parseHeadTag,
	toCompletedLine,
} from "./extract";

/**
 * Collect Markdown files from configured folders (non-recursive).
 */
export function listScanFiles(app: App, settings: DiaryTodoSettings): TFile[] {
	const folders = collectFolderPaths(settings);
	const files: TFile[] = [];
	const seen = new Set<string>();

	for (const folderPath of folders) {
		const folder = app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) continue;

		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				if (seen.has(child.path)) continue;
				seen.add(child.path);
				files.push(child);
			}
		}
	}

	files.sort((a, b) => a.path.localeCompare(b.path, "zh"));
	return files;
}

export function collectFolderPaths(settings: DiaryTodoSettings): string[] {
	const paths: string[] = [];
	const primary = normalizeFolder(settings.diaryFolder);
	if (primary) paths.push(primary);

	for (const raw of settings.extraFolders ?? []) {
		const p = normalizeFolder(raw);
		if (p && !paths.includes(p)) paths.push(p);
	}
	return paths;
}

function normalizeFolder(raw: string): string {
	const trimmed = (raw ?? "").trim().replace(/\\/g, "/");
	if (!trimmed) return "";
	return normalizePath(trimmed.replace(/^\/+|\/+$/g, ""));
}

export async function scanTodos(
	app: App,
	settings: DiaryTodoSettings,
): Promise<ExtractedTodo[]> {
	const rule = settingsToTagRule(settings);
	const files = listScanFiles(app, settings);
	const all: ExtractedTodo[] = [];

	for (const file of files) {
		const text = await app.vault.read(file);
		all.push(...extractTodosFromMarkdown(file.path, text, rule));
	}
	return all;
}

/**
 * Mark a todo completed in the source note using the configured tag rule.
 */
export async function markTodoCompleted(
	app: App,
	todo: ExtractedTodo,
	settings: DiaryTodoSettings,
): Promise<boolean> {
	const rule = settingsToTagRule(settings);
	const file = app.vault.getAbstractFileByPath(todo.filePath);
	if (!(file instanceof TFile)) {
		throw new Error(`找不到文件：${todo.filePath}`);
	}

	const text = await app.vault.read(file);
	const lines = text.split(/\r?\n/);

	let targetIndex = -1;
	if (
		todo.lineIndex >= 0 &&
		todo.lineIndex < lines.length &&
		lines[todo.lineIndex] === todo.originalLine
	) {
		targetIndex = todo.lineIndex;
	} else {
		targetIndex = lines.findIndex((l) => l === todo.originalLine);
	}

	if (targetIndex < 0) {
		targetIndex = lines.findIndex((l) => {
			const m = l.match(/^(\s*)(\d+)\.\s+(.*)$/);
			if (!m) return false;
			const head = parseHeadTag(m[3] ?? "", rule);
			if (!head || isCompletedTag(head.tagInner, rule)) return false;
			return head.after.trim() === todo.content;
		});
	}

	if (targetIndex < 0) {
		throw new Error(`原文中找不到对应行：${todo.content}`);
	}

	const next = toCompletedLine(lines[targetIndex], rule);
	if (!next) {
		throw new Error(`无法标记完成：${lines[targetIndex]}`);
	}

	if (lines[targetIndex] === next) return false;

	lines[targetIndex] = next;
	const newline = text.includes("\r\n") ? "\r\n" : "\n";
	await app.vault.modify(file, lines.join(newline));
	return true;
}
