/*
  Clínica ÚNick | Sistema Financeiro + Nota Fiscal
  GitHub Pages + Supabase

  1) Crie o projeto no Supabase.
  2) Execute o arquivo supabase.sql no SQL Editor.
  3) Cole abaixo a URL do projeto e a chave pública/publishable key.
  4) Publique estes arquivos no GitHub Pages.

  Nunca coloque service_role/secret key neste arquivo.
*/

const SUPABASE_URL = "https://rkfolrgkbmoonxqbaidz.supabase.co";
const SUPABASE_PUBLIC_KEY = "cole_a_publishable_key_completa_aqui";

const CONFIG_OK = SUPABASE_URL.startsWith("https://") && !SUPABASE_PUBLIC_KEY.includes("COLE_AQUI");
const sb = CONFIG_OK ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY) : null;

const state = {
  user: null,
  patients: [],
  guardians: [],
  patientGuardians: [],
  records: [],
  settings: null,
  activeRecordForPdf: null,
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const $ = (id) => document.getElementById(id);
const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const currentYear = () => new Date().getFullYear();
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
const nl2br = (value = "") => escapeHTML(value).replace(/\n/g, "<br>");
const dateBR = (iso) => iso ? iso.split("-").reverse().join("/") : "";
const monthYearText = (month, year) => month && year ? `${monthNames[Number(month) - 1]} de ${year}` : "";
const isDeletedNull = { deleted_at: null };

function showToast(message, type = "ok") {
  const toast = $("toast");
  toast.textContent = message;
  toast.style.borderColor = type === "error" ? "#F9BDBD" : "#B8E5C5";
  toast.style.color = type === "error" ? "#8A1F11" : "#1F7A3D";
  toast.style.background = type === "error" ? "#FEECEC" : "#ECFDF3";
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function handleError(error, fallback = "Ocorreu um erro.") {
  console.error(error);
  showToast(error?.message || fallback, "error");
}

function setLoading(button, loading, text = "Salvando...") {
  if (!button) return;
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function setScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(screenId).classList.add("active");
  document.querySelectorAll(".menu-btn").forEach((b) => b.classList.toggle("active", b.dataset.screen === screenId));

  const titles = {
    dashboardScreen: ["Início", "Resumo do sistema financeiro."],
    patientsScreen: ["Pacientes", "Cadastro, edição, pesquisa e exclusão lógica de pacientes."],
    guardiansScreen: ["Responsáveis", "Responsáveis financeiros/legais vinculados aos pacientes."],
    financialFormScreen: ["Nova Ficha Financeira", "Preencha os dados e gere descrição da NF e PDF."],
    recordsScreen: ["Fichas Salvas", "Busque, visualize, edite, exclua e gere PDFs."],
    settingsScreen: ["Configurações da Clínica", "Dados fixos usados nas fichas e nos PDFs."],
  };

  $("screenTitle").textContent = titles[screenId]?.[0] || "Sistema";
  $("screenSubtitle").textContent = titles[screenId]?.[1] || "";

  if (screenId === "recordsScreen") renderRecordsList();
}

function initStaticSelects() {
  const monthOptions = '<option value="">Selecione</option>' + monthNames.map((name, i) => `<option value="${i + 1}">${name}</option>`).join("");
  ["recordMonth", "filterMonth"].forEach((id) => { $(id).innerHTML = monthOptions; });
  $("recordYear").value = currentYear();
  $("recordIssueDate").value = todayISO();
}

function showAuthView() {
  $("authView").classList.remove("hidden");
  $("appView").classList.add("hidden");
}

function showAppView() {
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("userEmail").textContent = state.user?.email || "";
}

async function checkSession() {
  if (!CONFIG_OK) {
    $("configAlert").classList.remove("hidden");
    showAuthView();
    return;
  }

  const { data, error } = await sb.auth.getSession();
  if (error) return handleError(error);

  state.user = data.session?.user || null;
  if (state.user) {
    showAppView();
    await loadAllData();
  } else {
    showAuthView();
  }

  sb.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    if (state.user) {
      showAppView();
      await loadAllData();
    } else {
      showAuthView();
    }
  });
}

async function signIn(event) {
  event.preventDefault();
  if (!CONFIG_OK) return showToast("Configure o Supabase antes de entrar.", "error");
  const button = event.submitter;
  setLoading(button, true, "Entrando...");
  const { error } = await sb.auth.signInWithPassword({
    email: $("loginEmail").value.trim(),
    password: $("loginPassword").value,
  });
  setLoading(button, false);
  if (error) return handleError(error, "Não foi possível entrar.");
  showToast("Login realizado com sucesso!");
}

