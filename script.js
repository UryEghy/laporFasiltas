/**
 * script.js — LaporFasilitas
 *
 * Modul utama:
 *  1. SMART TRIAGE   — analisis kata kunci → kategori + prioritas
 *  2. STATE & STORE  — localStorage sebagai "database"
 *  3. RENDER         — dashboard, daftar laporan
 *  4. CRUD           — tambah, ubah status, hapus laporan
 *  5. FILTER/SEARCH  — filter kategori, status, dan teks
 *  6. CSV EXPORT     — ekspor semua laporan ke file .csv
 *  7. UI HELPERS     — toast, modal, validasi form, foto preview
 */

"use strict";

/* =============================================================
   1. SMART TRIAGE — Aturan kata kunci
   ============================================================= */

/**
 * Aturan Kategori: setiap entri berisi kata-kata kunci (lowercase).
 * Urutan penting — kategori pertama yang cocok diambil.
 */
const CATEGORY_RULES = [
  { category: "Listrik",    keywords: ["korslet","korsleting","listrik","lampu","stop kontak","saklar","mcb","arus","tegangan","strum","setrum","konslet","kelistrikan"] },
  { category: "Air/Pipa",   keywords: ["bocor","bocoran","banjir","pipa","air","keran","wastafel","toilet","wc","kamar mandi","rembes","meluap","saluran","drainase","got"] },
  { category: "AC/HVAC",    keywords: ["ac","air conditioner","pendingin","hvac","kipas","ventilasi","exhaust","freon","dingin","panas","suhu","berembun"] },
  { category: "Furnitur",   keywords: ["kursi","meja","lemari","rak","bangku","papan tulis","whiteboard","pintu","jendela","kunci","engsel","terkelupas","retak","patah","rusak"] },
  { category: "Jaringan/IT",keywords: ["wifi","internet","jaringan","koneksi","router","switch","kabel lan","proyektor","infocus","layar proyektor","server","komputer","printer","it"] },
  { category: "Kebersihan", keywords: ["kotor","sampah","bau","jorok","kumuh","debu","jamur","tikus","kecoa","serangga","kebersihan"] },
];

/**
 * Aturan Prioritas:
 * Kata kunci berikut langsung menentukan prioritas TINGGI.
 * Sisanya jatuh ke SEDANG/RENDAH berdasarkan konteks.
 */
const PRIORITY_HIGH_KEYWORDS  = ["bocor","korslet","korsleting","berbahaya","bahaya","darurat","mendesak","parah","banjir","terkelupas","retak parah","meluap","konslet","setrum","strum","tidak bisa","tidak berfungsi","mati total","rusak parah"];
const PRIORITY_MED_KEYWORDS   = ["tidak nyaman","terganggu","mengganggu","kurang","agak","sedikit","mulai","kadang","sering","tidak dingin","panas","bau","kotor","rusak","lambat"];
// Jika tidak ada kata kunci Tinggi/Sedang → Rendah

/**
 * Jalankan Smart Triage pada teks deskripsi.
 * @param {string} description
 * @returns {{ category: string, priority: string, matchedKeywords: string[] }}
 */
function runSmartTriage(description) {
  const lower = description.toLowerCase();

  // ── Deteksi Kategori ──────────────────────────────────────────
  let detectedCategory = "Lainnya";
  const matchedKeywords = [];

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        matchedKeywords.push(kw);
        if (detectedCategory === "Lainnya") {
          detectedCategory = rule.category; // ambil kategori pertama yang cocok
        }
      }
    }
  }

  // ── Deteksi Prioritas ─────────────────────────────────────────
  let detectedPriority = "Rendah";

  const hasHighKw = PRIORITY_HIGH_KEYWORDS.some((kw) => lower.includes(kw));
  const hasMedKw  = PRIORITY_MED_KEYWORDS.some((kw) => lower.includes(kw));

  if (hasHighKw)       detectedPriority = "Tinggi";
  else if (hasMedKw)   detectedPriority = "Sedang";

  // Jika tidak ada kata kunci kategori sama sekali → tetap Rendah kecuali ada high-kw
  return {
    category:        detectedCategory,
    priority:        detectedPriority,
    matchedKeywords: [...new Set(matchedKeywords)], // buang duplikat
  };
}

