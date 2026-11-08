// ===== إعدادات =====
const API = "https://alalam-phone1-0-ftc9.onrender.com";
const TOKEN_KEY = "alalam_token";

const $ = (id) => document.getElementById(id);
let token = localStorage.getItem(TOKEN_KEY) || "";
let cardTypes = [];

// ===== الاتصال بالسيرفر =====
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch (e) { /* ردّ فارغ */ }
  if (res.status === 401 && path !== "/api/login") {
    logout(true);
    throw new Error("انتهت الجلسة، سجّل الدخول من جديد");
  }
  if (!res.ok) throw new Error(data.error || "حدث خطأ، حاول مرة أخرى");
  return data;
}

// ===== أدوات مساعدة =====
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2600);
}

const fmt = (n) => Number(n || 0).toLocaleString("en-US");

function animateNumber(el, target) {
  const start = parseFloat(el.dataset.value || "0") || 0;
  el.dataset.value = target;
  const steps = 24;
  let i = 0;
  const timer = setInterval(() => {
    i++;
    el.textContent = fmt(Math.round(start + ((target - start) * i) / steps));
    if (i >= steps) clearInterval(timer);
  }, 22);
}

function greet() {
  const h = new Date().getHours();
  $("greeting").textContent = h < 12 ? "صباح الخير" : h < 18 ? "مساء الخير" : "مساء النور";
}

// ===== التنقل بين الصفحات =====
function go(view) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === view));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.go === view));
  if (view === "home") loadHome();
  if (view === "cards") loadCards();
  if (view === "sell") loadSellForm();
  if (view === "sales") loadSales();
  if (view === "products") loadProducts();
  if (view === "customers") loadCustomers();
  if (view === "debts") loadDebts();
  if (view === "expenses") loadExpenses();
  if (view === "reports") loadReport();
}

document.querySelectorAll("[data-go]").forEach((el) => {
  el.addEventListener("click", () => go(el.dataset.go));
});

// ===== الرئيسية =====
async function loadHome() {
  try {
    const r = await api("/api/reports/summary");
    animateNumber($("today-total"), r.sales.total);
    animateNumber($("today-count"), r.sales.count);
    animateNumber($("today-paid"), r.sales.paid);
    animateNumber($("debts-rec"), r.debts.receivable);
    animateNumber($("debts-pay"), r.debts.payable);
  } catch (e) {
    toast(e.message);
  }
}

// ===== الفئات =====
async function loadCards() {
  try {
    cardTypes = await api("/api/cards");
    const list = $("card-list");
    list.innerHTML = "";
    if (!cardTypes.length) list.innerHTML = '<p class="empty">لا توجد فئات بعد</p>';
    cardTypes.forEach((c, i) => {
      const el = document.createElement("div");
      el.className = "item";
      el.style.animationDelay = `${i * 50}ms`;
      el.innerHTML = `
        <div>
          <div class="title"></div>
          <div class="sub"></div>
        </div>
        <div class="amount"></div>`;
      el.querySelector(".title").textContent = c.name;
      el.querySelector(".sub").textContent = `القيمة ${fmt(c.face_value)}`;
      el.querySelector(".amount").textContent = `${fmt(c.default_price)} ريال`;
      el.onclick = () => editPrice(c);
      list.appendChild(el);
    });
  } catch (e) {
    toast(e.message);
  }
}

async function editPrice(card) {
  const value = prompt(`سعر ${card.name} الجديد:`, card.default_price);
  if (value === null || value.trim() === "") return;
  try {
    await api(`/api/cards/${card.id}`, { method: "PATCH", body: JSON.stringify({ default_price: Number(value) }) });
    toast("تم تحديث السعر");
    loadCards();
  } catch (e) {
    toast(e.message);
  }
}

$("card-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/cards", {
      method: "POST",
      body: JSON.stringify({
        name: $("card-name").value.trim(),
        face_value: Number($("card-face").value),
        default_price: Number($("card-price").value)
      })
    });
    e.target.reset();
    toast("تمت إضافة الفئة");
    loadCards();
  } catch (err) {
    toast(err.message);
  }
});