async function signUp(event) {
  event.preventDefault();
  if (!CONFIG_OK) return showToast("Configure o Supabase antes de cadastrar.", "error");
  const button = event.submitter;
  setLoading(button, true, "Criando...");
  const { error } = await sb.auth.signUp({
    email: $("signupEmail").value.trim(),
    password: $("signupPassword").value,
    options: { data: { full_name: $("signupName").value.trim() } },
  });
  setLoading(button, false);
  if (error) return handleError(error, "Não foi possível criar o cadastro.");
  showToast("Cadastro criado. Verifique seu e-mail se a confirmação estiver ativada.");
}

async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) return handleError(error);
}

async function loadAllData() {
  await Promise.all([
    loadSettings(),
    loadPatients(),
    loadGuardians(),
    loadPatientGuardians(),
    loadFinancialRecords(),
  ]);
  renderEverything();
}

async function loadSettings() {
  const { data, error } = await sb.from("clinic_settings").select("*").maybeSingle();
  if (error) return handleError(error, "Erro ao carregar configurações.");
  state.settings = data || null;
  renderSettingsForm();
}

async function loadPatients() {
  const { data, error } = await sb.from("patients").select("*").is("deleted_at", null).order("full_name");
  if (error) return handleError(error, "Erro ao carregar pacientes.");
  state.patients = data || [];
}

async function loadGuardians() {
  const { data, error } = await sb.from("guardians").select("*").is("deleted_at", null).order("full_name");
  if (error) return handleError(error, "Erro ao carregar responsáveis.");
  state.guardians = data || [];
}

async function loadPatientGuardians() {
  const { data, error } = await sb.from("patient_guardians").select("*").is("deleted_at", null);
  if (error) return handleError(error, "Erro ao carregar vínculos.");
  state.patientGuardians = data || [];
}

async function loadFinancialRecords() {
  const { data, error } = await sb
    .from("financial_records")
    .select("*, patients(full_name), guardians(full_name)")
    .is("deleted_at", null)
    .order("reference_year", { ascending: false })
    .order("reference_month", { ascending: false });
  if (error) return handleError(error, "Erro ao carregar fichas.");
  state.records = data || [];
}

function renderEverything() {
  renderMetrics();
  renderPatientOptions();
  renderGuardianOptions();
  renderPatientsList();
  renderGuardiansList();
  renderRecordsList();
  calculateRecordTotals();
}

function renderMetrics() {
  $("metricPatients").textContent = state.patients.filter((p) => p.status === "ativo").length;
  $("metricGuardians").textContent = state.guardians.length;
  $("metricRecords").textContent = state.records.length;
  const total = state.records.reduce((sum, r) => sum + Number(r.total_value || 0), 0);
  $("metricMonthTotal").textContent = money(total);
}

function renderPatientOptions() {
  const options = '<option value="">Selecione</option>' + state.patients.map((p) => `<option value="${p.id}">${escapeHTML(p.full_name)}</option>`).join("");
  ["recordPatient", "filterPatient"].forEach((id) => { $(id).innerHTML = id === "filterPatient" ? '<option value="">Todos</option>' + options.replace('<option value="">Selecione</option>', '') : options; });

  $("guardianPatients").innerHTML = state.patients.map((p) => `<option value="${p.id}">${escapeHTML(p.full_name)}</option>`).join("");
}

function renderGuardianOptions(patientId = null) {
  let guardians = state.guardians;
  if (patientId) {
    const linkedIds = state.patientGuardians.filter((l) => l.patient_id === patientId).map((l) => l.guardian_id);
    guardians = state.guardians.filter((g) => linkedIds.includes(g.id));
  }
  const options = '<option value="">Selecione</option>' + guardians.map((g) => `<option value="${g.id}">${escapeHTML(g.full_name)}</option>`).join("");
  $("recordGuardian").innerHTML = options;
  $("filterGuardian").innerHTML = '<option value="">Todos</option>' + state.guardians.map((g) => `<option value="${g.id}">${escapeHTML(g.full_name)}</option>`).join("");
}

function guardianNamesForPatient(patientId) {
  const ids = state.patientGuardians.filter((l) => l.patient_id === patientId).map((l) => l.guardian_id);
  return state.guardians.filter((g) => ids.includes(g.id)).map((g) => g.full_name).join(", ");
}

async function savePatient(event) {
  event.preventDefault();
  const id = $("patientId").value;
  const payload = {
    full_name: $("patientName").value.trim(),
    birth_date: $("patientBirthDate").value || null,
    status: $("patientStatus").value,
    admin_notes: $("patientNotes").value.trim() || null,
  };

  const button = event.submitter;
  setLoading(button, true);
  const { error } = id
    ? await sb.from("patients").update(payload).eq("id", id)
    : await sb.from("patients").insert(payload);
  setLoading(button, false);

  if (error) return handleError(error, "Erro ao salvar paciente.");
  clearPatientForm();
  await loadPatients();
  await loadPatientGuardians();
  renderEverything();
  showToast("Paciente salvo!");
}