/* =============================================================
   2. STATE & STORE (localStorage)
   ============================================================= */

const STORAGE_KEY = "laporfasilitas_reports";

/** @type {Array<Object>} — master array laporan */
let reports = [];

/** Muat laporan dari localStorage */
function loadReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Simpan laporan ke localStorage */
function saveReports() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

/** Buat ID unik untuk laporan */
function generateId() {
  return "rpt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
}

/** Format tanggal ke string lokal (id-ID) */
function formatDate(isoString) {
  return new Date(isoString).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* =============================================================
   3. DATA DUMMY (6 laporan awal)
   ============================================================= */

const DUMMY_REPORTS = [
  {
    id: "dummy_1",
    name: "Andi Pratama",
    location: "Gedung B, Ruang 2.04",
    description: "AC di ruang B2.04 bocor, lantai jadi licin dan berbahaya bagi mahasiswa.",
    category: "AC/HVAC",
    priority: "Tinggi",
    status: "Baru",
    photo: null,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "dummy_2",
    name: "Siti Rahayu",
    location: "Gedung A, Toilet Lt. 2",
    description: "Pipa air di toilet lantai 2 bocor dan meluap, menyebabkan banjir kecil di lorong.",
    category: "Air/Pipa",
    priority: "Tinggi",
    status: "Diproses",
    photo: null,
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "dummy_3",
    name: "Budi Santoso",
    location: "Lab Komputer C, Lantai 3",
    description: "Koneksi internet WiFi di lab sangat lambat dan sering putus, mengganggu praktikum mahasiswa.",
    category: "Jaringan/IT",
    priority: "Sedang",
    status: "Baru",
    photo: null,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "dummy_4",
    name: "Dewi Lestari",
    location: "Ruang Seminar D.101",
    description: "Beberapa kursi di ruang seminar sudah terkelupas dan ada yang patah, perlu segera diganti.",
    category: "Furnitur",
    priority: "Tinggi",
    status: "Diproses",
    photo: null,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "dummy_5",
    name: "Rizky Firmansyah",
    location: "Kantin Gedung E",
    description: "Area kantin kotor dan bau, sampah menumpuk dan ada kecoa terlihat di area makan.",
    category: "Kebersihan",
    priority: "Sedang",
    status: "Selesai",
    photo: null,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "dummy_6",
    name: "Maya Anggraini",
    location: "Gedung F, Ruang Dosen",
    description: "Stop kontak di ruang dosen korslet dan mengeluarkan percikan api, sangat berbahaya.",
    category: "Listrik",
    priority: "Tinggi",
    status: "Selesai",
    photo: null,
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
];

/* =============================================================
   4. DOM REFERENCES
   ============================================================= */

// Form
const reportForm      = document.getElementById("report-form");
const inputName       = document.getElementById("input-name");
const inputLocation   = document.getElementById("input-location");
const inputDesc       = document.getElementById("input-desc");
const inputPhoto      = document.getElementById("input-photo");
const fileDropZone    = document.getElementById("file-drop-zone");
const photoPreview    = document.getElementById("photo-preview");

// Triage Preview
const triagePreview   = document.getElementById("triage-preview");
const previewCategory = document.getElementById("preview-category");
const previewPriority = document.getElementById("preview-priority");
const keywordChips    = document.getElementById("keyword-chips");
const btnCancelPreview= document.getElementById("btn-cancel-preview");
const btnSaveReport   = document.getElementById("btn-save-report");

// Dashboard
const dashboardStats  = document.getElementById("dashboard-stats");

// List & Controls
const reportList      = document.getElementById("report-list");
const emptyState      = document.getElementById("empty-state");
const searchInput     = document.getElementById("search-input");
const filterCategory  = document.getElementById("filter-category");
const filterStatus    = document.getElementById("filter-status");

// Admin & Export
const adminToggle     = document.getElementById("admin-toggle-checkbox");
const btnExportCsv    = document.getElementById("btn-export-csv");

// Modal
const deleteModal     = document.getElementById("delete-modal");
const btnDeleteCancel = document.getElementById("btn-delete-cancel");
const btnDeleteConfirm= document.getElementById("btn-delete-confirm");

// Toast
const toastEl         = document.getElementById("toast");

/* =============================================================
   5. STATE APLIKASI
   ============================================================= */

let isAdminMode  = false;       // apakah mode admin aktif
let pendingReport = null;       // data laporan yang sedang dalam preview
let pendingDeleteId = null;     // id laporan yang akan dihapus
let photoDataUrl  = null;       // base64 foto yang di-upload
let toastTimer    = null;       // timer untuk auto-hide toast

/* =============================================================
   6. RENDER — Dashboard
   ============================================================= */

/**
 * Render kartu statistik di dashboard.
 * Menggunakan data dari array `reports` saat ini.
 */
function renderDashboard() {
  const total     = reports.length;
  const baru      = reports.filter((r) => r.status === "Baru").length;
  const diproses  = reports.filter((r) => r.status === "Diproses").length;
  const selesai   = reports.filter((r) => r.status === "Selesai").length;

  // Hitung per-kategori
  const catCount = {};
  reports.forEach((r) => {
    catCount[r.category] = (catCount[r.category] || 0) + 1;
  });

  // Bangun HTML kartu statistik
  let html = `
    <div class="stat-card">
      <div class="stat-value">${total}</div>
      <div class="stat-label">Total</div>
    </div>
    <div class="stat-card stat-baru">
      <div class="stat-value">${baru}</div>
      <div class="stat-label">Baru</div>
    </div>
    <div class="stat-card stat-diproses">
      <div class="stat-value">${diproses}</div>
      <div class="stat-label">Diproses</div>
    </div>
    <div class="stat-card stat-selesai">
      <div class="stat-value">${selesai}</div>
      <div class="stat-label">Selesai</div>
    </div>
  `;

  // Kartu per-kategori
  Object.entries(catCount)
    .sort((a, b) => b[1] - a[1]) // urutkan terbanyak dulu
    .forEach(([cat, count]) => {
      html += `
        <div class="stat-card">
          <div class="stat-value" style="font-size:1.4rem">${count}</div>
          <div class="stat-label">${cat}</div>
        </div>
      `;
    });

  dashboardStats.innerHTML = html;
}

/* =============================================================
   7. RENDER — Daftar Laporan
   ============================================================= */

/**
 * Render daftar laporan berdasarkan filter & pencarian yang aktif.
 */
function renderReports() {
  const query      = searchInput.value.trim().toLowerCase();
  const catFilter  = filterCategory.value;
  const statFilter = filterStatus.value;

  // Filter data
  const filtered = reports.filter((r) => {
    const matchSearch = !query ||
      r.name.toLowerCase().includes(query)     ||
      r.location.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query);
    const matchCat  = !catFilter  || r.category === catFilter;
    const matchStat = !statFilter || r.status   === statFilter;
    return matchSearch && matchCat && matchStat;
  });

  // Tampilkan empty-state jika tidak ada hasil
  if (filtered.length === 0) {
    reportList.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  // Bangun kartu untuk setiap laporan
  reportList.innerHTML = filtered.map((r) => buildReportCard(r)).join("");

  // Pasang event listener di kartu yang baru dirender
  attachCardListeners();
}

/**
 * Bangun HTML string satu kartu laporan.
 * @param {Object} report
 * @returns {string}
 */
function buildReportCard(report) {
  const statusBadgeClass = {
    "Baru":     "badge-baru",
    "Diproses": "badge-diproses",
    "Selesai":  "badge-selesai",
  }[report.status] || "badge-baru";

  const priorityBadgeClass = {
    "Tinggi": "badge-tinggi",
    "Sedang": "badge-sedang",
    "Rendah": "badge-rendah",
  }[report.priority] || "badge-rendah";

  // Kontrol status hanya tampil di mode admin
  const adminControls = isAdminMode ? `
    <select class="status-select" data-id="${report.id}" aria-label="Ubah status laporan">
      <option value="Baru"     ${report.status === "Baru"     ? "selected" : ""}>Baru</option>
      <option value="Diproses" ${report.status === "Diproses" ? "selected" : ""}>Diproses</option>
      <option value="Selesai"  ${report.status === "Selesai"  ? "selected" : ""}>Selesai</option>
    </select>
    <button class="btn btn-danger btn-sm btn-delete" data-id="${report.id}" aria-label="Hapus laporan ${report.id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M3 7h18"/>
      </svg>
      Hapus
    </button>` : "";

  // Preview foto jika ada
  const photoHtml = report.photo
    ? `<img src="${report.photo}" alt="Foto kerusakan" style="max-height:100px;border-radius:6px;margin-bottom:.5rem;display:block;" />`
    : "";

  return `
    <article class="report-card" data-id="${report.id}">
      <div class="rc-header">
        <span class="rc-title">${escHtml(report.name)} — ${escHtml(report.location)}</span>
        <div class="rc-badges">
          <span class="badge ${statusBadgeClass}">${report.status}</span>
          <span class="badge ${priorityBadgeClass}">${report.priority}</span>
          <span class="badge badge-cat">${report.category}</span>
        </div>
      </div>
      <div class="rc-meta">
        <span>📍 ${escHtml(report.location)}</span>
        <span>🕐 ${formatDate(report.createdAt)}</span>
      </div>
      ${photoHtml}
      <p class="rc-desc">${escHtml(report.description)}</p>
      <div class="rc-footer">
        <span class="rc-date">ID: ${report.id}</span>
        <div class="rc-actions">${adminControls}</div>
      </div>
    </article>
  `;
}

/**
 * Pasang event listener pada elemen interaktif di dalam kartu
 * (dilakukan setelah innerHTML di-set ulang).
 */
function attachCardListeners() {
  // Ubah status (admin)
  document.querySelectorAll(".status-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const id        = e.target.dataset.id;
      const newStatus = e.target.value;
      updateReportStatus(id, newStatus);
    });
  });

  // Hapus laporan (admin)
  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      pendingDeleteId = e.currentTarget.dataset.id;
      deleteModal.classList.remove("hidden");
    });
  });
}