// ===== البيع (فواتير متعددة الفئات) =====
let lines = [];

async function loadSellForm() {
  try {
    cardTypes = await api("/api/cards");
    const sel = $("sell-type");
    sel.innerHTML = "";
    cardTypes.forEach((c) => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = `${c.name} — ${fmt(c.default_price)} ريال`;
      sel.appendChild(o);
    });
    fillPriceFromType();
    fillCalcTypes();
    renderLines();
  } catch (e) {
    toast(e.message);
  }
}

function fillPriceFromType() {
  const c = cardTypes.find((x) => String(x.id) === $("sell-type").value);
  if (c) $("sell-price").value = c.default_price;
}

function lineTotal() {
  return lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
}

function renderLines() {
  const box = $("sell-lines");
  box.innerHTML = "";
  lines.forEach((l, i) => {
    const el = document.createElement("div");
    el.className = "line-item";
    el.innerHTML = `<div><div class="lt"></div><div class="ls"></div></div><div class="lp"></div>`;
    el.querySelector(".lt").textContent = l.name;
    el.querySelector(".ls").textContent = `${l.quantity} × ${fmt(l.unit_price)} ريال`;
    el.querySelector(".lp").textContent = `${fmt(l.quantity * l.unit_price)} ريال`;
    const del = document.createElement("button");
    del.className = "mini-btn danger";
    del.textContent = "حذف";
    del.onclick = () => { lines.splice(i, 1); renderLines(); };
    el.appendChild(del);
    box.appendChild(el);
  });
  $("sell-total").textContent = fmt(lineTotal());
}

$("sell-type").addEventListener("change", fillPriceFromType);

$("sell-add").addEventListener("click", () => {
  const card = cardTypes.find((x) => String(x.id) === $("sell-type").value);
  const quantity = Number($("sell-qty").value);
  const unit_price = Number($("sell-price").value);
  if (!card || !(quantity > 0) || !(unit_price >= 0)) {
    toast("تحقق من الفئة والكمية والسعر");
    return;
  }
  lines.push({ id: card.id, name: card.name, quantity, unit_price });
  $("sell-qty").value = 1;
  fillPriceFromType();
  renderLines();
});

$("sell-submit").addEventListener("click", async () => {
  const err = $("sell-error");
  err.classList.add("hidden");
  if (!lines.length) {
    err.textContent = "أضف فئة واحدة على الأقل للفاتورة";
    err.classList.remove("hidden");
    return;
  }
  try {
    const sale = await api("/api/sales", {
      method: "POST",
      body: JSON.stringify({
        items: lines.map(l => ({ item_type: "card", item_ref: l.id, quantity: l.quantity, unit_price: l.unit_price })),
        paid: Number($("sell-paid").value) || 0,
        customer_name: $("sell-customer").value.trim() || null
      })
    });
    toast(`تم البيع — فاتورة ${sale.invoice_no || ""}`.trim());
    lines = [];
    $("sell-paid").value = 0;
    $("sell-customer").value = "";
    renderLines();
    go("home");
  } catch (e2) {
    err.textContent = e2.message;
    err.classList.remove("hidden");
  }
});

// ===== الفواتير =====
async function loadSales() {
  try {
    const sales = await api("/api/sales");
    const list = $("sales-list");
    list.innerHTML = "";
    if (!sales.length) list.innerHTML = '<p class="empty">لا توجد فواتير بعد</p>';
    sales.slice(0, 80).forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "item";
      el.style.animationDelay = `${i * 30}ms`;
      el.innerHTML = `
        <div>
          <div class="title"></div>
          <div class="sub"></div>
        </div>
        <div style="text-align:left">
          <div class="amount"></div>
          <span class="chip"></span>
        </div>`;
      el.querySelector(".title").textContent = s.customer_name || "زبون نقدي";
      el.querySelector(".sub").textContent = `${s.invoice_no} • ${(s.created_at || "").slice(0, 16)}`;
      el.querySelector(".amount").textContent = `${fmt(s.total)} ريال`;
      const remaining = Number(s.total) - Number(s.paid);
      el.querySelector(".chip").textContent = remaining > 0 ? `متبقي ${fmt(remaining)}` : "مدفوعة";
      el.onclick = () => openInvoice(s.id);
      list.appendChild(el);
    });
  } catch (e) {
    toast(e.message);
  }
}