function editPatient(id) {
  const p = state.patients.find((x) => x.id === id);
  if (!p) return;
  $("patientId").value = p.id;
  $("patientName").value = p.full_name || "";
  $("patientBirthDate").value = p.birth_date || "";
  $("patientStatus").value = p.status || "ativo";
  $("patientNotes").value = p.admin_notes || "";
  $("patientFormTitle").textContent = "Editar paciente";
  setScreen("patientsScreen");
}

function clearPatientForm() {
  $("patientForm").reset();
  $("patientId").value = "";
  $("patientStatus").value = "ativo";
  $("patientFormTitle").textContent = "Cadastrar paciente";
}

async function deletePatient(id) {
  if (!confirm("Tem certeza que deseja excluir este registro? Essa ação não poderá ser desfeita.")) return;
  const { error } = await sb.from("patients").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return handleError(error, "Erro ao excluir paciente.");
  await loadAllData();
  showToast("Paciente excluído logicamente.");
}

function renderPatientsList() {
  const search = ($("patientSearch").value || "").toLowerCase();
  const items = state.patients.filter((p) => p.full_name.toLowerCase().includes(search));
  $("patientsList").innerHTML = items.length ? items.map((p) => `
    <div class="item">
      <div>
        <strong>${escapeHTML(p.full_name)}</strong>
        <span>Status: ${escapeHTML(p.status || "ativo")} ${p.birth_date ? `• Nasc.: ${dateBR(p.birth_date)}` : ""}</span>
        <span>Responsável(is): ${escapeHTML(guardianNamesForPatient(p.id) || "não vinculado")}</span>
      </div>
      <div class="item-actions">
        <button class="outline" type="button" onclick="editPatient('${p.id}')">Editar</button>
        <button class="danger" type="button" onclick="deletePatient('${p.id}')">Excluir</button>
      </div>
    </div>`).join("") : '<div class="empty">Nenhum paciente encontrado.</div>';
}

async function saveGuardian(event) {
  event.preventDefault();
  const id = $("guardianId").value;
  const selectedPatients = Array.from($("guardianPatients").selectedOptions).map((o) => o.value);
  const payload = {
    full_name: $("guardianName").value.trim(),
    cpf: $("guardianCpf").value.trim() || null,
    email: $("guardianEmail").value.trim() || null,
    phone: $("guardianPhone").value.trim() || null,
    address: $("guardianAddress").value.trim() || null,
    relationship: $("guardianRelationship").value,
  };

  const button = event.submitter;
  setLoading(button, true);

  let guardianId = id;
  let error;
  if (id) {
    ({ error } = await sb.from("guardians").update(payload).eq("id", id));
  } else {
    const result = await sb.from("guardians").insert(payload).select("id").single();
    error = result.error;
    guardianId = result.data?.id;
  }

  if (!error && guardianId) {
    await sb.from("patient_guardians").update({ deleted_at: new Date().toISOString() }).eq("guardian_id", guardianId).is("deleted_at", null);
    if (selectedPatients.length) {
      const links = selectedPatients.map((patient_id) => ({ patient_id, guardian_id: guardianId }));
      const linkResult = await sb.from("patient_guardians").insert(links);
      error = linkResult.error;
    }
  }

  setLoading(button, false);
  if (error) return handleError(error, "Erro ao salvar responsável.");
  clearGuardianForm();
  await loadGuardians();
  await loadPatientGuardians();
  renderEverything();
  showToast("Responsável salvo!");
}

function editGuardian(id) {
  const g = state.guardians.find((x) => x.id === id);
  if (!g) return;
  $("guardianId").value = g.id;
  $("guardianName").value = g.full_name || "";
  $("guardianCpf").value = g.cpf || "";
  $("guardianEmail").value = g.email || "";
  $("guardianPhone").value = g.phone || "";
  $("guardianAddress").value = g.address || "";
  $("guardianRelationship").value = g.relationship || "outro";
  Array.from($("guardianPatients").options).forEach((opt) => {
    opt.selected = state.patientGuardians.some((l) => l.guardian_id === id && l.patient_id === opt.value);
  });
  $("guardianFormTitle").textContent = "Editar responsável";
  setScreen("guardiansScreen");
}

function clearGuardianForm() {
  $("guardianForm").reset();
  $("guardianId").value = "";
  $("guardianRelationship").value = "mãe";
  Array.from($("guardianPatients").options).forEach((opt) => opt.selected = false);
  $("guardianFormTitle").textContent = "Cadastrar responsável";
}