/* =============================================================
   8. CRUD OPERATIONS
   ============================================================= */

/**
 * Tambah laporan baru ke array dan simpan.
 * @param {Object} reportData — data laporan yang sudah lengkap
 */
function addReport(reportData) {
  reports.unshift(reportData); // tampilkan paling atas
  saveReports();
  renderDashboard();
  renderReports();
}

/**
 * Ubah status satu laporan.
 * @param {string} id
 * @param {string} newStatus — "Baru" | "Diproses" | "Selesai"
 */
function updateReportStatus(id, newStatus) {
  reports = reports.map((r) =>
    r.id === id ? { ...r, status: newStatus } : r
  );
  saveReports();
  renderDashboard();
  renderReports();
  showToast(`Status diperbarui menjadi "${newStatus}"`, "success");
}

/**
 * Hapus satu laporan berdasarkan id.
 * @param {string} id
 */
function deleteReport(id) {
  reports = reports.filter((r) => r.id !== id);
  saveReports();
  renderDashboard();
  renderReports();
  showToast("Laporan berhasil dihapus.", "success");
}

/* =============================================================
   9. FORM — Validasi & Submit
   ============================================================= */

/** Tampilkan pesan error pada field tertentu */
function showFieldError(fieldId, message) {
  const errEl = document.getElementById("err-" + fieldId);
  const input = document.getElementById("input-" + fieldId);
  if (errEl) errEl.textContent = message;
  if (input) input.classList.add("has-error");
}

