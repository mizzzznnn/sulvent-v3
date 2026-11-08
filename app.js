import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

const demoEvents = [
  { id: "demo-1", name: "Jakarta Creative Forum 2026", event_date: "2026-11-08", venue: "The Ritz-Carlton Jakarta", status: "Live now" },
  { id: "demo-2", name: "SULVENT Partner Summit", event_date: "2026-11-16", venue: "The Westin Jakarta", status: "Planning" },
  { id: "demo-3", name: "Year End Soirée", event_date: "2026-12-18", venue: "Hutan Plataran", status: "Draft" }
];
const demoAttendees = [
  ["Aulia Pratama","Studio Harsa","AP"],["Citra Maheswari","PT Lentera Kreasi","CM"],
  ["Kevin Rachman","Sora Collective","KR"],["Nadya Putri","Gather & Co.","NP"],["Rizky Aditya","Daya Studio","RA"]
];
const demoTeam = [
  ["Dimas Prakoso","Event Director","DP"],["Salsa Amani","Operations Lead","SA"],
  ["Rafi Kurniawan","Creative Lead","RK"],["Ayu Wulandari","Registration","AW"],
  ["Bima Arsa","Partnerships","BA"],["Nina Lestari","Social Media","NL"]
];
const modules = {
  tenants: ["TENANT & VENUE","Tenant & venue","Kelola penyewa, ruang, kontrak, dan kesiapan venue.",["Active tenants|18|3 check-in hari ini","Venue occupancy|76%|12 ruang terpakai","Contract value|Rp 148 jt|Bulan ini"],["Majelis Ilmu Nusantara|Grand Ballroom|Confirmed","Baitulmaal Forum|Garden Terrace|Pending","Karsa Foundation|Auditorium A|Confirmed"]],
  sponsors: ["PARTNERSHIP","Sponsors","Pantau pipeline sponsorship, benefit, kontrak, dan aktivasi brand mitra.",["Committed|Rp 225 jt|75% dari target","Active sponsors|12|3 menunggu kontrak","Deliverables|34 / 42|8 perlu ditinjau"],["Bank Syariah Indonesia|Title Partner|Active","Wardah|Gold Partner|Active","Telkom Indonesia|Silver Partner|Negotiation"]],
  finance: ["FINANCIAL CONTROL","Finance","Arus kas event, anggaran, invoice, dan pengeluaran secara transparan.",["Budget used|Rp 86.4 jt|68% dari budget","Outstanding invoice|Rp 24.5 jt|6 invoice terbuka","Net position|Rp 39.8 jt|Positif bulan ini"],["Invoice #INV-2026-101|PT Lentera Kreasi|Paid","Vendor Catering|Culinary Satu|Approval","Invoice #INV-2026-108|Baitulmaal Forum|Due soon"]],
  donations: ["SOCIAL IMPACT","Donations","Kelola kampanye donasi, transparansi dana, dan laporan dampak.",["Collected|Rp 64.8 jt|81% dari target","Donors|426|+62 minggu ini","Disbursed|Rp 42.1 jt|65% tersalurkan"],["Beasiswa Santri Digital|Rp 28.4 jt|Active","Wakaf Ruang Belajar|Rp 21.6 jt|Active","Bantuan Kemanusiaan|Rp 14.8 jt|Closing soon"]],
  marketing: ["GROWTH & OUTREACH","Marketing","Rencanakan kampanye dan pantau konversi audiens secara terpadu.",["Campaign reach|128.4k|+18% minggu ini","Registrations|1,248|32% dari social","Email open rate|48.6%|Di atas benchmark"],["Ramadan Impact Series|Instagram & TikTok|Live","Early Bird JCF 2026|Email automation|Live","Partner newsletter|Email|Scheduled"]],
  logistics: ["EVENT OPERATIONS","Logistics","Kendalikan inventory, vendor, pengiriman, dan checklist hari-H.",["Operational readiness|82%|9 tugas terbuka","Inventory items|186|174 terverifikasi","Vendor status|14 / 16|2 perlu follow-up"],["LED & sound system|PT Nada Visual|Ready","F&B lunch service|Culinary Satu|In progress","Wayfinding signage|Cetak Cepat|Delivery today"]]
};
const moduleConfig = {
  tenants: { table: "tenants", primary: "name", secondary: "space_name", primaryLabel: "Nama tenant", secondaryLabel: "Ruang / booth", statuses: ["lead","pending","confirmed","cancelled"] },
  sponsors: { table: "sponsors", primary: "name", secondary: "tier", primaryLabel: "Nama sponsor", secondaryLabel: "Tingkatan sponsor", statuses: ["lead","negotiation","active","completed","lost"] },
  finance: { table: "finance_entries", primary: "title", secondary: "entry_type", primaryLabel: "Judul transaksi", secondaryLabel: "Jenis transaksi", statuses: ["draft","pending","paid","void"], amount: true },
  donations: { table: "donation_campaigns", primary: "title", secondary: "target_amount", primaryLabel: "Nama kampanye", secondaryLabel: "Target donasi (Rp)", statuses: ["draft","active","paused","closed"], amount: true },
  marketing: { table: "marketing_campaigns", primary: "name", secondary: "channel", primaryLabel: "Nama kampanye", secondaryLabel: "Channel", statuses: ["draft","scheduled","live","completed","paused"] },
  logistics: { table: "logistics_items", primary: "name", secondary: "vendor", primaryLabel: "Nama item", secondaryLabel: "Vendor", statuses: ["planned","ordered","in_progress","ready","delivered","cancelled"] }
};
const moduleRows = {};

