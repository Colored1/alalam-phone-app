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

// ===== البيع =====
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
  } catch (e) {
    toast(e.message);
  }
}

function fillPriceFromType() {
  const c = cardTypes.find((x) => String(x.id) === $("sell-type").value);
  if (c) $("sell-price").value = c.default_price;
  updateTotal();
}

function updateTotal() {
  const total = (Number($("sell-qty").value) || 0) * (Number($("sell-price").value) || 0);
  const el = $("sell-total");
  el.textContent = fmt(total);
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
  setTimeout(() => el.classList.remove("bump"), 200);
  return total;
}

$("sell-type").addEventListener("change", fillPriceFromType);
["sell-qty", "sell-price"].forEach((id) => $(id).addEventListener("input", updateTotal));

$("sell-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const total = updateTotal();
  const paid = Number($("sell-paid").value) || 0;
  const err = $("sell-error");
  err.classList.add("hidden");
  try {
    const sale = await api("/api/sales", {
      method: "POST",
      body: JSON.stringify({
        items: [{
          item_type: "card",
          item_ref: Number($("sell-type").value),
          quantity: Number($("sell-qty").value),
          unit_price: Number($("sell-price").value)
        }],
        paid,
        customer_name: $("sell-customer").value.trim() || null
      })
    });
    toast(`تم البيع — فاتورة ${sale.invoice_no || ""}`.trim());
    $("sell-qty").value = 1;
    $("sell-paid").value = 0;
    $("sell-customer").value = "";
    updateTotal();
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

async function loadReport() {
  if (!$("r-from").value) $("r-from").value = todayISO();
  if (!$("r-to").value) $("r-to").value = todayISO();
  try {
    const r = await api(`/api/reports/summary?from=${$("r-from").value}&to=${$("r-to").value}`);
    const rows = [
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
    const box = $("report-box");
    box.innerHTML = "";
    rows.forEach(([k, v], i) => box.appendChild(listItem(k, "", v, i)));
  } catch (e) { toast(e.message); }
}

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
  const text = invoiceText(currentInvoice);
  try {
    if (navigator.share) {
      await navigator.share({ title: currentInvoice.invoice_no, text });
    } else {
      await navigator.clipboard.writeText(text);
      toast("تم نسخ تفاصيل الفاتورة");
    }
  } catch (err) {
    if (err && err.name !== "AbortError") toast("تعذّرت المشاركة");
  }
});
