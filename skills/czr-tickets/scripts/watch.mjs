#!/usr/bin/env node
// 事件驱动：盯着 tickets/，一有新单子或有人批复，就叫 AI 处理一轮。
//   node watch.mjs                          默认命令：claude -p "处理工单"
//   node watch.mjs <别的命令…>              换成别的 AI，后面整条就是要跑的命令（各家写法见 references/triggers.md）
// 同一时间只跑一轮；跑的时候来的新事件，跑完马上再跑一轮。
// 卡住的单子不会反复触发：只有"待办清单变了"才算新事件。
import { spawn } from "node:child_process";
import { todo, ticketsDir } from "./tickets-lib.mjs";

const dir = ticketsDir();
const cmd = process.argv.length > 2 ? process.argv.slice(2) : ["claude", "-p", "处理工单"];
const every = Number(process.env.TICKETS_WATCH_SECONDS || 5) * 1000;
const stamp = () => new Date().toTimeString().slice(0, 8);
const sig = () => todo(dir).map((t) => `${t.meta.id}:${t.meta.stage}:${t.meta.approved}`).join(",");

let handled = ""; // 启动时手上已有的待办也算一次事件
let running = false;

function tick() {
  if (running) return;
  const now = sig();
  if (!now || now === handled) return;
  running = true;
  console.log(`${stamp()} 有新事件，开始处理：${now}`);
  const p = spawn(cmd[0], cmd.slice(1), { stdio: "inherit" });
  p.on("exit", (code) => {
    handled = sig();
    running = false;
    console.log(`${stamp()} 这一轮结束（${code === 0 ? "正常" : `退出码 ${code}`}），继续盯着`);
    tick();
  });
}

console.log(`${stamp()} 开始盯 ${dir}，有事件就跑：${cmd.join(" ")}`);
tick();
setInterval(tick, every);
