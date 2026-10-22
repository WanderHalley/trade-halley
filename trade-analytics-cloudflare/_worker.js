const COOKIE_NAME = "halley_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

function b64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function utf8(s) { return new TextEncoder().encode(s); }
async function hmac(message, secret) {
  const key = await crypto.subtle.importKey("raw", utf8(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, utf8(message))));
}
async function makeSession(username, secret) {
  const payload = b64url(utf8(JSON.stringify({ u: username, exp: Math.floor(Date.now()/1000)+SESSION_SECONDS })));
  return `${payload}.${await hmac(payload, secret)}`;
}
async function validSession(token, secret, expectedUser) {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sig !== await hmac(payload, secret)) return false;
  try {
    const base = payload.replace(/-/g,"+").replace(/_/g,"/");
    const padded = base + "=".repeat((4-base.length%4)%4);
    const json = decodeURIComponent(Array.from(atob(padded)).map(c=>"%"+c.charCodeAt(0).toString(16).padStart(2,"0")).join(""));
    const data = JSON.parse(json);
    return data.u === expectedUser && Number(data.exp) > Math.floor(Date.now()/1000);
  } catch { return false; }
}
function getCookie(request, name) {
  const raw=request.headers.get("Cookie")||"";
  for (const part of raw.split(";")) {
    const [k,...rest]=part.trim().split("=");
    if (k===name) return rest.join("=");
  }
  return "";
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function loginPage(error="") {
  const message=error?`<div class="error">${escapeHtml(error)}</div>`:`<div class="hint">Entre para acessar sua análise.</div>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login · Analytics Halley</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1117;color:#edf4fb;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:20px}.card{width:min(420px,100%);background:#121a23;border:1px solid #243241;border-radius:18px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.35)}.brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.mark{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#ffb000,#ff7a00);display:grid;place-items:center;color:#17120a;font-weight:900}h1{font-size:20px;margin:0}p{margin:5px 0 0;color:#8fb1cf;font-size:13px}label{display:block;color:#9fc0dc;font-size:12px;margin:14px 0 6px}input{width:100%;background:#0d151e;color:#edf4fb;border:1px solid #243241;border-radius:10px;padding:12px;outline:none}input:focus{border-color:#577797}button{width:100%;margin-top:18px;border:1px solid #735000;background:#2b210b;color:#ffd469;padding:12px;border-radius:10px;font-weight:800;cursor:pointer}.hint{margin-top:14px;color:#8fb1cf;font-size:12px;text-align:center}.error{margin-top:14px;padding:10px;border:1px solid #71333b;background:#271318;color:#ff929c;border-radius:9px;font-size:12px}.footer{margin-top:18px;text-align:center;color:#5f7890;font-size:11px}</style></head><body><form class="card" method="post" action="/__login" autocomplete="on"><div class="brand"><div class="mark">HA</div><div><h1>Analytics Halley</h1><p>Acesso protegido</p></div></div><label for="username">Login</label><input id="username" name="username" autocomplete="username" required autofocus><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Entrar</button>${message}<div class="footer">Sessão mantida por até 30 dias neste navegador.</div></form></body></html>`;
}
function htmlResponse(body,status=200,headers={}) { return new Response(body,{status,headers:{"content-type":"text/html; charset=UTF-8","cache-control":"no-store",...headers}}); }

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    const LOGIN_USER=env.LOGIN_USER || "halley";
    const LOGIN_PASSWORD=env.LOGIN_PASSWORD;
    const SESSION_SECRET=env.SESSION_SECRET;
    if (!LOGIN_PASSWORD || !SESSION_SECRET) return htmlResponse("<h1>Configuração pendente</h1><p>Defina LOGIN_PASSWORD e SESSION_SECRET em Cloudflare → Settings → Variables and Secrets.</p>",500);
    if (url.pathname==="/__logout") return new Response(null,{status:302,headers:{Location:"/","Set-Cookie":`${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}});
    if (url.pathname==="/__login") {
      if (request.method!=="POST") return new Response(null,{status:302,headers:{Location:"/"}});
      const form=await request.formData();
      const username=String(form.get("username")||"");
      const password=String(form.get("password")||"");
      if (username!==LOGIN_USER || password!==LOGIN_PASSWORD) return htmlResponse(loginPage("Login ou senha incorretos."),401);
      const token=await makeSession(username,SESSION_SECRET);
      return new Response(null,{status:302,headers:{Location:"/","Set-Cookie":`${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`}});
    }
    if (!(await validSession(getCookie(request,COOKIE_NAME),SESSION_SECRET,LOGIN_USER))) return htmlResponse(loginPage(),401);
    return env.ASSETS.fetch(request);
  }
};
