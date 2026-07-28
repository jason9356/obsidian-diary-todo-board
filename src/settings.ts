import { App, PluginSettingTab, Setting, TFolder } from "obsidian";
import type DiaryTodoPlugin from "./main";
import { DEFAULT_TAG_RULE, formatCompletedTag, normalizeTagRule } from "./extract";

export interface DiaryTodoSettings {
	/** Required: primary diary folder (vault-relative, non-recursive) */
	diaryFolder: string;
	/** Optional extra folders (non-recursive) */
	extraFolders: string[];
	/** Status tag opening delimiter, e.g. 【 or [ */
	tagOpen: string;
	/** Status tag closing delimiter, e.g. 】 or ] */
	tagClose: string;
	/** Inner text meaning completed */
	completedLabel: string;
	/** Wrap completed marker with ** for theme highlight */
	boldCompleted: boolean;
}

export const DEFAULT_SETTINGS: DiaryTodoSettings = {
	diaryFolder: "",
	extraFolders: [],
	tagOpen: DEFAULT_TAG_RULE.open,
	tagClose: DEFAULT_TAG_RULE.close,
	completedLabel: DEFAULT_TAG_RULE.completedLabel,
	boldCompleted: DEFAULT_TAG_RULE.boldCompleted,
};

export function settingsToTagRule(settings: DiaryTodoSettings) {
	return normalizeTagRule({
		open: settings.tagOpen,
		close: settings.tagClose,
		completedLabel: settings.completedLabel,
		boldCompleted: settings.boldCompleted,
	});
}

export class DiaryTodoSettingTab extends PluginSettingTab {
	plugin: DiaryTodoPlugin;

	constructor(app: App, plugin: DiaryTodoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "日记待办看板" });
		containerEl.createEl("p", {
			text: "只扫描指定文件夹内的 Markdown 文件（不递归子文件夹）。从有序列表句首的状态标记抽取未完成待办。",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("日记文件夹路径")
			.setDesc("必填。例如：日记 或 Daily Notes（相对库根目录）")
			.addText((text) =>
				text
					.setPlaceholder("例如：日记")
					.setValue(this.plugin.settings.diaryFolder)
					.onChange(async (value) => {
						this.plugin.settings.diaryFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("附加文件夹")
			.setDesc("可选。多个路径用英文逗号分隔，例如：工作, 项目/记录")
			.addTextArea((text) => {
				text
					.setPlaceholder("工作, 归档")
					.setValue(this.plugin.settings.extraFolders.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.extraFolders = value
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean);
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 3;
				text.inputEl.style.width = "100%";
			});

		containerEl.createEl("h3", { text: "状态标记（检索规则）" });
		containerEl.createEl("p", {
			text: "只有有序列表句首出现「开+内容+闭」标记时才会被抽取。示例：【未完成】、[todo]、〈进行中〉。完成时会把中间文字替换为下方的「已完成文案」。",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("标记左边界")
			.setDesc("默认【。也可改为 [ 或 〈 等")
			.addText((text) =>
				text
					.setPlaceholder("【")
					.setValue(this.plugin.settings.tagOpen)
					.onChange(async (value) => {
						this.plugin.settings.tagOpen = value;
						await this.plugin.saveSettings();
						this.updatePreview();
					}),
			);

		new Setting(containerEl)
			.setName("标记右边界")
			.setDesc("默认】。也可改为 ] 或 〉 等")
			.addText((text) =>
				text
					.setPlaceholder("】")
					.setValue(this.plugin.settings.tagClose)
					.onChange(async (value) => {
						this.plugin.settings.tagClose = value;
						await this.plugin.saveSettings();
						this.updatePreview();
					}),
			);

		new Setting(containerEl)
			.setName("已完成文案")
			.setDesc("括号内等于该文案的条目不会进入看板；点完成时也会写成该文案")
			.addText((text) =>
				text
					.setPlaceholder("已完成")
					.setValue(this.plugin.settings.completedLabel)
					.onChange(async (value) => {
						this.plugin.settings.completedLabel = value;
						await this.plugin.saveSettings();
						this.updatePreview();
					}),
			);

		new Setting(containerEl)
			.setName("完成时加粗（**）")
			.setDesc("开启后写成 **【已完成】** 这类形式，便于主题高亮")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.boldCompleted)
					.onChange(async (value) => {
						this.plugin.settings.boldCompleted = value;
						await this.plugin.saveSettings();
						this.updatePreview();
					}),
			);

		this.previewEl = containerEl.createDiv({
			cls: "setting-item-description diary-todo-tag-preview",
		});
		this.updatePreview();

		new Setting(containerEl)
			.setName("恢复默认标记")
			.setDesc("恢复为【】与「已完成」，并开启加粗")
			.addButton((btn) =>
				btn.setButtonText("恢复默认").onClick(async () => {
					this.plugin.settings.tagOpen = DEFAULT_SETTINGS.tagOpen;
					this.plugin.settings.tagClose = DEFAULT_SETTINGS.tagClose;
					this.plugin.settings.completedLabel = DEFAULT_SETTINGS.completedLabel;
					this.plugin.settings.boldCompleted = DEFAULT_SETTINGS.boldCompleted;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		new Setting(containerEl)
			.setName("打开看板")
			.setDesc("在侧边栏打开待办看板视图")
			.addButton((btn) =>
				btn.setButtonText("打开看板").onClick(async () => {
					await this.plugin.activateView();
				}),
			);

		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder)
			.map((f) => f.path)
			.filter((p) => p && p !== "/")
			.sort((a, b) => a.localeCompare(b, "zh"));

		if (folders.length > 0) {
			const hint = containerEl.createDiv({ cls: "setting-item-description" });
			hint.createEl("strong", { text: "库中可用文件夹示例：" });
			hint.createEl("div", {
				text: folders.slice(0, 20).join(" · ") + (folders.length > 20 ? " …" : ""),
			});
		}
	}

	private previewEl: HTMLElement | null = null;

	private updatePreview(): void {
		if (!this.previewEl) return;
		const rule = settingsToTagRule(this.plugin.settings);
		const openSample = `1. ${rule.open}未完成${rule.close}示例待办`;
		const doneSample = `1. ${formatCompletedTag(rule)} 示例待办`;
		this.previewEl.empty();
		this.previewEl.createEl("div", { text: `抽取示例：${openSample}` });
		this.previewEl.createEl("div", { text: `完成后：${doneSample}` });
	}
}