async function deleteGuardian(id) {
  if (!confirm("Tem certeza que deseja excluir este registro? Essa ação não poderá ser desfeita.")) return;
  const now = new Date().toISOString();
  let { error } = await sb.from("guardians").update({ deleted_at: now }).eq("id", id);
  if (!error) ({ error } = await sb.from("patient_guardians").update({ deleted_at: now }).eq("guardian_id", id).is("deleted_at", null));
  if (error) return handleError(error, "Erro ao excluir responsável.");
  await loadAllData();
  showToast("Responsável excluído logicamente.");
}

function renderGuardiansList() {
  const search = ($("guardianSearch").value || "").toLowerCase();
  const items = state.guardians.filter((g) => g.full_name.toLowerCase().includes(search));
  $("guardiansList").innerHTML = items.length ? items.map((g) => {
    const patientIds = state.patientGuardians.filter((l) => l.guardian_id === g.id).map((l) => l.patient_id);
    const patientNames = state.patients.filter((p) => patientIds.includes(p.id)).map((p) => p.full_name).join(", ");
    return `
      <div class="item">
        <div>
          <strong>${escapeHTML(g.full_name)}</strong>
          <span>${escapeHTML(g.relationship || "Responsável")} ${g.phone ? `• ${escapeHTML(g.phone)}` : ""} ${g.email ? `• ${escapeHTML(g.email)}` : ""}</span>
          <span>Paciente(s): ${escapeHTML(patientNames || "não vinculado")}</span>
        </div>
        <div class="item-actions">
          <button class="outline" type="button" onclick="editGuardian('${g.id}')">Editar</button>
          <button class="danger" type="button" onclick="deleteGuardian('${g.id}')">Excluir</button>
        </div>
      </div>`;
  }).join("") : '<div class="empty">Nenhum responsável encontrado.</div>';
}

function addSessionRow(session = {}) {
  const container = $("sessionsContainer");
  const index = container.children.length + 1;
  const row = document.createElement("div");
  row.className = "session-row";
  row.innerHTML = `
    <div class="num">${index}</div>
    <label>Data<input class="session-date" type="date" value="${session.date || ""}" /></label>
    <label>Início<input class="session-start" type="time" value="${session.start_time || ""}" /></label>
    <label>Fim<input class="session-end" type="time" value="${session.end_time || ""}" /></label>
    <label>Duração<input class="session-duration" type="text" value="${session.duration || "50 minutos"}" /></label>
    <label>Qtd.<input class="session-quantity" type="number" min="1" step="1" value="${session.quantity || 1}" /></label>
    <label>Tipo/observação<input class="session-type" type="text" value="${escapeHTML(session.type || "Atendimento")}" /></label>
    <button class="danger" type="button" title="Remover">×</button>
  `;
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    renumberSessions();
    calculateRecordTotals();
  });
  row.querySelectorAll("input").forEach((input) => input.addEventListener("input", calculateRecordTotals));
  container.appendChild(row);
  calculateRecordTotals();
}

function renumberSessions() {
  Array.from($("sessionsContainer").children).forEach((row, i) => row.querySelector(".num").textContent = i + 1);
}

function getSessions() {
  return Array.from($("sessionsContainer").children).map((row) => ({
    date: row.querySelector(".session-date").value || null,
    start_time: row.querySelector(".session-start").value || null,
    end_time: row.querySelector(".session-end").value || null,
    duration: row.querySelector(".session-duration").value.trim() || null,
    quantity: Number(row.querySelector(".session-quantity").value || 1),
    type: row.querySelector(".session-type").value.trim() || null,
  })).filter((s) => s.date || s.type);
}

function sessionsSummary(sessions) {
  const map = new Map();
  sessions.forEach((s) => {
    if (!s.date) return;
    map.set(s.date, (map.get(s.date) || 0) + Number(s.quantity || 1));
  });
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, qtd]) => qtd > 1 ? `${dateBR(date)} (${qtd} sessões)` : dateBR(date)).join(", ");
}

function calculateRecordTotals() {
  const sessions = getSessions();
  const totalSessions = sessions.reduce((sum, s) => sum + Number(s.quantity || 1), 0);
  const sessionValue = Number($("recordSessionValue").value || 0);
  $("totalSessionsLabel").textContent = totalSessions;
  $("totalValueLabel").textContent = money(totalSessions * sessionValue);
  $("datesSummaryLabel").textContent = sessionsSummary(sessions) || "-";
}

function buildNfDescriptionFromForm() {
  const patient = state.patients.find((p) => p.id === $("recordPatient").value);
  const settings = getSettingsSafe();
  const sessions = getSessions();
  const totalSessions = sessions.reduce((sum, s) => sum + Number(s.quantity || 1), 0);
  const service = $("recordServiceModality").value;
  const month = Number($("recordMonth").value);
  const year = $("recordYear").value;
  const dates = sessionsSummary(sessions);
  const registry = settings.professional_registry ? `, ${settings.professional_registry}` : "";

  return `Serviço de ${service}, referente aos atendimentos realizados ao(à) paciente/beneficiário(a) ${patient?.full_name || "[nome do paciente]"}, no mês de ${monthYearText(month, year)}, nas seguintes datas: ${dates || "[datas dos atendimentos]"}, totalizando ${totalSessions} sessão(ões), com a profissional ${settings.professional_name || "[nome da profissional]"}${registry}.`;
}