// ===== الدخول والخروج =====
function showApp() {
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  greet();
  go("home");
}

function showLogin() {
  $("app").classList.add("hidden");
  $("login").classList.remove("hidden");
}

function logout(silent) {
  token = "";
  localStorage.removeItem(TOKEN_KEY);
  if (!silent) toast("تم تسجيل الخروج");
  showLogin();
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("login-error");
  err.classList.add("hidden");
  try {
    const res = await fetch(API + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: $("login-user").value, password: $("login-pass").value })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) throw new Error(data.error || "فشل تسجيل الدخول");
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    $("login-pass").value = "";
    showApp();
  } catch (x) {
    err.textContent = x.message === "Failed to fetch" ? "تعذّر الاتصال بالسيرفر، تحقق من الإنترنت" : x.message;
    err.classList.remove("hidden");
  }
});

$("logout-btn").addEventListener("click", () => {
  fetch(API + "/api/logout", { method: "POST" }).catch(() => {});
  logout(false);
});

// ===== أدوات مشتركة للقوائم =====
function listItem(title, sub, amountText, index) {
  const el = document.createElement("div");
  el.className = "item";
  el.style.animationDelay = `${index * 40}ms`;
  el.innerHTML = `<div><div class="title"></div><div class="sub"></div></div><div class="side"></div>`;
  el.querySelector(".title").textContent = title;
  el.querySelector(".sub").textContent = sub;
  if (amountText !== undefined) {
    const a = document.createElement("div");
    a.className = "amount";
    a.textContent = amountText;
    el.querySelector(".side").appendChild(a);
  }
  return el;
}

function addButton(parent, label, onClick, danger) {
  const b = document.createElement("button");
  b.className = "mini-btn" + (danger ? " danger" : "");
  b.textContent = label;
  b.onclick = (e) => { e.stopPropagation(); onClick(); };
  parent.appendChild(b);
  return b;
}

function emptyState(listEl, count) {
  if (!count) listEl.innerHTML = '<p class="empty">لا توجد بيانات بعد</p>';
}

// ===== المنتجات =====
async function loadProducts() {
  try {
    const items = await api("/api/products");
    const list = $("product-list");
    list.innerHTML = "";
    emptyState(list, items.length);
    items.forEach((p, i) => {
      const el = listItem(p.name, `المخزون ${fmt(p.stock)}${p.sku ? " • " + p.sku : ""}`, `${fmt(p.sell_price)} ريال`, i);
      addButton(el.querySelector(".side"), "حذف", () => deleteProduct(p.id), true);
      list.appendChild(el);
    });
  } catch (e) { toast(e.message); }
}

async function deleteProduct(id) {
  if (!confirm("حذف هذا المنتج؟")) return;
  try {
    await api(`/api/products/${id}`, { method: "DELETE" });
    toast("تم الحذف");
    loadProducts();
  } catch (e) { toast(e.message); }
}

$("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name: $("p-name").value.trim(),
        sku: $("p-sku").value.trim(),
        cost_price: Number($("p-cost").value),
        sell_price: Number($("p-sell").value),
        stock: Number($("p-stock").value)
      })
    });
    e.target.reset();
    toast("تمت إضافة المنتج");
    loadProducts();
  } catch (err) { toast(err.message); }
});

// ===== الزبائن =====
async function loadCustomers() {
  try {
    const items = await api("/api/customers");
    const list = $("customer-list");
    list.innerHTML = "";
    emptyState(list, items.length);
    items.forEach((c, i) => list.appendChild(listItem(c.name, c.phone || "بدون هاتف", undefined, i)));
  } catch (e) { toast(e.message); }
}

