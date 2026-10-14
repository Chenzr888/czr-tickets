#!/usr/bin/env node
// 管单子的小工具。单子放在 ./tickets（或环境变量 TICKETS_DIR 指定的文件夹）。
import * as T from "./tickets-lib.mjs";

const HELP = `用法：
  node tickets.mjs list [--todo]                 列出全部单子（--todo 只列这一轮该处理的）
  node tickets.mjs show <编号>                    看一张单子的全文
  node tickets.mjs new <bug|improve> "<内容>"     手动记一张单子
  node tickets.mjs stage <编号> <阶段> ["说明"]    改阶段，说明会给客户看，要用大白话
  node tickets.mjs suggest <编号> "<建议>"         写内部建议（客户看不到）
  node tickets.mjs explain <编号> "<说明>"         写给客户的说明（原因、改了什么、或要客户补充什么）
  node tickets.mjs approve <编号>                 批复改进单 —— 只有人明确说了"批复"才能用

阶段：${T.STAGES.join(" / ")}`;

const dir = T.ticketsDir();
const [cmd, a, b, c] = process.argv.slice(2);
const kind = { bug: "报错", improve: "改进" };
const row = (t) => `${t.meta.id}  ${kind[t.meta.type]}  ${t.meta.stage.padEnd(4, "　")}${t.meta.approved === "yes" ? " 已批复" : ""}  ${T.oneLine(t.sections["客户原话"]).slice(0, 40)}`;

const run = {
  list: () => {
    const all = a === "--todo" ? T.todo(dir) : T.list(dir);
    console.log(all.length ? all.map(row).join("\n") : a === "--todo" ? "没有要处理的单子。" : "还没有单子。");
  },
  show: () => console.log(T.serialize(T.load(dir, a))),
  new: () => console.log(`已记下，编号 ${T.create(dir, { type: a, text: b }).id}`),
  stage: () => (T.setStage(dir, a, b, c), console.log(`${a} → ${b}`)),
  suggest: () => (T.setSection(dir, a, "内部建议", b), console.log("已写入内部建议")),
  explain: () => (T.setSection(dir, a, "给客户的说明", b), console.log("已写入给客户的说明")),
  approve: () => (T.approve(dir, a), console.log(`${a} 已批复`)),
};

if (!run[cmd]) console.log(HELP);
else {
  try { run[cmd](); } catch (e) { console.error(e.message); process.exit(1); }
}