function clearRecordForm() {
  $("recordForm").reset();
  $("recordId").value = "";
  $("recordFormTitle").textContent = "Nova Ficha Financeira";
  $("recordUpdatedLabel").textContent = "";
  $("recordYear").value = currentYear();
  $("recordIssueDate").value = todayISO();
  $("recordStatus").value = "aguardando_pagamento";
  $("sessionsContainer").innerHTML = "";
  addSessionRow();
  renderGuardianOptions();
  calculateRecordTotals();
}

function recordPayloadFromForm() {
  const sessions = getSessions();
  const totalSessions = sessions.reduce((sum, s) => sum + Number(s.quantity || 1), 0);
  const sessionValue = Number($("recordSessionValue").value || 0);
  return {
    patient_id: $("recordPatient").value || null,
    guardian_id: $("recordGuardian").value || null,
    reference_month: Number($("recordMonth").value),
    reference_year: Number($("recordYear").value),
    service_modality: $("recordServiceModality").value,
    care_location: $("recordCareLocation").value,
    session_value: sessionValue,
    sessions,
    total_sessions: totalSessions,
    total_value: totalSessions * sessionValue,
    payment_method: $("recordPaymentMethod").value,
    issue_date: $("recordIssueDate").value || null,
    due_date: $("recordDueDate").value || null,
    payment_link: $("recordPaymentLink").value.trim() || null,
    nf_description: $("recordNfDescription").value.trim() || buildNfDescriptionFromForm(),
    admin_notes: $("recordAdminNotes").value.trim() || null,
    status: $("recordStatus").value,
  };
}

async function saveFinancialRecord(event) {
  event.preventDefault();
  const id = $("recordId").value;
  const payload = recordPayloadFromForm();
  if (!payload.patient_id) return showToast("Selecione um paciente.", "error");
  if (!payload.reference_month || !payload.reference_year) return showToast("Informe mês e ano.", "error");

  const button = event.submitter;
  setLoading(button, true);
  const { data, error } = id
    ? await sb.from("financial_records").update(payload).eq("id", id).select().single()
    : await sb.from("financial_records").insert(payload).select().single();
  setLoading(button, false);

  if (error) return handleError(error, "Erro ao salvar ficha.");
  $("recordId").value = data.id;
  $("recordFormTitle").textContent = "Editar Ficha Financeira";
  $("recordUpdatedLabel").textContent = `Salvo em ${new Date(data.updated_at || data.created_at).toLocaleString("pt-BR")}`;
  await loadFinancialRecords();
  renderEverything();
  showToast("Ficha financeira salva!");
}

function editRecord(id) {
  const r = state.records.find((x) => x.id === id);
  if (!r) return;
  $("recordId").value = r.id;
  $("recordPatient").value = r.patient_id || "";
  renderGuardianOptions(r.patient_id);
  $("recordGuardian").value = r.guardian_id || "";
  $("recordMonth").value = r.reference_month || "";
  $("recordYear").value = r.reference_year || currentYear();
  $("recordSessionValue").value = r.session_value || "";
  $("recordServiceModality").value = r.service_modality || "Psicologia";
  $("recordCareLocation").value = r.care_location || "Domiciliar";
  $("recordPaymentMethod").value = r.payment_method || "PIX";
  $("recordIssueDate").value = r.issue_date || "";
  $("recordDueDate").value = r.due_date || "";
  $("recordPaymentLink").value = r.payment_link || "";
  $("recordNfDescription").value = r.nf_description || "";
  $("recordAdminNotes").value = r.admin_notes || "";
  $("recordStatus").value = r.status || "aguardando_pagamento";
  $("sessionsContainer").innerHTML = "";
  (r.sessions || []).forEach(addSessionRow);
  if (!r.sessions || !r.sessions.length) addSessionRow();
  $("recordFormTitle").textContent = "Editar Ficha Financeira";
  $("recordUpdatedLabel").textContent = r.updated_at ? `Atualizado em ${new Date(r.updated_at).toLocaleString("pt-BR")}` : "";
  calculateRecordTotals();
  setScreen("financialFormScreen");
}

async function deleteRecord(id) {
  if (!confirm("Tem certeza que deseja excluir este registro? Essa ação não poderá ser desfeita.")) return;
  const { error } = await sb.from("financial_records").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return handleError(error, "Erro ao excluir ficha.");
  await loadFinancialRecords();
  renderEverything();
  showToast("Ficha excluída logicamente.");
}