let supabase = null;
let session = null;
let activeOrg = null;
let events = [...demoEvents];
let demoMode = true;
let attendees = [...demoAttendees];
let team = [...demoTeam];
let activePeopleType = null;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}
function setBackendBadge(text, isLive = false) {
  let badge = $("#backendBadge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "backendBadge";
    badge.className = "backend-badge";
    document.body.appendChild(badge);
  }
  badge.textContent = text;
  badge.classList.toggle("connected", isLive);
}
function renderEvents() {
  const target = $("#eventList");
  target.innerHTML = events.map((event) => {
    const date = new Date(`${event.event_date}T12:00:00`);
    const day = date.toLocaleDateString("id-ID", { day: "2-digit" });
    const month = date.toLocaleDateString("id-ID", { month: "short" }).toUpperCase();
    return `<article class="event-card">
      <div class="event-date">${escapeHTML(month)}<b>${escapeHTML(day)}</b></div>
      <div><h3>${escapeHTML(event.name)}</h3><p>${escapeHTML(event.venue || "Venue belum ditentukan")}</p></div>
      <span class="tag">${escapeHTML(event.status || "Planning")}</span>
    </article>`;
  }).join("") || `<div class="panel"><p>Belum ada event. Buat event pertama untuk workspace ini.</p></div>`;
}
function renderCalendar() {
  const days = Array.from({ length: 30 }, (_, index) => index + 1);
  $("#calendarBox").innerHTML = days.map((day) => {
    const match = events.find((event) => new Date(`${event.event_date}T12:00:00`).getDate() === day);
    return `<div class="cal-day ${match ? "event" : ""}">${day}${match ? `<b>${escapeHTML(match.name)}</b>` : ""}</div>`;
  }).join("");
}
function renderPeople() {
  $("#attendeeList").innerHTML = attendees.map((person, index) => {
    const name = Array.isArray(person) ? person[0] : person.full_name;
    const company = Array.isArray(person) ? person[1] : person.organization_name;
    const initials = Array.isArray(person) ? person[2] : name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");
    const status = Array.isArray(person) ? (index < 3 ? "Checked in" : "Registered") : person.status;
    return `<div class="attendee"><div class="avatar">${escapeHTML(initials)}</div><div><strong>${escapeHTML(name)}</strong><p>${escapeHTML(company || "—")}</p></div><span class="status">${escapeHTML(status || "registered")}</span></div>`;
  }).join("") || `<div class="attendee"><p>Belum ada peserta. Tambahkan peserta pertama.</p></div>`;
  $("#attendeeCount").textContent = `${attendees.length} registered`;
  $("#attendeeMetric").textContent = attendees.length.toLocaleString("id-ID");
  $("#attendeeMetricNote").textContent = demoMode ? "Data contoh dashboard" : "Peserta pada workspace";
  $("#teamGrid").innerHTML = team.map((member) => {
    const name = Array.isArray(member) ? member[0] : member.full_name;
    const role = Array.isArray(member) ? member[1] : member.role;
    const initials = Array.isArray(member) ? member[2] : name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");
    return `<article class="member"><div class="avatar">${escapeHTML(initials)}</div><h3>${escapeHTML(name)}</h3><p>${escapeHTML(role || "Team member")}</p></article>`;
  }).join("") || `<article class="member"><p>Belum ada anggota tim.</p></article>`;
}
function renderOverview() {
  const event = events.find((item) => item.status === "live") || events.find((item) => item.status === "published") || events[0];
  if (!event) return;
  const date = new Date(`${event.event_date}T12:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  $("#heroStatus").textContent = (event.status || "planning").toUpperCase();
  $("#heroEventName").textContent = event.name;
  $("#heroEventMeta").textContent = `${date} · ${event.venue || "Venue belum ditentukan"}`;
  $("#attendeeEventLabel").textContent = event.name.toUpperCase();
}
async function loadPeople() {
  if (demoMode || !activeOrg) { renderPeople(); return; }
  const [attendeeResult, teamResult] = await Promise.all([
    supabase.from("attendees").select("id, full_name, organization_name, status").eq("organization_id", activeOrg.id).order("created_at", { ascending: false }),
    supabase.from("team_members").select("id, full_name, role").eq("organization_id", activeOrg.id).order("created_at", { ascending: true })
  ]);
  if (!attendeeResult.error) attendees = attendeeResult.data || [];
  if (!teamResult.error) team = teamResult.data || [];
  renderPeople();
}
function openPeopleModal(type) {
  activePeopleType = type;
  const isAttendee = type === "attendee";
  $("#peopleModalLabel").textContent = isAttendee ? "EVENT GUEST" : "COLLABORATION";
  $("#peopleModalTitle").textContent = isAttendee ? "Tambah attendee" : "Tambah anggota tim";
  $("#personDetailLabel").firstChild.textContent = isAttendee ? "Organisasi" : "Role / jabatan";
  $("#personStatusLabel").hidden = !isAttendee;
  $("#personName").value = ""; $("#personDetail").value = "";
  $("#personStatus").innerHTML = isAttendee ? '<option value="registered">Registered</option><option value="checked_in">Checked in</option>' : "";
  $("#peopleModal").showModal();
}
async function savePerson(event) {
  event.preventDefault();
  const name = $("#personName").value.trim();
  const detail = $("#personDetail").value.trim();
  if (!name || !detail) return;
  if (demoMode) return showToast("Hubungkan Supabase untuk menyimpan data permanen.");
  const isAttendee = activePeopleType === "attendee";
  const payload = isAttendee
    ? { organization_id: activeOrg.id, full_name: name, organization_name: detail, status: $("#personStatus").value }
    : { organization_id: activeOrg.id, full_name: name, role: detail };
  const { error } = await supabase.from(isAttendee ? "attendees" : "team_members").insert(payload);
  if (error) return showToast(`Data gagal disimpan: ${error.message}`);
  $("#peopleModal").close(); await loadPeople(); showToast("Data berhasil disimpan.");
}
function renderModules() {
  document.querySelectorAll(".module-page").forEach((page) => {
    const module = modules[page.dataset.module];
    const key = page.dataset.module;
    const config = moduleConfig[key];
    const stored = moduleRows[key];
    const cards = stored ? [["Records", String(stored.length), "Data workspace"], ...module[3].slice(1).map((item) => item.split("|"))] : module[3].map((item) => item.split("|"));
    const rows = stored ? stored.map((record) => {
      const title = escapeHTML(record[config.primary] || "Tanpa nama");
      const detailValue = record[config.secondary];
      const detail = config.secondary === "target_amount" || config.secondary === "entry_type"
        ? escapeHTML(String(detailValue || "—")) : escapeHTML(detailValue || "—");
      return `${title}|${detail}|${escapeHTML(record.status || "draft")}`;
    }) : module[4];
    page.innerHTML = `<div class="module-hero"><p class="eyebrow" style="color:#dfc878">${module[0]}</p><h2>${module[1]}</h2><p>${module[2]}</p></div>
      <div class="module-page-actions"><button class="new-event" data-add-module="${key}">+ Tambah data</button></div><div class="module-grid">${cards.map((card) => `<article class="module-card"><p>${card[0]}</p><strong>${card[1]}</strong><small>${card[2]}</small></article>`).join("")}
      <article class="module-card module-list"><p>${stored ? "DATA WORKSPACE" : "RECENT ACTIVITY"}</p>${rows.map((item) => {
        const row = item.split("|");
        return `<div class="mini-row"><span><strong style="font-size:12px;margin:0">${row[0]}</strong><small style="display:block;color:var(--muted);margin-top:3px">${row[1]}</small></span><b>${row[2]}</b></div>`;
      }).join("") || `<p class="empty-module">Belum ada data. Tambahkan record pertama.</p>`}</article></div>`;
  });
  document.querySelectorAll("[data-add-module]").forEach((button) => button.addEventListener("click", () => openModuleModal(button.dataset.addModule)));
}
let activeModuleKey = null;
async function loadModules() {
  if (demoMode || !activeOrg) return;
  await Promise.all(Object.entries(moduleConfig).map(async ([key, config]) => {
    const { data, error } = await supabase.from(config.table).select("*").eq("organization_id", activeOrg.id).order("created_at", { ascending: false });
    if (!error) moduleRows[key] = data || [];
  }));
  renderModules();
}
function openModuleModal(key) {
  activeModuleKey = key;
  const config = moduleConfig[key];
  const module = modules[key];
  $("#moduleModalLabel").textContent = module[0];
  $("#moduleModalTitle").textContent = `Tambah ${module[1]}`;
  $("#modulePrimaryLabel").firstChild.textContent = config.primaryLabel;
  $("#moduleSecondaryLabel").firstChild.textContent = config.secondaryLabel;
  $("#modulePrimary").value = ""; $("#moduleSecondary").value = ""; $("#moduleAmount").value = "";
  $("#moduleAmountLabel").hidden = !config.amount;
  $("#moduleStatus").innerHTML = config.statuses.map((status) => `<option value="${status}">${status.replaceAll("_", " ")}</option>`).join("");
  $("#moduleModal").showModal();
}
async function saveModuleRecord(event) {
  event.preventDefault();
  const key = activeModuleKey;
  const config = moduleConfig[key];
  const primary = $("#modulePrimary").value.trim();
  const secondary = $("#moduleSecondary").value.trim();
  const status = $("#moduleStatus").value;
  if (!primary) return;
  if (demoMode) { showToast("Data demo tidak disimpan. Hubungkan Supabase untuk menyimpan permanen."); return; }
  const payload = { organization_id: activeOrg.id, [config.primary]: primary, status };
  if (config.secondary === "target_amount") payload.target_amount = Number(secondary || $("#moduleAmount").value || 0);
  else if (config.secondary === "entry_type") { payload.entry_type = secondary === "income" ? "income" : "expense"; payload.amount = Number($("#moduleAmount").value || 0); }
  else payload[config.secondary] = secondary || null;
  const { error } = await supabase.from(config.table).insert(payload);
  if (error) return showToast(`Data gagal disimpan: ${error.message}`);
  $("#moduleModal").close();
  await loadModules();
  showToast("Data berhasil disimpan ke workspace.");
}
function navigate(pageId, label) {
  document.querySelectorAll(".nav-item").forEach((node) => node.classList.remove("active"));
  document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add("active");
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active-page"));
  $(`#${pageId}`)?.classList.add("active-page");
  $("#pageTitle").textContent = label || pageId;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll(".nav-item[data-page]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.page, button.textContent.trim()));
});

function renderAuthGate(message = "") {
  const gate = $("#authGate");
  gate.hidden = false;
  gate.innerHTML = `<div class="auth-card"><div class="brand auth-brand"><span class="brand-mark">S</span><span>SULVENT</span></div>
    <p class="eyebrow">WORKSPACE ACCESS</p><h1>Welcome back.</h1><p class="auth-description">Masuk untuk mengelola event dan workspace organisasimu.</p>
    ${message ? `<p class="auth-message">${escapeHTML(message)}</p>` : ""}
    <form id="authForm" class="auth-form"><label>Email<input name="email" type="email" autocomplete="email" required placeholder="nama@email.com"></label>
    <label>Password<input name="password" type="password" autocomplete="current-password" minlength="8" required placeholder="Minimal 8 karakter"></label>
    <button class="new-event" type="submit" id="signInButton">Masuk</button>
    <button class="auth-secondary" type="button" id="signUpButton">Buat akun baru</button></form>
    <small>Gunakan email yang kamu daftarkan pada project Supabase.</small></div>`;
  $("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = $("#signInButton");
    button.disabled = true; button.textContent = "Memproses...";
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")).trim(), password: String(form.get("password"))
    });
    button.disabled = false; button.textContent = "Masuk";
    if (error) renderAuthGate(error.message);
  });
  $("#signUpButton").addEventListener("click", async () => {
    const form = new FormData($("#authForm"));
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    if (!email || password.length < 8) return renderAuthGate("Isi email dan password minimal 8 karakter terlebih dahulu.");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return renderAuthGate(error.message);
    renderAuthGate("Akun dibuat. Jika konfirmasi email aktif, cek inbox untuk verifikasi sebelum login.");
  });
}
function renderWorkspaceGate() {
  const gate = $("#workspaceGate");
  gate.hidden = false;
  gate.innerHTML = `<div class="auth-card"><div class="brand auth-brand"><span class="brand-mark">S</span><span>SULVENT</span></div>
    <p class="eyebrow">CREATE WORKSPACE</p><h1>Mulai organisasimu.</h1><p class="auth-description">Buat workspace pertama. Data event akan terisolasi untuk organisasi ini.</p>
    <form id="workspaceForm" class="auth-form"><label>Nama organisasi<input name="name" required maxlength="120" placeholder="Contoh: Yayasan Tahfidz Sulaimaniyah"></label>
    <label>Slug organisasi<input name="slug" required maxlength="60" pattern="[a-z0-9-]+" placeholder="sulaimaniyah-jatim"></label>
    <button class="new-event" type="submit">Buat workspace</button></form>
    <button class="auth-secondary" id="signOutButton" type="button">Keluar</button></div>`;
  $("#workspaceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const slug = String(form.get("slug")).trim().toLowerCase();
    const { data, error } = await supabase.rpc("create_organization", { org_name: name, org_slug: slug });
    if (error) return showToast(`Gagal membuat workspace: ${error.message}`);
    activeOrg = data;
    gate.hidden = true;
    await loadEvents();
  });
  $("#signOutButton").addEventListener("click", () => supabase.auth.signOut());
}
function showApp() {
  $("#authGate").hidden = true;
  $("#workspaceGate").hidden = true;
  document.querySelector("main").hidden = false;
  document.querySelector(".sidebar").hidden = false;
}
function hideApp() {
  document.querySelector("main").hidden = true;
  document.querySelector(".sidebar").hidden = true;
}
async function loadOrganization() {
  const { data, error } = await supabase.from("organization_members")
    .select("organization_id, role, organizations(id, name, slug)")
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data?.length) {
    hideApp(); renderWorkspaceGate(); return false;
  }
  const membership = data[0];
  activeOrg = membership.organizations;
  const profileName = session.user.email?.split("@")[0] || "Organizer";
  $(".profile strong").textContent = activeOrg.name;
  $(".profile small").textContent = `${membership.role} · ${profileName}`;
  return true;
}
async function loadEvents() {
  const { data, error } = await supabase.from("events")
    .select("id, name, event_date, venue, status")
    .eq("organization_id", activeOrg.id)
    .order("event_date", { ascending: true });
  if (error) {
    showToast(`Tidak dapat memuat event: ${error.message}`);
    return;
  }
  events = data || [];
  renderEvents(); renderCalendar();
  renderOverview();
  await loadModules();
  await loadPeople();
}
async function createEvent(event) {
  event.preventDefault();
  const name = $("#eventName").value.trim();
  const eventDate = $("#eventDate").value;
  const venue = $("#eventVenue").value.trim();
  if (!name || !eventDate) return;
  if (demoMode) {
    events.unshift({ id: `local-${Date.now()}`, name, event_date: eventDate, venue, status: "Planning" });
    showToast("Event ditambahkan ke demo lokal. Hubungkan Supabase untuk menyimpan permanen.");
  } else {
    const { error } = await supabase.from("events").insert({
      organization_id: activeOrg.id, name, event_date: eventDate, venue: venue || null, status: "planning"
    });
    if (error) return showToast(`Event gagal disimpan: ${error.message}`);
    await loadEvents();
    showToast("Event berhasil disimpan ke database.");
  }
  renderEvents(); renderCalendar();
  $("#eventModal").close();
  $("#eventName").value = ""; $("#eventDate").value = ""; $("#eventVenue").value = "";
}
function initDemoMode() {
  demoMode = true;
  events = [...demoEvents];
  setBackendBadge("DEMO MODE · Data belum tersimpan", false);
  renderEvents(); renderCalendar();
}
async function initSupabase() {
  const config = window.SULVENT_CONFIG || {};
  const valid = config.supabaseUrl?.startsWith("https://") &&
    !config.supabaseUrl.includes("YOUR-PROJECT") &&
    config.supabaseAnonKey && !config.supabaseAnonKey.includes("YOUR_SUPABASE");
  if (!valid) { initDemoMode(); return; }

  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  demoMode = false;
  setBackendBadge("SUPABASE · Menghubungkan...", false);
  supabase.auth.onAuthStateChange((_event, newSession) => {
    session = newSession;
    queueMicrotask(async () => {
      if (!session) {
        hideApp(); renderAuthGate();
        setBackendBadge("SUPABASE · Belum login", false);
        return;
      }
      try {
        const hasOrg = await loadOrganization();
        if (hasOrg) {
          showApp();
          await loadEvents();
          setBackendBadge("SUPABASE · Terhubung", true);
        }
      } catch (error) {
        showToast(`Workspace gagal dimuat: ${error.message}`);
      }
    });
  });
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  session = data.session;
  if (!session) {
    hideApp(); renderAuthGate();
    setBackendBadge("SUPABASE · Belum login", false);
    return;
  }
  try {
    const hasOrg = await loadOrganization();
    if (hasOrg) {
      showApp(); await loadEvents();
      setBackendBadge("SUPABASE · Terhubung", true);
    }
  } catch (error) {
    showToast(`Gagal memuat workspace: ${error.message}`);
  }
}