$("customer-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/customers", {
      method: "POST",
      body: JSON.stringify({ name: $("c-name").value.trim(), phone: $("c-phone").value.trim() || null })
    });
    e.target.reset();
    toast("تمت إضافة الزبون");
    loadCustomers();
  } catch (err) { toast(err.message); }
});

// ===== الديون =====
let debtDirection = "receivable";

async function loadDebts() {
  try {
    const items = await api(`/api/debts?direction=${debtDirection}&status=open`);
    const list = $("debt-list");
    list.innerHTML = "";
    emptyState(list, items.length);
    items.forEach((d, i) => {
      const el = listItem(d.person_name, `${d.reason} • متبقي ${fmt(d.remaining)} من ${fmt(d.amount)}`, undefined, i);
      addButton(el.querySelector(".side"), "تسديد", () => payDebt(d), false);
      list.appendChild(el);
    });
  } catch (e) { toast(e.message); }
}

async function payDebt(debt) {
  const value = prompt(`مبلغ التسديد (المتبقي ${debt.remaining}):`);
  if (value === null || value.trim() === "") return;
  try {
    await api(`/api/debts/${debt.id}/payments`, { method: "POST", body: JSON.stringify({ amount: Number(value) }) });
    toast("تم تسجيل التسديد");
    loadDebts();
  } catch (e) { toast(e.message); }
}

document.querySelectorAll("[data-dir]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-dir]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    debtDirection = btn.dataset.dir;
    $("d-direction").value = debtDirection;
    loadDebts();
  });
});

$("debt-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/debts", {
      method: "POST",
      body: JSON.stringify({
        person_name: $("d-person").value.trim(),
        reason: $("d-reason").value.trim(),
        amount: Number($("d-amount").value),
        paid_amount: $("d-paid").value || 0,
        direction: $("d-direction").value
      })
    });
    e.target.reset();
    toast("تم تسجيل الدين");
    loadDebts();
  } catch (err) { toast(err.message); }
});

// ===== المصاريف =====
async function loadExpenses() {
  try {
    const items = await api("/api/expenses");
    const list = $("expense-list");
    list.innerHTML = "";
    emptyState(list, items.length);
    items.slice(0, 100).forEach((x, i) => {
      const el = listItem(x.description, `${x.category} • ${(x.created_at || "").slice(0, 16)}`, `${fmt(x.amount)} ريال`, i);
      addButton(el.querySelector(".side"), "حذف", () => deleteExpense(x.id), true);
      list.appendChild(el);
    });
  } catch (e) { toast(e.message); }
}

async function deleteExpense(id) {
  if (!confirm("حذف هذا المصروف؟")) return;
  try {
    await api(`/api/expenses/${id}`, { method: "DELETE" });
    toast("تم الحذف");
    loadExpenses();
  } catch (e) { toast(e.message); }
}

$("expense-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({
        description: $("e-desc").value.trim(),
        amount: Number($("e-amount").value),
        category: $("e-category").value.trim() || "other"
      })
    });
    e.target.reset();
    toast("تمت إضافة المصروف");
    loadExpenses();
  } catch (err) { toast(err.message); }
});

// ===== التقارير =====
function todayISO() {
  return new Date().toLocaleDateString("en-CA");
}

let reportType = "full";
let lastReport = null;

document.querySelectorAll("[data-rtype]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-rtype]").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    reportType = btn.dataset.rtype;
    loadReport();
  });
});

