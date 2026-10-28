(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get users() { try { return JSON.parse(localStorage.getItem("c60_users")) || []; } catch { return []; } },
    set users(v) { localStorage.setItem("c60_users", JSON.stringify(v)); },
    get session() { return localStorage.getItem("c60_session"); },
    set session(v) { v ? localStorage.setItem("c60_session", v) : localStorage.removeItem("c60_session"); }
  };
  const digits = s => (s || "").replace(/\D/g, "");
  const me = () => store.users.find(u => u.tel === store.session);
  let lastTrigger = null, isPro = false;

  /* ---------- avisos ---------- */
  const toast = msg => {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 3200);
  };

  /* ---------- dialogs (focus trap e Esc nativos) ---------- */
  const open = name => {
    $$("dialog[open]").forEach(d => d.close());
    const d = $("#dlg-" + name);
    if (name === "profile") fillProfile();
    d.showModal();
    $$(".err", d).forEach(e => (e.textContent = ""));
    (d.querySelector("input,textarea") || d).focus();
  };
  const close = d => {
    if (!d.open) return;
    d.classList.add("closing");
    setTimeout(() => { d.classList.remove("closing"); d.close(); }, 200);
  };
  document.addEventListener("click", e => {
    const o = e.target.closest("[data-open]");
    if (o) { lastTrigger = o; open(o.dataset.open); return; }
    if (e.target.closest("[data-close]")) close(e.target.closest("dialog"));
    else if (e.target.tagName === "DIALOG") close(e.target);
    const g = e.target.closest("[data-go]");
    if (g) { e.preventDefault(); goHome(); }
  });
  $$("dialog").forEach(d => {
    d.addEventListener("cancel", e => { e.preventDefault(); close(d); });
    d.addEventListener("close", () => lastTrigger && lastTrigger.isConnected && !lastTrigger.hidden && lastTrigger.focus());
  });

  /* ---------- transição entre páginas ---------- */
  const show = id => {
    const next = $("#view-" + id), cur = $(".view.is-active");
    if (cur === next) return;
    const swap = () => {
      cur && cur.classList.remove("is-active", "leaving");
      next.classList.add("is-active");
      window.scrollTo({ top: 0 });
      const h = $("h1", next); h && (h.tabIndex = -1, h.focus({ preventScroll: true }));
    };
    if (cur && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cur.classList.add("leaving"); setTimeout(swap, 240);
    } else swap();
  };
  const goHome = () => { const u = me(); show(u ? (u.pro ? "pro" : "elder") : "home"); };

  /* ---------- sessão / interface ---------- */
  const sync = () => {
    const u = me(); setTimeout(() => window.paintProgress && window.paintProgress(), 0);
    $("#btn-enter-top").hidden = !!u;
    $("#btn-profile").hidden = $("#btn-logout").hidden = !u;
    $$(".user-name").forEach(n => (n.textContent = u ? u.nome.split(" ")[0] : ""));
    goHome();
  };

  /* ---------- validação ---------- */
  const fail = (form, msg, field) => {
    $(".err", form).textContent = msg;
    $$("input", form).forEach(i => i.removeAttribute("aria-invalid"));
    if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
    return false;
  };
  const check = (form, req) => {
    for (const n of req) {
      const f = form.elements[n];
      if (!f.value.trim()) return fail(form, "Preencha o campo: " + f.parentElement.firstChild.textContent.trim() + ".", f);
    }
    const t = form.elements.tel; if (t && digits(t.value).length < 10) return fail(form, "Informe um telefone com DDD.", t);
    const s = form.elements.senha; if (s && s.value && s.value.length < 6) return fail(form, "A senha precisa ter 6 caracteres ou mais.", s);
    return true;
  };

  /* ---------- cadastro ---------- */
  $("#toggle-pro").addEventListener("click", e => {
    isPro = !isPro;
    e.target.setAttribute("aria-pressed", isPro);
    e.target.textContent = isPro ? "Entre como idoso" : "Entre como profissional de saúde";
    $$("#f-signup .pro-only").forEach(x => (x.hidden = !isPro));
    $("#t-signup").textContent = isPro ? "Cadastro profissional" : "Cadastre-se";
  });
  $("#f-signup").addEventListener("submit", e => {
    e.preventDefault(); const f = e.target;
    if (!check(f, isPro ? ["nome", "email", "tel", "senha", "crefito"] : ["nome", "tel", "senha"])) return;
    const tel = digits(f.tel.value);
    if (store.users.some(u => u.tel === tel)) return fail(f, "Este telefone já tem cadastro. Use Entrar.", f.tel);
    store.users = [...store.users, { nome: f.nome.value.trim(), tel, senha: f.senha.value, pro: isPro, email: f.email.value, crefito: f.crefito.value, titulo: "", resumo: "" }];
    store.session = tel; f.reset(); close($("#dlg-signup")); sync(); toast("Cadastro feito. Bem-vindo!");
  });

  /* ---------- login / senha ---------- */
  $("#f-login").addEventListener("submit", e => {
    e.preventDefault(); const f = e.target;
    if (!check(f, ["tel", "senha"])) return;
    const u = store.users.find(x => x.tel === digits(f.tel.value) && x.senha === f.senha.value);
    if (!u) return fail(f, "Telefone ou senha incorretos.", f.senha);
    store.session = u.tel; f.reset(); close($("#dlg-login")); sync(); toast("Você entrou.");
  });
  $("#f-reset").addEventListener("submit", e => {
    e.preventDefault(); const f = e.target;
    if (!check(f, ["tel", "senha"])) return;
    const list = store.users, u = list.find(x => x.tel === digits(f.tel.value));
    if (!u) return fail(f, "Não encontramos esse telefone.", f.tel);
    u.senha = f.senha.value; store.users = list; f.reset(); close($("#dlg-reset")); toast("Senha alterada. Agora é só entrar.");
    setTimeout(() => open("login"), 300);
  });
  $("#btn-logout").addEventListener("click", () => { store.session = null; sync(); toast("Você saiu."); });

  /* ---------- perfil (pop-up) ---------- */
  function fillProfile() {
    const u = me(), f = $("#f-profile"); if (!u) return;
    $("#t-profile").textContent = u.pro ? "Perfil do Profissional" : "Perfil do Idoso";
    $$(".pro-only", f).forEach(x => (x.hidden = !u.pro));
    $$(".elder-only", f).forEach(x => (x.hidden = u.pro));
    ["nome", "titulo", "resumo"].forEach(k => (f[k].value = u[k] || ""));
    f.tel.value = u.tel; f.senha.value = "";
  }
  $("#f-profile").addEventListener("submit", e => {
    e.preventDefault(); const f = e.target;
    if (!check(f, ["nome", "tel"])) return;
    const list = store.users, u = list.find(x => x.tel === store.session), tel = digits(f.tel.value);
    if (tel !== u.tel && list.some(x => x.tel === tel)) return fail(f, "Este telefone já está em uso.", f.tel);
    Object.assign(u, { nome: f.nome.value.trim(), tel, titulo: f.titulo.value, resumo: f.resumo.value });
    if (f.senha.value) u.senha = f.senha.value;
    store.users = list; store.session = tel; close($("#dlg-profile")); sync(); toast("Perfil atualizado.");
  });

  /* ---------- conteúdo das áreas ---------- */
  const mk = (sel, items, fn) => ($(sel).innerHTML = items.map((x, i) => `<li class="${fn.c}" style="animation-delay:${i * 70}ms">${fn(x, i)}</li>`).join(""));
  const lesson = (t, i) => `<button type="button" data-i="${i}" aria-label="Reproduzir aula: ${t}"></button><span>${t}</span>`; lesson.c = "lesson";
  const tile = t => t; tile.c = "tile";
  const LESSONS = ["Alongamento diário", "Equilíbrio em pé", "Fortalecimento", "Respiração"];
  mk("#lessons", LESSONS, lesson);
  mk("#boards", ["Aula 1", "Aula 2", "Aula 3", "Aula 4"], lesson);
  mk("#tiles", ["Yoga suave", "Postura", "Em dupla", "Mobilidade", "Relaxamento"], tile);
  $("#file-up").addEventListener("change", e => {
    const ul = $("#published");
    [...e.target.files].forEach(f => ul.insertAdjacentHTML("beforeend", `<li>✔ ${f.name.replace(/</g, "&lt;")}</li>`));
    toast("Atividades adicionadas."); e.target.value = "";
  });

  /* ---------- aulas e avaliação ---------- */
  const key = k => `c60_${k}_${store.session}`;
  const watched = () => { try { return JSON.parse(localStorage.getItem(key("watched"))) || []; } catch { return []; } };
  const proName = () => (store.users.find(u => u.pro) || {}).nome || "Fisioterapeuta Conect60+";
  let current = 0;

  window.paintProgress = paintProgress;
  function paintProgress() {
    if (!me() || me().pro) return;
    const w = watched();
    $$("#lessons .lesson").forEach((li, i) => li.classList.toggle("done", w.includes(i)));
    $("#progress").textContent = `${w.length} de ${LESSONS.length} aulas concluídas`;
    $("#btn-rate").hidden = !(w.length === LESSONS.length && localStorage.getItem(key("eval")) !== "done");
  }
  $("#lessons").addEventListener("click", e => {
    const b = e.target.closest("button[data-i]"); if (!b) return;
    lastTrigger = b; current = +b.dataset.i;
    const v = $("#player"); $("#t-player").textContent = LESSONS[current];
    v.src = `videos/aula${current + 1}.mp4`; // coloque seus vídeos na pasta videos/
    $("#player-hint").textContent = "";
    $("#dlg-player").showModal(); v.focus();
  });
  $("#player").addEventListener("error", () => ($("#player-hint").textContent = `Vídeo não encontrado (videos/aula${current + 1}.mp4). Você ainda pode usar "Concluir aula".`));
  $("#player").addEventListener("ended", () => finishLesson());
  $("#dlg-player").addEventListener("close", () => { $("#player").pause(); $("#player").removeAttribute("src"); });
  $("#btn-finish").addEventListener("click", finishLesson);

  function finishLesson() {
    const w = watched(); if (!w.includes(current)) w.push(current);
    localStorage.setItem(key("watched"), JSON.stringify(w));
    close($("#dlg-player")); paintProgress();
    toast(`Aula concluída: ${LESSONS[current]}`);
    if (w.length === LESSONS.length && localStorage.getItem(key("eval")) !== "done") setTimeout(() => open("rate"), 450);
  }

  const rateForm = $("#f-rate"), saveBtn = $("#btn-save");
  const rateText = () => "Como foi a sua experiência com este fisioterapeuta? As opções são: Não gostei, Neutro, Gostei e Ótimo.";
  $("#dlg-rate").addEventListener("close", () => { speechSynthesis && speechSynthesis.cancel(); });
  rateForm.addEventListener("change", () => (saveBtn.disabled = !rateForm.nota.value));
  $("#btn-listen").addEventListener("click", () => {
    if (!("speechSynthesis" in window)) return toast("Seu navegador não tem leitura em voz alta.");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(rateText()); u.lang = "pt-BR"; u.rate = .9; speechSynthesis.speak(u);
  });
  rateForm.addEventListener("submit", e => {
    e.preventDefault(); if (!rateForm.nota.value) return;
    let all = []; try { all = JSON.parse(localStorage.getItem("c60_ratings")) || []; } catch {}
    all.push({ aluno: store.session, profissional: proName(), nota: +rateForm.nota.value, em: new Date().toISOString() });
    localStorage.setItem("c60_ratings", JSON.stringify(all));
    localStorage.setItem(key("eval"), "done");
    rateForm.reset(); saveBtn.disabled = true; close($("#dlg-rate")); paintProgress(); toast("Obrigado pela sua avaliação!");
  });
  // preenche nome e reinicia o formulário sempre que a avaliação abrir
  new MutationObserver(() => { if ($("#dlg-rate").open) { $("#rate-pro").textContent = proName(); rateForm.reset(); saveBtn.disabled = true; } })
    .observe($("#dlg-rate"), { attributes: true, attributeFilter: ["open"] });
  document.addEventListener("click", e => { if (e.target.closest("[data-go],#btn-logout,#f-login button[type=submit]")) setTimeout(paintProgress, 700); });

  paintProgress();
  sync();
})();