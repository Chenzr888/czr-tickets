// 一张单子 = tickets/<编号>-<标题>.md：头部几行「键: 值」，正文分四段。
// 网站接口、命令行工具都用这一个文件读写单子，格式只在这里定义。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const STAGES = ["收到", "分析中", "等待批复", "处理中", "待上线", "已完成", "需补充", "不处理"];
export const SECTIONS = ["客户原话", "内部建议", "处理记录", "给客户的说明"];

export const ticketsDir = (dir) => path.resolve(dir || process.env.TICKETS_DIR || "tickets");

const pad = (n) => String(n).padStart(2, "0");
const now = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const oneLine = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
// 客户写的内容放进正文；以 "## " 或 "---" 开头的行前面垫一个空格，免得被当成新段落或头部
const asBody = (s) => String(s ?? "").replace(/\r/g, "").replace(/^(#{1,6} |---)/gm, " $1").trim();

export function parse(text) {
  const [, head = "", rest = ""] = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) || [];
  const meta = {};
  for (const line of head.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const sections = {};
  let cur = null;
  for (const line of rest.split("\n")) {
    const h = line.match(/^## (.+)$/);
    if (h) sections[(cur = h[1].trim())] = [];
    else if (cur) sections[cur].push(line);
  }
  for (const k in sections) sections[k] = sections[k].join("\n").trim();
  return { meta, sections };
}

export function serialize({ meta, sections }) {
  const head = Object.entries(meta).map(([k, v]) => `${k}: ${oneLine(v)}`).join("\n");
  const body = SECTIONS.map((s) => `## ${s}\n\n${sections[s] || ""}`.trim()).join("\n\n");
  return `---\n${head}\n---\n\n${body}\n`;
}

const files = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d{4,}.*\.md$/.test(f)).sort() : []);
const read = (dir, f) => ({ file: path.join(dir, f), ...parse(fs.readFileSync(path.join(dir, f), "utf8")) });
const save = (t) => fs.writeFileSync(t.file, serialize(t));
const log = (t, line) => (t.sections["处理记录"] = `${t.sections["处理记录"] || ""}\n- ${now()} ${line}`.trim());

export const list = (dir) => files(dir).map((f) => read(dir, f));

export function load(dir, id) {
  const re = new RegExp(`^${String(id).padStart(4, "0")}(-|\\.md$)`);
  const f = files(dir).find((f) => re.test(f));
  if (!f) throw new Error(`没有这张单子：${id}`);
  return read(dir, f);
}

export function create(dir, { type, text, owner = "", contact = "" }) {
  if (!["bug", "improve"].includes(type)) throw new Error("type 只能是 bug 或 improve");
  if (!oneLine(text)) throw new Error("内容不能为空");
  fs.mkdirSync(dir, { recursive: true });
  const id = String(files(dir).reduce((m, f) => Math.max(m, parseInt(f, 10)), 0) + 1).padStart(4, "0");
  const key = crypto.randomBytes(12).toString("hex");
  const title = oneLine(text).replace(/[\\/:*?"<>|#\s.]+/g, "-").slice(0, 20).replace(/^-+|-+$/g, "");
  const t = {
    file: path.join(dir, `${id}-${title}.md`),
    meta: { id, type, stage: "收到", approved: "no", owner: owner || `key:${key}`, contact, created: now() },
    sections: { 客户原话: asBody(text) },
  };
  log(t, "收到");
  save(t);
  return { id, key };
}

export function setStage(dir, id, stage, note = "") {
  if (!STAGES.includes(stage)) throw new Error(`阶段只能是：${STAGES.join(" / ")}`);
  const t = load(dir, id);
  t.meta.stage = stage;
  log(t, stage + (oneLine(note) ? `：${oneLine(note)}` : ""));
  save(t);
}

export function setSection(dir, id, name, text) {
  const t = load(dir, id);
  t.sections[name] = asBody(text);
  save(t);
}

export function approve(dir, id) {
  const t = load(dir, id);
  if (t.meta.type !== "improve") throw new Error("只有改进单需要批复");
  t.meta.approved = "yes";
  log(t, "已批复");
  save(t);
}

// 这一轮该干的活，按顺序：上次没做完的 → 已批复的改进 → 新报错 → 新改进
export function todo(dir) {
  const rank = (t) =>
    ["分析中", "处理中"].includes(t.meta.stage) ? 0
    : t.meta.stage === "等待批复" && t.meta.approved === "yes" ? 1
    : t.meta.stage === "收到" ? (t.meta.type === "bug" ? 2 : 3)
    : -1;
  return list(dir).filter((t) => rank(t) >= 0).sort((a, b) => rank(a) - rank(b));
}

// 客户只能看到这些：阶段、处理记录、给客户的说明、自己的原话。内部建议、联系方式、钥匙一律不出去。
export const publicView = (t) => ({
  id: t.meta.id,
  type: t.meta.type,
  stage: t.meta.stage,
  created: t.meta.created,
  text: t.sections["客户原话"] || "",
  log: (t.sections["处理记录"] || "").split("\n").filter(Boolean).map((l) => l.replace(/^- /, "")),
  reply: t.sections["给客户的说明"] || "",
});

export function mine(dir, owners) {
  const set = new Set(owners);
  return list(dir).filter((t) => set.has(t.meta.owner)).map(publicView).reverse();
}