async function loadReport() {
  if (!$("r-from").value) $("r-from").value = todayISO();
  if (!$("r-to").value) $("r-to").value = todayISO();
  try {
    const r = await api(`/api/reports/summary?from=${$("r-from").value}&to=${$("r-to").value}`);
    const all = [
      ["عدد الفواتير", fmt(r.sales.count)],
      ["إجمالي المبيعات", `${fmt(r.sales.total)} ريال`],
      ["المحصّل", `${fmt(r.sales.paid)} ريال`],
      ["مبيعات الكروت", `${fmt(r.sales.cards_total)} ريال`],
      ["مبيعات المنتجات", `${fmt(r.sales.products_total)} ريال`],
      ["ربح المنتجات", `${fmt(r.sales.products_profit)} ريال`],
      ["المصاريف", `${fmt(r.expenses.total)} ريال`],
      ["ذمم لنا (إجمالي)", `${fmt(r.debts.receivable)} ريال`],
      ["ذمم علينا (إجمالي)", `${fmt(r.debts.payable)} ريال`]
    ];
    const pick = {
      full: all,
      cards: all.filter(([k]) => /الكروت|الفواتير|المدفوع|المحصّل|إجمالي المبيعات/.test(k)),
      products: all.filter(([k]) => /المنتجات|المصاريف/.test(k))
    };
    const rows = pick[reportType];
    lastReport = { rows, from: $("r-from").value, to: $("r-to").value, type: reportType };
    const box = $("report-box");
    box.innerHTML = "";
    rows.forEach(([k, v], i) => box.appendChild(listItem(k, "", v, i)));
  } catch (e) { toast(e.message); }
}

$("r-pdf").addEventListener("click", async () => {
  if (!lastReport) await loadReport();
  if (!lastReport) return;
  const names = { full: "تقرير كامل", cards: "تقرير الكروت", products: "تقرير المنتجات" };
  const title = names[lastReport.type];
  try {
    toast("جارٍ تجهيز PDF...");
    const b64 = await htmlToPdfBase64(reportHtml(title, lastReport.from, lastReport.to, lastReport.rows));
    await sharePdf(`report-${lastReport.type}-${lastReport.from}.pdf`, b64, `${title} (${lastReport.from} - ${lastReport.to})`);
  } catch (err) {
    if (err && err.name !== "AbortError") toast("تعذّر تجهيز الملف: " + err.message);
  }
});

$("r-show").addEventListener("click", loadReport);

// ===== بدء التطبيق =====
setTimeout(() => {
  $("splash").style.display = "none";
  if (token) showApp();
  else showLogin();
}, 2800);

// ===== تفاصيل الفاتورة: عرض، تعديل، حذف، مشاركة =====
let currentInvoice = null;

async function openInvoice(id) {
  try {
    currentInvoice = await api(`/api/sales/${id}`);
    renderInvoice();
    $("invoice-modal").classList.remove("hidden");
    $("inv-edit").classList.add("hidden");
    $("inv-body").classList.remove("hidden");
  } catch (e) { toast(e.message); }
}

function invoiceText(inv) {
  const lines = (inv.items || []).map(i => `${i.item_name} × ${i.quantity} = ${fmt(i.line_total)} ريال`);
  return [
    "العالم فون",
    `فاتورة: ${inv.invoice_no}`,
    `الزبون: ${inv.customer_name || "زبون نقدي"}`,
    `التاريخ: ${(inv.created_at || "").slice(0, 16)}`,
    "--------------",
    ...lines,
    "--------------",
    `الإجمالي: ${fmt(inv.total)} ريال`,
    `المدفوع: ${fmt(inv.paid)} ريال`,
    `المتبقي: ${fmt(inv.remaining)} ريال`
  ].join("\n");
}

function renderInvoice() {
  const inv = currentInvoice;
  const body = $("inv-body");
  body.innerHTML = "";
  const head = document.createElement("div");
  head.className = "inv-line";
  head.innerHTML = `<span>رقم الفاتورة</span><b></b>`;
  head.querySelector("b").textContent = inv.invoice_no;
  body.appendChild(head);
  (inv.items || []).forEach(i => {
    const row = document.createElement("div");
    row.className = "inv-line";
    row.innerHTML = `<span></span><b></b>`;
    row.querySelector("span").textContent = `${i.item_name} × ${i.quantity}`;
    row.querySelector("b").textContent = `${fmt(i.line_total)} ريال`;
    body.appendChild(row);
  });
  [["الزبون", inv.customer_name || "زبون نقدي"], ["الإجمالي", `${fmt(inv.total)} ريال`], ["المدفوع", `${fmt(inv.paid)} ريال`], ["المتبقي", `${fmt(inv.remaining)} ريال`]]
    .forEach(([k, v]) => {
      const row = document.createElement("div");
      row.className = "inv-line";
      row.innerHTML = `<span></span><b></b>`;
      row.querySelector("span").textContent = k;
      row.querySelector("b").textContent = v;
      body.appendChild(row);
    });
}

