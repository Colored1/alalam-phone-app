// ===== قاعدة البيانات المحلية (داخل الجهاز) =====
const DB_KEY = "alalam_cards_v2";

function loadCards() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCards(cards) {
  localStorage.setItem(DB_KEY, JSON.stringify(cards));
}

let cards = loadCards();
let currentFilter = "all";

// ===== عناصر الواجهة =====
const listEl = document.getElementById("card-list");
const emptyEl = document.getElementById("empty");
const form = document.getElementById("add-form");
const codeInput = document.getElementById("card-code");
const priceInput = document.getElementById("card-price");

// ===== الإحصائيات =====
function updateStats() {
  const total = cards.length;
  const sold = cards.filter(c => c.sold).length;
  animateNumber("stat-total", total);
  animateNumber("stat-sold", sold);
  animateNumber("stat-left", total - sold);
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent, 10) || 0;
  const steps = 20;
  let i = 0;
  const timer = setInterval(() => {
    i++;
    el.textContent = Math.round(start + ((target - start) * i) / steps);
    if (i >= steps) clearInterval(timer);
  }, 25);
}

// ===== عرض القائمة =====
function render() {
  const visible = cards.filter(c => {
    if (currentFilter === "sold") return c.sold;
    if (currentFilter === "available") return !c.sold;
    return true;
  });

  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", visible.length > 0);

  visible.forEach((card, index) => {
    const li = document.createElement("li");
    li.className = "card-item";
    li.style.animationDelay = `${index * 40}ms`;
    li.innerHTML = `
      <div>
        <div class="code"></div>
        <div class="price"></div>
      </div>
      <div class="actions"></div>
    `;
    li.querySelector(".code").textContent = card.code;
    li.querySelector(".price").textContent = `${card.price} ريال`;

    const right = li.querySelector(".actions");
    const badge = document.createElement("span");
    badge.className = `badge ${card.sold ? "sold" : "available"}`;
    badge.textContent = card.sold ? "مباعة" : "متاحة";
    right.appendChild(badge);

    const toggle = document.createElement("button");
    toggle.className = "item-btn";
    toggle.style.marginInlineStart = "8px";
    toggle.textContent = card.sold ? "استرجاع" : "بيع";
    toggle.onclick = () => toggleSold(card.id);
    right.appendChild(toggle);

    const del = document.createElement("button");
    del.className = "item-btn";
    del.style.marginInlineStart = "6px";
    del.textContent = "حذف";
    del.onclick = () => removeCard(card.id);
    right.appendChild(del);

    listEl.appendChild(li);
  });

  updateStats();
}

// ===== العمليات =====
function toggleSold(id) {
  cards = cards.map(c => (c.id === id ? { ...c, sold: !c.sold } : c));
  saveCards(cards);
  render();
}

function removeCard(id) {
  if (!confirm("هل تريد حذف هذا الكرت؟")) return;
  cards = cards.filter(c => c.id !== id);
  saveCards(cards);
  render();
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const code = codeInput.value.trim();
  const price = Number(priceInput.value);
  if (!code) return;

  cards.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    code,
    price,
    sold: false,
    createdAt: new Date().toISOString()
  });
  saveCards(cards);
  codeInput.value = "";
  priceInput.value = "";
  codeInput.focus();
  render();
});

document.querySelectorAll(".chip").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    render();
  });
});

// ===== بدء التطبيق بعد شاشة البداية =====
setTimeout(() => {
  document.getElementById("app").classList.remove("hidden");
  render();
}, 2600);