function renderRecordsList() {
  const patientId = $("filterPatient").value;
  const guardianId = $("filterGuardian").value;
  const month = $("filterMonth").value;
  const year = $("filterYear").value;
  const search = ($("filterSearch").value || "").toLowerCase();

  let items = state.records.filter((r) => {
    const patientName = r.patients?.full_name || state.patients.find((p) => p.id === r.patient_id)?.full_name || "";
    return (!patientId || r.patient_id === patientId) &&
      (!guardianId || r.guardian_id === guardianId) &&
      (!month || Number(r.reference_month) === Number(month)) &&
      (!year || Number(r.reference_year) === Number(year)) &&
      (!search || patientName.toLowerCase().includes(search));
  });

  $("recordsList").innerHTML = items.length ? items.map((r) => {
    const patientName = r.patients?.full_name || state.patients.find((p) => p.id === r.patient_id)?.full_name || "Paciente";
    const guardianName = r.guardians?.full_name || state.guardians.find((g) => g.id === r.guardian_id)?.full_name || "-";
    return `
      <div class="item">
        <div>
          <strong>${escapeHTML(patientName)}</strong>
          <span>${monthYearText(r.reference_month, r.reference_year)} • ${escapeHTML(r.service_modality || "")} • ${escapeHTML(r.care_location || "")}</span>
          <span>Responsável: ${escapeHTML(guardianName)} • Status: ${formatStatus(r.status)}</span>
        </div>
        <div>
          <strong>${money(r.total_value)}</strong>
          <span>${r.total_sessions || 0} sessão(ões)</span>
        </div>
        <div class="item-actions">
          <button class="outline" type="button" onclick="editRecord('${r.id}')">Editar</button>
          <button class="success" type="button" onclick="openPdfForRecord('${r.id}')">PDF</button>
          <button class="danger" type="button" onclick="deleteRecord('${r.id}')">Excluir</button>
        </div>
      </div>`;
  }).join("") : '<div class="empty">Nenhuma ficha encontrada.</div>';
}

function formatStatus(status) {
  const map = {
    aguardando_pagamento: "Aguardando pagamento",
    pago: "Pago",
    nf_emitida: "Nota Fiscal emitida",
    cancelado: "Cancelado",
  };
  return map[status] || status || "";
}

function getSettingsSafe() {
  return state.settings || {
    clinic_name: "Clínica ÚNick",
    professional_name: "Nicolly Sperandio Silveira",
    professional_title: "Psicóloga",
    professional_registry: "CRP-12/21411",
    cnpj: "51.291.241/0001-78",
    phone: "(48) 9.8493-1775",
    email: "nicollysilveiraa@hotmail.com",
    bank_name: "Bradesco",
    bank_agency: "0341-6",
    bank_account: "0033301-8",
    bank_account_name: "Neuro Brilhar Psicologia",
    pix_phone: "48984931775",
    pix_email: "nicollysilveiraa@hotmail.com",
    pix_cnpj: "51.291.241/0001-78",
    default_notes: "Após o pagamento, envie o comprovante para emissão da Nota Fiscal.",
  };
}

