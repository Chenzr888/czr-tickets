// 网站接口的参考写法（Node 原生 http，不依赖任何框架）。
// 接到别的框架时，照着这两个接口的行为改写即可：
//   POST /api/tickets        { type, text, contact }  → { id, key }
//   POST /api/tickets/mine   { keys: [...] }          → 自己的单子（只含客户可见的字段）
// 网站有登录的话，传 userOf(req) 返回当前用户编号，单子就归到这个用户名下，不再用浏览器钥匙。
import { create, mine, ticketsDir, oneLine } from "./tickets-lib.mjs";

const readJson = (req) =>
  new Promise((ok) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch { ok({}); } });
  });
const send = (res, code, data) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
};

export async function handleTickets(req, res, { dir = ticketsDir(), api = "/api/tickets", userOf = () => null } = {}) {
  const { pathname } = new URL(req.url, "http://x");
  if (req.method !== "POST" || (pathname !== api && pathname !== `${api}/mine`)) return false;
  const data = await readJson(req);
  const user = userOf(req);
  try {
    if (pathname === api) {
      const r = create(dir, {
        type: data.type,
        text: String(data.text || "").slice(0, 4000),
        contact: oneLine(data.contact).slice(0, 100),
        owner: user ? `user:${user}` : "",
      });
      send(res, 200, user ? { id: r.id } : r);
    } else {
      const owners = user ? [`user:${user}`] : (data.keys || []).slice(0, 200).map((k) => `key:${k}`);
      send(res, 200, mine(dir, owners));
    }
  } catch (e) {
    send(res, 400, { error: e.message });
  }
  return true;
}