/** Hapus semua pesan error form */
function clearFormErrors() {
  ["name","location","desc"].forEach((id) => {
    const errEl = document.getElementById("err-" + id);
    const input = document.getElementById("input-" + id);
    if (errEl) errEl.textContent = "";
    if (input) input.classList.remove("has-error");
  });
}

/**
 * Validasi input form.
 * @returns {boolean} true jika semua valid
 */
function validateForm() {
  let valid = true;
  clearFormErrors();

  if (!inputName.value.trim()) {
    showFieldError("name", "Nama pelapor tidak boleh kosong.");
    valid = false;
  }
  if (!inputLocation.value.trim()) {
    showFieldError("location", "Gedung/Ruangan tidak boleh kosong.");
    valid = false;
  }
  if (!inputDesc.value.trim()) {
    showFieldError("desc", "Deskripsi kerusakan tidak boleh kosong.");
    valid = false;
  } else if (inputDesc.value.trim().length < 10) {
    showFieldError("desc", "Deskripsi terlalu pendek (minimal 10 karakter).");
    valid = false;
  }

  return valid;
}

/** Handler submit form — jalankan triage dan tampilkan preview */
reportForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const description = inputDesc.value.trim();
  const triageResult = runSmartTriage(description);

  // Simpan data sementara di state pendingReport
  pendingReport = {
    id:          generateId(),
    name:        inputName.value.trim(),
    location:    inputLocation.value.trim(),
    description,
    photo:       photoDataUrl,
    createdAt:   new Date().toISOString(),
    status:      "Baru",
  };

  // Isi form preview dengan hasil triage
  previewCategory.value = triageResult.category;
  previewPriority.value = triageResult.priority;

  // Tampilkan chip kata kunci yang terdeteksi
  if (triageResult.matchedKeywords.length > 0) {
    keywordChips.innerHTML = triageResult.matchedKeywords
      .map((kw) => `<span class="keyword-chip">🔍 ${escHtml(kw)}</span>`)
      .join("");
  } else {
    keywordChips.innerHTML = `<span class="keyword-chip" style="opacity:.6">Tidak ada kata kunci spesifik terdeteksi</span>`;
  }

  // Tampilkan kartu preview
  triagePreview.classList.remove("hidden");
  triagePreview.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

