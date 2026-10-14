// 演示用的小网站：一个番茄钟（故意留了个 bug：点"重置"后时间会自己接着走）+ 反馈按钮。
// 启动：node examples/demo-site/server.mjs   打开 http://localhost:4173
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleTickets } from "../../skills/czr-tickets/scripts/server.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "tickets");
const files = {
  "/": [path.join(here, "index.html"), "text/html"],
  "/tickets-widget.js": [path.join(here, "../../skills/czr-tickets/assets/widget.js"), "text/javascript"],
};

http
  .createServer(async (req, res) => {
    if (await handleTickets(req, res, { dir })) return;
    const f = files[new URL(req.url, "http://x").pathname];
    if (!f) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": `${f[1]}; charset=utf-8` });
    fs.createReadStream(f[0]).pipe(res);
  })
  .listen(process.env.PORT || 4173, () => console.log(`番茄钟在 http://localhost:${process.env.PORT || 4173}`));
