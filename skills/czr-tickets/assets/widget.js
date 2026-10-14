// 反馈按钮 + 反馈中心弹窗（参考实现，原生 JS，一个文件）。
// 用法：<script src="/tickets-widget.js" data-api="/api/tickets" defer></script>
// 可选：data-label="反馈"；data-button="none" 不显示右下角按钮，自己的按钮里调用 window.czrTickets.open()
// 配色跟网站走：在页面上设置 --tickets-accent / --tickets-bg / --tickets-fg / --tickets-line / --tickets-muted（深色网站把 bg/fg/line 设成深色即可）
(() => {
  const me = document.currentScript;
  const API = me?.dataset.api || "/api/tickets";
  const LABEL = me?.dataset.label || "反馈";
  const KEYS = "czr-tickets:keys";
  const FLOW = {
    bug: ["收到", "分析中", "处理中", "待上线", "已完成"],
    improve: ["收到", "等待批复", "处理中", "待上线", "已完成"],
  };
  const HINT = {
    bug: "哪里出了问题？在哪个页面、点了什么、看到了什么",
    improve: "希望增加或改变什么？为什么需要它",
  };

  const keys = () => { try { return JSON.parse(localStorage.getItem(KEYS)) || []; } catch { return []; } };
  const addKey = (k) => { try { localStorage.setItem(KEYS, JSON.stringify([...keys(), k])); } catch {} };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const post = (p, body) =>
    fetch(API + p, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) })
      .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(new Error(d.error || "提交失败，请稍后再试")))));

  const CSS = `
:host{all:initial;--a:var(--tickets-accent,#2563eb);--bg:var(--tickets-bg,#fff);--fg:var(--tickets-fg,#0f172a);--line:var(--tickets-line,#e2e8f0);--mut:var(--tickets-muted,#64748b)}
*{box-sizing:border-box;font-family:var(--tickets-font,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif)}
button{font:inherit;color:inherit;cursor:pointer}
.fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;padding:10px 18px;border:0;border-radius:999px;background:var(--a);color:#fff;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.mask{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px}
.mask[hidden]{display:none}
.card{width:min(560px,100%);max-height:88vh;display:flex;flex-direction:column;background:var(--bg);color:var(--fg);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden;font-size:14px;line-height:1.6}
header{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line)}
header b{flex:1;font-size:15px}
header button{border:0;background:none;color:var(--mut)}
.x{font-size:22px;line-height:1}
main{padding:16px;overflow:auto;display:flex;flex-direction:column;gap:12px}
.choices{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:480px){.choices{grid-template-columns:1fr}}
.choices button{text-align:left;padding:18px 16px;border:1px solid var(--line);border-radius:12px;background:none;display:flex;flex-direction:column;gap:6px}
.choices button:hover,.list button:hover{border-color:var(--a)}
.choices span,.muted{color:var(--mut);font-size:13px;margin:0}
.seg{display:flex;gap:8px}
.seg button{flex:1;padding:8px;border:1px solid var(--line);border-radius:8px;background:none}
.seg .on{border-color:var(--a);color:var(--a);font-weight:600}
textarea,input{width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font:inherit;background:none;color:inherit}
textarea{min-height:140px;resize:vertical}
.primary{padding:10px;border:0;border-radius:8px;background:var(--a);color:#fff}
.primary:disabled{opacity:.5}
.err{color:#dc2626;margin:0}
.list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.list button{width:100%;display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--line);border-radius:10px;background:none;text-align:left}
.txt{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tag{font-size:12px;padding:1px 8px;border-radius:999px;background:#fee2e2;color:#b91c1c;flex:none}
.tag.improve{background:#dbeafe;color:#1d4ed8}
.st{font-size:12px;color:var(--mut);flex:none}
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}
.steps li{text-align:center;font-size:12px;padding-top:8px;border-top:4px solid var(--line);color:var(--mut)}
.steps .done{border-color:var(--a);color:var(--fg)}
.steps .now{border-color:var(--a);color:var(--a);font-weight:600}
.note{padding:10px 12px;border-radius:8px;background:#fef3c7;color:#92400e;margin:0}
h4{margin:0 0 4px;font-size:13px;color:var(--mut);font-weight:500}
section p{margin:0;white-space:pre-wrap}
.log{margin:0;padding-left:18px;color:var(--mut)}`;

  function start() {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${CSS}</style>
      ${me?.dataset.button === "none" ? "" : `<button class="fab">${esc(LABEL)}</button>`}
      <div class="mask" hidden><div class="card" role="dialog" aria-modal="true">
        <header><button class="back" hidden>‹ 返回</button><b></b><button class="x" aria-label="关闭">×</button></header>
        <main></main>
      </div></div>`;
    const $ = (s) => root.querySelector(s);
    const $$ = (s) => root.querySelectorAll(s);
    let back = null;
    const render = (title, html, onBack) => {
      $("header b").textContent = title;
      $("main").innerHTML = html;
      back = onBack;
      $(".back").hidden = !onBack;
    };
    const open = () => { $(".mask").hidden = false; choose(); };
    const close = () => { $(".mask").hidden = true; };
    $(".fab")?.addEventListener("click", open);
    $(".x").onclick = close;
    $(".back").onclick = () => back?.();
    $(".mask").onclick = (e) => e.target === $(".mask") && close();
    document.addEventListener("keydown", (e) => e.key === "Escape" && close());
    window.czrTickets = { open, close };

    function choose() {
      render("反馈中心", `<div class="choices">
        <button data-v="mine"><b>查看工单进度</b><span>看看我提过的问题处理到哪了</span></button>
        <button data-v="submit"><b>提交工单</b><span>报告问题，或者提个改进建议</span></button></div>`);
      $('[data-v="mine"]').onclick = mineView;
      $('[data-v="submit"]').onclick = () => submit();
    }

    function submit(type = "bug") {
      render("提交工单", `
        <div class="seg"><button data-t="bug">遇到问题</button><button data-t="improve">改进建议</button></div>
        <textarea maxlength="4000"></textarea>
        <input maxlength="100" placeholder="联系方式（选填，方便我们找你确认）">
        <p class="err" hidden></p>
        <button class="primary">提交</button>`, choose);
      const pick = (t) => {
        type = t;
        $$(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
        $("textarea").placeholder = HINT[t];
      };
      $$(".seg button").forEach((b) => (b.onclick = () => pick(b.dataset.t)));
      pick(type);
      $(".primary").onclick = async () => {
        const text = $("textarea").value.trim();
        if (!text) return $("textarea").focus();
        $(".primary").disabled = true;
        try {
          const r = await post("", { type, text, contact: $("input").value.trim() });
          if (r.key) addKey(r.key);
          render("已收到", `<p>单号 <b>${esc(r.id)}</b>，我们会尽快处理，处理到哪一步随时可以在这里看。</p><button class="primary">查看进度</button>`, choose);
          $(".primary").onclick = mineView;
        } catch (e) {
          $(".err").hidden = false;
          $(".err").textContent = e.message;
          $(".primary").disabled = false;
        }
      };
    }

    async function mineView() {
      render("我的工单", `<p class="muted">加载中…</p>`, choose);
      let list;
      try { list = await post("/mine", { keys: keys() }); }
      catch (e) { $("main").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
      if (!list.length) {
        $("main").innerHTML = `<p class="muted">还没有提交过工单。</p><button class="primary">提交工单</button>`;
        $(".primary").onclick = () => submit();
        return;
      }
      $("main").innerHTML = `<ul class="list">${list.map((t, i) => `<li><button data-i="${i}">
        <span class="tag ${t.type}">${t.type === "bug" ? "问题" : "建议"}</span>
        <span class="txt">${esc(t.text)}</span><span class="st">${esc(t.stage)}</span></button></li>`).join("")}</ul>`;
      $$(".list button").forEach((b) => (b.onclick = () => detail(list[b.dataset.i])));
    }

    function detail(t) {
      const flow = FLOW[t.type];
      const at = Math.max(flow.indexOf(t.stage === "需补充" ? "分析中" : t.stage), 0);
      const finished = t.stage === "已完成";
      render(`工单 ${t.id}`, `
        ${t.stage === "不处理" ? `<p class="note">这条暂时不做，原因见下方说明。</p>`
          : `<ol class="steps">${flow.map((s, i) => `<li class="${i < at || finished ? "done" : i === at ? "now" : ""}">${s}</li>`).join("")}</ol>`}
        ${t.stage === "需补充" ? `<p class="note">需要你补充一点信息，请看下方说明，再提交一张工单补充给我们。</p>` : ""}
        ${t.reply ? `<section><h4>说明</h4><p>${esc(t.reply)}</p></section>` : ""}
        <section><h4>处理记录</h4><ul class="log">${t.log.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></section>
        <section><h4>你的描述</h4><p>${esc(t.text)}</p></section>`, mineView);
    }
  }

  document.body ? start() : addEventListener("DOMContentLoaded", start);
})();
