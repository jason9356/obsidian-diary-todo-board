/**
 * Smoke tests for extract / complete rules (including custom brackets).
 * Run: npx tsx scripts/smoke-extract.ts
 */
import {
	DEFAULT_TAG_RULE,
	extractTodosFromMarkdown,
	parseHeadTag,
	toCompletedLine,
} from "../src/extract.ts";

function assert(cond: unknown, msg: string): void {
	if (!cond) throw new Error(msg);
}

const rule = DEFAULT_TAG_RULE;

assert(parseHeadTag("【未完成】处理周报", rule)?.tagInner === "未完成", "bare tag");
assert(parseHeadTag("**【持续中】** 某某", rule)?.tagInner === "持续中", "bold tag");
assert(parseHeadTag("联系老王", rule) === null, "no tag → not a todo");

const md = `# 日记

1. 联系老王确认参数
2. 【未完成】处理周报
3. 【已完成】已经做完的事
4. **【已完成】** 加粗已完成
5. **【持续中】** 还在跟进的事
6. 【待观察】观察中的事
7. 

- 【未完成】无序列表应跳过

> 1. 【未完成】引用应跳过

\`\`\`
1. 【未完成】代码块内不应抽取
\`\`\`

1. 跟进 XX 文件审批
`;

const todos = extractTodosFromMarkdown("日记/x.md", md, rule);
const contents = todos.map((t) => t.content);

assert(!contents.includes("联系老王确认参数"), "no 【】 → not extracted");
assert(!contents.includes("跟进 XX 文件审批"), "no 【】 → not extracted");
assert(contents.includes("处理周报"), "未完成 extracted");
assert(contents.includes("还在跟进的事"), "持续中 extracted");
assert(contents.includes("观察中的事"), "待观察 extracted");
assert(!contents.includes("已经做完的事"), "已完成 skipped");
assert(!contents.some((c) => c.includes("加粗已完成")), "bold 已完成 skipped");

assert(
	toCompletedLine("2. 【未完成】处理周报", rule) === "2. **【已完成】**处理周报",
	"replace unfinished with bold",
);
assert(
	toCompletedLine("5. **【持续中】** 还在跟进的事", rule) ===
		"5. **【已完成】** 还在跟进的事",
	"replace inner as bold",
);
assert(
	toCompletedLine("6. 【待观察】观察中的事", rule) === "6. **【已完成】**观察中的事",
	"replace 待观察 with bold",
);
assert(toCompletedLine("3. 【已完成】已经做完的事", rule) === null, "no double complete");
assert(toCompletedLine("1. 没有标签", rule) === null, "cannot complete without tag");

const ugly = toCompletedLine("2. 【未完成】处理周报", rule);
assert(ugly !== null && !ugly.includes("【已完成】【"), "no double brackets");

// Custom ASCII brackets for international users
const ascii = {
	open: "[",
	close: "]",
	completedLabel: "done",
	boldCompleted: false,
};
const asciiMd = `
1. [todo] Write docs
2. [done] Already finished
3. plain line without tag
`;
const asciiTodos = extractTodosFromMarkdown("n.md", asciiMd, ascii);
assert(asciiTodos.length === 1 && asciiTodos[0].content === "Write docs", "ascii extract");
assert(
	toCompletedLine("1. [todo] Write docs", ascii) === "1. [done] Write docs",
	"ascii complete",
);

console.log("SMOKE_OK", todos.map((t) => `${t.tagInner}:${t.content}`), asciiTodos);
