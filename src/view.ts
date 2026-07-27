import { ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type DiaryTodoPlugin from "./main";
import { ExtractedTodo } from "./extract";
import { markTodoCompleted, scanTodos } from "./scanner";

export const VIEW_TYPE_DIARY_TODO = "diary-todo-board-view";

export class DiaryTodoBoardView extends ItemView {
	plugin: DiaryTodoPlugin;
	private todos: ExtractedTodo[] = [];
	private listEl: HTMLElement | null = null;
	private statusEl: HTMLElement | null = null;
	private refreshing = false;

	constructor(leaf: WorkspaceLeaf, plugin: DiaryTodoPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DIARY_TODO;
	}

	getDisplayText(): string {
		return "日记待办";
	}

	getIcon(): string {
		return "list-checks";
	}

	async onOpen(): Promise<void> {
		await this.renderShell();
		await this.refresh();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
		this.listEl = null;
		this.statusEl = null;
	}

	private async renderShell(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("diary-todo-board");

		const header = root.createDiv({ cls: "diary-todo-board__header" });
		header.createEl("h3", { text: "日记待办看板", cls: "diary-todo-board__title" });

		const actions = header.createDiv({ cls: "diary-todo-board__actions" });
		const refreshBtn = actions.createEl("button", {
			cls: "diary-todo-board__btn",
			attr: { type: "button", "aria-label": "刷新" },
		});
		setIcon(refreshBtn, "refresh-cw");
		refreshBtn.createSpan({ text: " 刷新" });
		refreshBtn.addEventListener("click", () => void this.refresh());

		this.statusEl = root.createDiv({ cls: "diary-todo-board__status" });
		this.listEl = root.createDiv({ cls: "diary-todo-board__list" });
	}

	async refresh(): Promise<void> {
		if (this.refreshing) return;
		this.refreshing = true;
		try {
			if (!this.plugin.settings.diaryFolder.trim()) {
				this.todos = [];
				this.setStatus("请先在设置中填写「日记文件夹路径」。");
				this.renderList();
				return;
			}

			this.setStatus("正在扫描…");
			this.todos = await scanTodos(this.app, this.plugin.settings);
			this.setStatus(
				this.todos.length === 0
					? "暂无未完成待办（已完成的不会显示）。"
					: `共 ${this.todos.length} 条未完成`,
			);
			this.renderList();
		} catch (err) {
			console.error(err);
			new Notice(`扫描失败：${String(err)}`);
			this.setStatus("扫描失败，请查看控制台。");
		} finally {
			this.refreshing = false;
		}
	}

	private setStatus(text: string): void {
		if (this.statusEl) this.statusEl.setText(text);
	}

	private renderList(): void {
		if (!this.listEl) return;
		this.listEl.empty();

		this.todos.forEach((todo, index) => {
			const row = this.listEl!.createDiv({ cls: "diary-todo-board__item" });

			const main = row.createDiv({ cls: "diary-todo-board__item-main" });
			main.createSpan({
				cls: "diary-todo-board__index",
				text: `${index + 1}.`,
			});
			const content = main.createSpan({
				cls: "diary-todo-board__content",
				text: todo.content,
			});
			content.title = `${todo.filePath}  ·  第 ${todo.lineIndex + 1} 行`;

			const meta = row.createDiv({ cls: "diary-todo-board__meta" });
			const openLink = meta.createEl("a", {
				cls: "diary-todo-board__file",
				text: todo.filePath,
				href: "#",
			});
			openLink.addEventListener("click", (ev) => {
				ev.preventDefault();
				void this.openSource(todo);
			});

			const doneBtn = row.createEl("button", {
				cls: "diary-todo-board__done",
				text: "完成",
				attr: { type: "button" },
			});
			doneBtn.addEventListener("click", () => void this.completeTodo(todo, row));
		});
	}

	private async openSource(todo: ExtractedTodo): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(todo.filePath);
		if (!(file instanceof TFile)) {
			new Notice(`找不到文件：${todo.filePath}`);
			return;
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, {
			eState: { line: todo.lineIndex },
		});
	}

	private async completeTodo(todo: ExtractedTodo, row: HTMLElement): Promise<void> {
		try {
			await markTodoCompleted(this.app, todo, this.plugin.settings);
			row.addClass("diary-todo-board__item--done");
			// Remove from board immediately
			this.todos = this.todos.filter((t) => t !== todo);
			row.remove();
			this.renumberVisible();
			this.setStatus(
				this.todos.length === 0
					? "暂无未完成待办（已完成的不会显示）。"
					: `共 ${this.todos.length} 条未完成`,
			);
			new Notice("已标记完成，并写回日记原文");
		} catch (err) {
			console.error(err);
			new Notice(`完成失败：${String(err)}`);
			await this.refresh();
		}
	}

	private renumberVisible(): void {
		if (!this.listEl) return;
		const indexes = this.listEl.querySelectorAll(".diary-todo-board__index");
		indexes.forEach((el, i) => {
			el.setText(`${i + 1}.`);
		});
	}
}
