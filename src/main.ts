import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import {
	DEFAULT_SETTINGS,
	DiaryTodoSettingTab,
	DiaryTodoSettings,
} from "./settings";
import { DiaryTodoBoardView, VIEW_TYPE_DIARY_TODO } from "./view";

export default class DiaryTodoPlugin extends Plugin {
	settings: DiaryTodoSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_DIARY_TODO,
			(leaf) => new DiaryTodoBoardView(leaf, this),
		);

		this.addRibbonIcon("list-checks", "打开日记待办看板", async () => {
			await this.activateView();
		});

		this.addCommand({
			id: "open-diary-todo-board",
			name: "打开日记待办看板",
			callback: async () => {
				await this.activateView();
			},
		});

		this.addCommand({
			id: "refresh-diary-todo-board",
			name: "刷新日记待办看板",
			callback: async () => {
				await this.refreshOpenViews();
				new Notice("日记待办已刷新");
			},
		});

		this.addSettingTab(new DiaryTodoSettingTab(this.app, this));

		// Auto-scan once when layout is ready (if board is open / will open).
		this.app.workspace.onLayoutReady(async () => {
			await this.refreshOpenViews();
		});
	}

	onunload(): void {
		// Leave leaves; Obsidian cleans registered views.
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Ensure new fields exist after upgrades from older data.json
		if (!this.settings.tagOpen) this.settings.tagOpen = DEFAULT_SETTINGS.tagOpen;
		if (!this.settings.tagClose) this.settings.tagClose = DEFAULT_SETTINGS.tagClose;
		if (!this.settings.completedLabel) {
			this.settings.completedLabel = DEFAULT_SETTINGS.completedLabel;
		}
		if (this.settings.boldCompleted === undefined) {
			this.settings.boldCompleted = DEFAULT_SETTINGS.boldCompleted;
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const existing = workspace.getLeavesOfType(VIEW_TYPE_DIARY_TODO);
		if (existing.length > 0) {
			leaf = existing[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) {
				leaf = workspace.getLeaf(true);
			}
			await leaf.setViewState({
				type: VIEW_TYPE_DIARY_TODO,
				active: true,
			});
		}

		workspace.revealLeaf(leaf);

		const view = leaf.view;
		if (view instanceof DiaryTodoBoardView) {
			await view.refresh();
		}
	}

	async refreshOpenViews(): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_DIARY_TODO)) {
			const view = leaf.view;
			if (view instanceof DiaryTodoBoardView) {
				await view.refresh();
			}
		}
	}
}