function buildPdfHTML(record) {
  const settings = getSettingsSafe();
  const patient = state.patients.find((p) => p.id === record.patient_id) || record.patients || {};
  const guardian = state.guardians.find((g) => g.id === record.guardian_id) || record.guardians || {};
  const sessions = record.sessions || [];

  const rows = sessions.length ? sessions.map((s, i) => `
    <tr>
      <td style="text-align:center"><strong>${i + 1}</strong></td>
      <td><strong>${dateBR(s.date)}</strong><br>${escapeHTML([s.start_time, s.end_time].filter(Boolean).join(" às "))}<br>${s.duration ? `(${escapeHTML(s.duration)})` : ""}${Number(s.quantity || 1) > 1 ? `<br><strong>Qtd.: ${s.quantity}</strong>` : ""}</td>
      <td>${escapeHTML(s.type || record.service_modality || "Atendimento")}</td>
    </tr>`).join("") : '<tr><td colspan="3">Sem sessões cadastradas.</td></tr>';

  return `
    <div class="pdf-title">
      ${settings.logo_url ? `<img src="${escapeHTML(settings.logo_url)}" class="pdf-logo" crossorigin="anonymous" />` : ""}
      <h1>FICHA DE FREQUÊNCIA E FINANCEIRO</h1>
    </div>

    <p><strong>Clínica:</strong> ${escapeHTML(settings.clinic_name || "")}<br>
    <strong>Profissional:</strong> ${escapeHTML(settings.professional_name || "")} | ${escapeHTML(settings.professional_title || "")} | ${escapeHTML(settings.professional_registry || "")}<br>
    <strong>CNPJ:</strong> ${escapeHTML(settings.cnpj || "")}<br>
    <strong>Contato:</strong> ${escapeHTML(settings.phone || "")} ${settings.email ? `| ${escapeHTML(settings.email)}` : ""}<br>
    <strong>Paciente:</strong> ${escapeHTML(patient.full_name || "")}<br>
    <strong>Responsável:</strong> ${escapeHTML(guardian.full_name || "")}<br>
    <strong>Período de referência:</strong> ${escapeHTML(monthYearText(record.reference_month, record.reference_year))}</p>

    <table class="pdf-table">
      <thead><tr><th style="width:60px">Nº</th><th>Data, horário e duração</th><th>Tipo de atendimento</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="pdf-table">
      <tr><td><strong>Quantidade total de sessões</strong></td><td>${record.total_sessions || 0}</td></tr>
      <tr><td><strong>Valor por sessão</strong></td><td>${money(record.session_value)}</td></tr>
      <tr><td><strong>Valor total</strong></td><td><strong>${money(record.total_value)}</strong></td></tr>
      <tr><td><strong>Forma de pagamento</strong></td><td>${escapeHTML(record.payment_method || "")}</td></tr>
      <tr><td><strong>Data de emissão/envio</strong></td><td>${dateBR(record.issue_date)}</td></tr>
      <tr><td><strong>Vencimento</strong></td><td>${dateBR(record.due_date)}</td></tr>
    </table>

    <div class="pdf-payments">
      <div>
        <h3>Transferência Bancária</h3>
        <p>Banco: ${escapeHTML(settings.bank_name || "")}<br>
        Agência: ${escapeHTML(settings.bank_agency || "")}<br>
        Conta: ${escapeHTML(settings.bank_account || "")}<br>
        Nome da conta: ${escapeHTML(settings.bank_account_name || "")}</p>
      </div>
      <div>
        <h3>PIX</h3>
        <p>Telefone: ${escapeHTML(settings.pix_phone || "")}<br>
        E-mail: ${escapeHTML(settings.pix_email || "")}<br>
        CNPJ: ${escapeHTML(settings.pix_cnpj || "")}</p>
      </div>
    </div>

    ${record.payment_link ? `<p><strong>Link de pagamento:</strong><br><a class="pdf-link" href="${escapeHTML(record.payment_link)}">${escapeHTML(record.payment_link)}</a></p>` : ""}

    <h3>Descrição da Nota Fiscal</h3>
    <p>${nl2br(record.nf_description || "")}</p>

    ${record.admin_notes ? `<h3>Observações administrativas</h3><p>${nl2br(record.admin_notes)}</p>` : ""}
    ${settings.default_notes ? `<p class="muted">${nl2br(settings.default_notes)}</p>` : ""}

    <div class="pdf-sign">
      <p>____________________________________<br>
      ${escapeHTML(settings.professional_title || "Profissional")}<br>
      ${escapeHTML(settings.professional_name || "")}<br>
      ${escapeHTML(settings.professional_registry || "")}</p>
    </div>
  `;
}

function openPdfForRecord(id = null) {
  let record = id ? state.records.find((r) => r.id === id) : null;
  if (!record) {
    record = recordPayloadFromForm();
    record.patient_id = $("recordPatient").value;
    record.guardian_id = $("recordGuardian").value;
  }
  state.activeRecordForPdf = record;
  $("pdfArea").innerHTML = buildPdfHTML(record);
  $("pdfModal").classList.remove("hidden");
}

function downloadPdf() {
  const record = state.activeRecordForPdf;
  const patient = state.patients.find((p) => p.id === record?.patient_id)?.full_name || "ficha-financeira";
  const fileName = `${patient.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${record?.reference_month || "mes"}-${record?.reference_year || "ano"}.pdf`;
  html2pdf().set({
    margin: [10, 10, 10, 10],
    filename: fileName,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  }).from($("pdfArea")).save();
}

function renderSettingsForm() {
  const s = getSettingsSafe();
  const map = {
    settingClinicName: "clinic_name",
    settingProfessionalName: "professional_name",
    settingProfessionalTitle: "professional_title",
    settingProfessionalRegistry: "professional_registry",
    settingCnpj: "cnpj",
    settingPhone: "phone",
    settingEmail: "email",
    settingAddress: "address",
    settingBankName: "bank_name",
    settingBankAgency: "bank_agency",
    settingBankAccount: "bank_account",
    settingBankAccountName: "bank_account_name",
    settingPixPhone: "pix_phone",
    settingPixEmail: "pix_email",
    settingPixCnpj: "pix_cnpj",
    settingDefaultNfText: "default_nf_text",
    settingDefaultNotes: "default_notes",
    settingLogoUrl: "logo_url",
  };
  Object.entries(map).forEach(([input, key]) => { if ($(input)) $(input).value = s[key] || ""; });
}

