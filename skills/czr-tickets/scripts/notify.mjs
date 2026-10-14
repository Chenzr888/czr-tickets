#!/usr/bin/env node
// 往群里发一句话。机器人地址放在环境变量 TICKETS_WEBHOOK，或项目根目录 .env 里的 TICKETS_WEBHOOK=...
// 支持飞书、企业微信、钉钉、Slack、Discord；别的地址按 {"text": "..."} 发。没配置就什么都不做。
import fs from "node:fs";

const text = process.argv.slice(2).join(" ").trim();
const fromEnvFile = () => {
  try { return fs.readFileSync(".env", "utf8").match(/^TICKETS_WEBHOOK=(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, ""); } catch { return ""; }
};
const url = process.env.TICKETS_WEBHOOK || fromEnvFile();
if (!url || !text) {
  console.log(url ? "没有要发的内容" : "没配置通知，跳过");
  process.exit(0);
}

const host = new URL(url).hostname;
const body =
  /feishu|larksuite/.test(host) ? { msg_type: "text", content: { text } }
  : /qyapi\.weixin|dingtalk/.test(host) ? { msgtype: "text", text: { content: text } }
  : /discord/.test(host) ? { content: text }
  : { text };

const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
console.log(r.ok ? "已通知" : `通知没发出去：${r.status}`);