$("inv-close").addEventListener("click", () => $("invoice-modal").classList.add("hidden"));

$("inv-edit-btn").addEventListener("click", () => {
  $("inv-customer").value = currentInvoice.customer_name || "";
  $("inv-paid").value = currentInvoice.paid;
  $("inv-notes").value = currentInvoice.notes || "";
  $("inv-body").classList.add("hidden");
  $("inv-edit").classList.remove("hidden");
});

$("inv-edit").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    currentInvoice = await api(`/api/sales/${currentInvoice.id}`, {
      method: "PUT",
      body: JSON.stringify({
        customer_name: $("inv-customer").value.trim(),
        paid: Number($("inv-paid").value),
        notes: $("inv-notes").value.trim()
      })
    });
    toast("تم حفظ التعديل");
    renderInvoice();
    $("inv-edit").classList.add("hidden");
    $("inv-body").classList.remove("hidden");
    loadSales();
  } catch (err) { toast(err.message); }
});

$("inv-delete").addEventListener("click", async () => {
  if (!confirm("هل تريد حذف هذه الفاتورة نهائياً؟")) return;
  try {
    await api(`/api/sales/${currentInvoice.id}`, { method: "DELETE" });
    $("invoice-modal").classList.add("hidden");
    toast("تم حذف الفاتورة");
    loadSales();
  } catch (err) { toast(err.message); }
});

$("inv-share").addEventListener("click", async () => {
  try {
    toast("جارٍ تجهيز الملف...");
    const b64 = await htmlToPdfBase64(invoiceHtml(currentInvoice));
    await sharePdf(`invoice-${currentInvoice.invoice_no}.pdf`, b64, `فاتورة ${currentInvoice.invoice_no}`);
  } catch (err) {
    if (err && err.name !== "AbortError") toast("تعذّر تجهيز الملف: " + err.message);
  }
});

// ===== حاسبة الكروت =====
function fillCalcTypes() {
  const sel = $("calc-type");
  sel.innerHTML = "";
  cardTypes.forEach((c) => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = `${c.name} — ${fmt(c.default_price)} ريال`;
    sel.appendChild(o);
  });
}

function runCalc() {
  const amount = Number($("calc-amount").value);
  const card = cardTypes.find((x) => String(x.id) === $("calc-type").value);
  const box = $("calc-result");
  if (!card || !(amount > 0)) {
    box.innerHTML = "";
    box.classList.add("hidden");
    toast("اكتب المبلغ واختر الفئة");
    return;
  }
  const price = Number(card.default_price);
  if (!(price > 0)) {
    box.innerHTML = `<p class="warn">سعر فئة ${card.name} غير محدد، حدده من صفحة الفئات أولاً</p>`;
    box.classList.remove("hidden");
    return;
  }
  const count = Math.floor(amount / price);
  const used = count * price;
  const leftover = amount - used;
  box.innerHTML = `
    <div class="big-count">${fmt(count)} كرت</div>
    <div class="line"><span>الفئة</span><b></b></div>
    <div class="line"><span>سعر الكرت</span><b>${fmt(price)} ريال</b></div>
    <div class="line"><span>الإجمالي</span><b>${fmt(used)} ريال</b></div>
    ${leftover > 0 ? `<div class="line"><span>الباقي من المبلغ</span><b>${fmt(leftover)} ريال</b></div>` : ""}
    <button type="button" class="mini-btn" id="calc-add">إضافة ${fmt(count)} كرت للفاتورة</button>`;
  box.querySelector(".line b").textContent = card.name;
  box.classList.remove("hidden");
  $("calc-add").onclick = () => {
    if (count <= 0) { toast("المبلغ أقل من سعر كرت واحد"); return; }
    lines.push({ id: card.id, name: card.name, quantity: count, unit_price: price });
    renderLines();
    toast(`أُضيف ${fmt(count)} كرت للفاتورة`);
  };
}

$("calc-run").addEventListener("click", runCalc);