$("#createEvent").addEventListener("click", createEvent);
$("#moduleForm").addEventListener("submit", saveModuleRecord);
$("#closeModuleModal").addEventListener("click", () => $("#moduleModal").close());
$("#addAttendeeBtn").addEventListener("click", () => openPeopleModal("attendee"));
$("#addTeamBtn").addEventListener("click", () => openPeopleModal("team"));
$("#peopleForm").addEventListener("submit", savePerson);
$("#closePeopleModal").addEventListener("click", () => $("#peopleModal").close());
$("#addTaskBtn").addEventListener("click", () => {
  const task = window.prompt("Nama task baru:");
  if (!task?.trim()) return;
  const label = document.createElement("label");
  const checkbox = document.createElement("input"); checkbox.type = "checkbox";
  const span = document.createElement("span"); span.textContent = task.trim();
  const small = document.createElement("small"); small.textContent = "New";
  label.append(checkbox, span, small); $("#addTaskBtn").before(label);
  showToast("Task ditambahkan untuk sesi ini.");
});
$("#checkInBtn").addEventListener("click", () => showToast("Fitur check-in QR akan masuk tahap ticketing."));
$(".attendee-toolbar input").addEventListener("input", (event) => {
  document.querySelectorAll(".attendee").forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(event.target.value.toLowerCase()) ? "flex" : "none";
  });
});
["#newEventBtn", "#newEventBtn2"].forEach((selector) => $(selector).addEventListener("click", () => $("#eventModal").showModal()));

renderPeople();
renderModules();
renderOverview();
initSupabase().catch((error) => {
  console.error(error);
  initDemoMode();
  showToast("Supabase belum siap. Aplikasi dibuka dalam demo mode.");
});