/** Tombol "Simpan Laporan" di preview */
btnSaveReport.addEventListener("click", () => {
  if (!pendingReport) return;

  // Ambil nilai akhir (bisa sudah dikoreksi pengguna)
  pendingReport.category = previewCategory.value;
  pendingReport.priority = previewPriority.value;

  addReport(pendingReport);
  showToast("Laporan berhasil disimpan!", "success");

  // Reset form
  reportForm.reset();
  photoDataUrl = null;
  photoPreview.innerHTML = "";
  photoPreview.classList.add("hidden");
  triagePreview.classList.add("hidden");
  pendingReport = null;
  clearFormErrors();
  inputName.focus();
});

/** Tombol "Batal" di preview */
btnCancelPreview.addEventListener("click", () => {
  triagePreview.classList.add("hidden");
  pendingReport = null;
});

/* =============================================================
   10. FOTO UPLOAD & PREVIEW
   ============================================================= */

/** Proses file foto yang dipilih/di-drop */
function handlePhotoFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("File harus berupa gambar (PNG/JPG).", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("Ukuran file melebihi 5 MB.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    photoDataUrl = e.target.result;
    photoPreview.innerHTML = `
      <img src="${photoDataUrl}" alt="Pratinjau foto kerusakan" />
      <button type="button" class="photo-remove" id="btn-remove-photo" aria-label="Hapus foto">✕</button>
    `;
    photoPreview.classList.remove("hidden");

    document.getElementById("btn-remove-photo").addEventListener("click", () => {
      photoDataUrl = null;
      photoPreview.innerHTML = "";
      photoPreview.classList.add("hidden");
      inputPhoto.value = "";
    });
  };
  reader.readAsDataURL(file);
}

