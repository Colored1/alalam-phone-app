// ===== توليد ملفات PDF ومشاركتها =====
const Cap = window.Capacitor;

function esc(t) {
  return String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// يبني صفحة عربية داخل الصفحة، ثم يحوّلها إلى PDF (النص يظهر كما هو بالعربية)
async function htmlToPdfBase64(innerHtml) {
  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;color:#1a1307;direction:rtl;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;padding:36px;";
  stage.innerHTML = innerHtml;
  document.body.appendChild(stage);
  try {
    const canvas = await html2canvas(stage, { scale: 2, backgroundColor: "#ffffff" });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let y = 0;
    const img = canvas.toDataURL("image/jpeg", 0.92);
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, -y, imgW, imgH);
      y += pageH;
    }
    return pdf.output("datauristring").split(",")[1];
  } finally {
    stage.remove();
  }
}

// يحفظ الملف ويفتح قائمة المشاركة (واتساب، تيليجرام، ...)
async function sharePdf(fileName, base64, title) {
  if (Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.Plugins.Filesystem && Cap.Plugins.Share) {
    const saved = await Cap.Plugins.Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: "CACHE",
      recursive: true
    });
    await Cap.Plugins.Share.share({ title, text: title, files: [saved.uri], dialogTitle: "مشاركة الملف" });
    return;
  }
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const file = new File([bytes], fileName, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function invoiceHtml(inv) {
  const rows = (inv.items || []).map(i => `
    <tr><td>${esc(i.item_name)}</td><td>${esc(i.quantity)}</td><td>${esc(fmt(i.unit_price))}</td><td>${esc(fmt(i.line_total))}</td></tr>`).join("");
  return `
    <div style="text-align:center;margin-bottom:18px">
      <h1 style="font-size:28px;margin:0;color:#8a6a3a">العالم فون</h1>
      <p style="margin:4px 0;color:#555">مركز وشبكة العالم فون</p>
    </div>
    <h2 style="font-size:20px;margin:10px 0">فاتورة ${esc(inv.invoice_no)}</h2>
    <p>الزبون: ${esc(inv.customer_name || "زبون نقدي")}</p>
    <p>التاريخ: ${esc((inv.created_at || "").slice(0, 16))}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px" border="1" cellpadding="8">
      <thead style="background:#f3ead6"><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:16px;font-size:16px">
      <p>الإجمالي: <b>${esc(fmt(inv.total))} ريال</b></p>
      <p>المدفوع: <b>${esc(fmt(inv.paid))} ريال</b></p>
      <p>المتبقي: <b>${esc(fmt(inv.remaining))} ريال</b></p>
    </div>`;
}

function reportHtml(title, from, to, rows) {
  const body = rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
  return `
    <div style="text-align:center;margin-bottom:18px">
      <h1 style="font-size:28px;margin:0;color:#8a6a3a">العالم فون</h1>
      <p style="margin:4px 0;color:#555">مركز وشبكة العالم فون</p>
    </div>
    <h2 style="font-size:20px;margin:10px 0">${esc(title)}</h2>
    <p>الفترة: من ${esc(from)} إلى ${esc(to)}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px" border="1" cellpadding="10">
      <thead style="background:#f3ead6"><tr><th>البند</th><th>القيمة</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}