async function saveSettings(event) {
  event.preventDefault();
  const payload = {
    clinic_name: $("settingClinicName").value.trim() || null,
    professional_name: $("settingProfessionalName").value.trim() || null,
    professional_title: $("settingProfessionalTitle").value.trim() || null,
    professional_registry: $("settingProfessionalRegistry").value.trim() || null,
    cnpj: $("settingCnpj").value.trim() || null,
    phone: $("settingPhone").value.trim() || null,
    email: $("settingEmail").value.trim() || null,
    address: $("settingAddress").value.trim() || null,
    bank_name: $("settingBankName").value.trim() || null,
    bank_agency: $("settingBankAgency").value.trim() || null,
    bank_account: $("settingBankAccount").value.trim() || null,
    bank_account_name: $("settingBankAccountName").value.trim() || null,
    pix_phone: $("settingPixPhone").value.trim() || null,
    pix_email: $("settingPixEmail").value.trim() || null,
    pix_cnpj: $("settingPixCnpj").value.trim() || null,
    default_nf_text: $("settingDefaultNfText").value.trim() || null,
    default_notes: $("settingDefaultNotes").value.trim() || null,
    logo_url: $("settingLogoUrl").value.trim() || null,
  };

  const button = event.submitter;
  setLoading(button, true);
  const { error } = await sb.from("clinic_settings").upsert(payload, { onConflict: "user_id" });
  setLoading(button, false);
  if (error) return handleError(error, "Erro ao salvar configurações.");
  await loadSettings();
  showToast("Configurações salvas!");
}

function attachEvents() {
  $("loginTabBtn").addEventListener("click", () => {
    $("loginTabBtn").classList.add("active");
    $("signupTabBtn").classList.remove("active");
    $("loginForm").classList.remove("hidden");
    $("signupForm").classList.add("hidden");
  });
  $("signupTabBtn").addEventListener("click", () => {
    $("signupTabBtn").classList.add("active");
    $("loginTabBtn").classList.remove("active");
    $("signupForm").classList.remove("hidden");
    $("loginForm").classList.add("hidden");
  });
  $("loginForm").addEventListener("submit", signIn);
  $("signupForm").addEventListener("submit", signUp);
  $("logoutBtn").addEventListener("click", signOut);
  document.querySelectorAll(".menu-btn").forEach((btn) => btn.addEventListener("click", () => setScreen(btn.dataset.screen)));

  $("patientForm").addEventListener("submit", savePatient);
  $("clearPatientBtn").addEventListener("click", clearPatientForm);
  $("patientSearch").addEventListener("input", renderPatientsList);

  $("guardianForm").addEventListener("submit", saveGuardian);
  $("clearGuardianBtn").addEventListener("click", clearGuardianForm);
  $("guardianSearch").addEventListener("input", renderGuardiansList);

  $("recordForm").addEventListener("submit", saveFinancialRecord);
  $("newRecordBtn").addEventListener("click", clearRecordForm);
  $("addSessionBtn").addEventListener("click", () => addSessionRow());
  $("recordSessionValue").addEventListener("input", calculateRecordTotals);
  $("recordPatient").addEventListener("change", () => renderGuardianOptions($("recordPatient").value));
  $("generateNfDescriptionBtn").addEventListener("click", () => { $("recordNfDescription").value = buildNfDescriptionFromForm(); showToast("Descrição gerada!"); });
  $("copyNfDescriptionBtn").addEventListener("click", async () => { await navigator.clipboard.writeText($("recordNfDescription").value); showToast("Descrição copiada!"); });
  $("previewPdfBtn").addEventListener("click", () => openPdfForRecord());

  ["filterPatient", "filterGuardian", "filterMonth", "filterYear", "filterSearch"].forEach((id) => $(id).addEventListener("input", renderRecordsList));
  $("refreshRecordsBtn").addEventListener("click", async () => { await loadFinancialRecords(); renderRecordsList(); showToast("Lista atualizada!"); });

  $("settingsForm").addEventListener("submit", saveSettings);
  $("closePdfModalBtn").addEventListener("click", () => $("pdfModal").classList.add("hidden"));
  $("downloadPdfBtn").addEventListener("click", downloadPdf);
}

window.editPatient = editPatient;
window.deletePatient = deletePatient;
window.editGuardian = editGuardian;
window.deleteGuardian = deleteGuardian;
window.editRecord = editRecord;
window.deleteRecord = deleteRecord;
window.openPdfForRecord = openPdfForRecord;

(function init() {
  attachEvents();
  initStaticSelects();
  addSessionRow();
  clearPatientForm();
  clearGuardianForm();
  if (!CONFIG_OK) $("configAlert").classList.remove("hidden");
  checkSession();
})();