inputPhoto.addEventListener("change", (e) => {
  if (e.target.files[0]) handlePhotoFile(e.target.files[0]);
});

// Drag-and-drop pada zona drop
fileDropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  fileDropZone.classList.add("drag-over");
});
fileDropZone.addEventListener("dragleave", () => fileDropZone.classList.remove("drag-over"));
fileDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  fileDropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handlePhotoFile(file);
});

/* =============================================================
   11. FILTER & PENCARIAN
   ============================================================= */

searchInput.addEventListener("input",   renderReports);
filterCategory.addEventListener("change", renderReports);
filterStatus.addEventListener("change",   renderReports);

/* =============================================================
   12. MODE ADMIN
   ============================================================= */

adminToggle.addEventListener("change", () => {
  isAdminMode = adminToggle.checked;
  renderReports(); // re-render untuk tampilkan/sembunyikan kontrol admin
  showToast(
    isAdminMode ? "Mode Admin diaktifkan." : "Mode Admin dinonaktifkan.",
    "success"
  );
});

/* =============================================================
   13. DELETE MODAL
   ============================================================= */

btnDeleteCancel.addEventListener("click", () => {
  deleteModal.classList.add("hidden");
  pendingDeleteId = null;
});

btnDeleteConfirm.addEventListener("click", () => {
  if (pendingDeleteId) {
    deleteReport(pendingDeleteId);
    pendingDeleteId = null;
  }
  deleteModal.classList.add("hidden");
});

// Klik backdrop modal → tutup
deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) {
    deleteModal.classList.add("hidden");
    pendingDeleteId = null;
  }
});

// Tutup modal dengan tombol Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !deleteModal.classList.contains("hidden")) {
    deleteModal.classList.add("hidden");
    pendingDeleteId = null;
  }
});

/* =============================================================
   14. EKSPOR CSV
   ============================================================= */

/**
 * Ekspor semua laporan ke file CSV dan trigger download.
 */
btnExportCsv.addEventListener("click", () => {
  if (reports.length === 0) {
    showToast("Tidak ada laporan untuk diekspor.", "error");
    return;
  }

  const headers = ["ID","Nama Pelapor","Lokasi","Deskripsi","Kategori","Prioritas","Status","Tanggal"];

  const rows = reports.map((r) => [
    r.id,
    r.name,
    r.location,
    r.description,
    r.category,
    r.priority,
    r.status,
    formatDate(r.createdAt),
  ].map(csvCell).join(","));

  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // BOM untuk Excel
  const url  = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href     = url;
  link.download = `LaporFasilitas_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`${reports.length} laporan berhasil diekspor.`, "success");
});

/** Escape nilai sel CSV (tambah kutip jika ada koma/newline/kutip) */
function csvCell(value) {
  const str = String(value ?? "").replace(/"/g, '""');
  return /[",\n\r]/.test(str) ? `"${str}"` : str;
}

/* =============================================================
   15. TOAST NOTIFICATION
   ============================================================= */

/**
 * Tampilkan notifikasi toast sementara.
 * @param {string} message
 * @param {"success"|"error"|""} type
 */
function showToast(message, type = "") {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className = "toast" + (type ? ` toast-${type}` : "");
  toastEl.classList.remove("hidden");

  toastTimer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 3000);
}

/* =============================================================
   16. UTILITY
   ============================================================= */

/**
 * Escape karakter HTML untuk mencegah XSS pada innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}

/* =============================================================
   17. INISIALISASI
   ============================================================= */

/**
 * Jalankan aplikasi:
 *  1. Muat laporan dari localStorage.
 *  2. Jika kosong, isi dengan data dummy.
 *  3. Render dashboard + daftar laporan.
 */
function init() {
  reports = loadReports();

  // Isi dummy data hanya jika localStorage benar-benar kosong
  if (reports.length === 0) {
    reports = DUMMY_REPORTS;
    saveReports();
  }

  renderDashboard();
  renderReports();
}

init();
