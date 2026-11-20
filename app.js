const STORAGE_KEY = "pocket-finance-v1";
const colors = ["#4c936d", "#e6a862", "#87bcb1", "#d57f69", "#c3d6a5", "#9d8bb7", "#6f9fb4", "#d5a5a4"];
const categories = ["Housing", "Food", "Transport", "Utilities", "Health", "Entertainment", "Shopping", "Savings", "Salary", "Other"];
const categoryIcons = {
  Housing: "⌂", Food: "♨", Transport: "↗", Utilities: "ϟ", Health: "✚",
  Entertainment: "♫", Shopping: "▣", Savings: "✳", Salary: "↙", Other: "·"
};
const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const starterData = {
  transactions: [
    { id: "starter-1", type: "expense", amount: 1250, category: "Housing", note: "Monthly rent", date: daysAgo(1) },
    { id: "starter-2", type: "expense", amount: 86.4, category: "Food", note: "Weekly groceries", date: daysAgo(2) },
    { id: "starter-3", type: "income", amount: 4200, category: "Salary", note: "Monthly salary", date: daysAgo(4) },
    { id: "starter-4", type: "expense", amount: 34.5, category: "Transport", note: "Metro card", date: daysAgo(5) },
    { id: "starter-5", type: "expense", amount: 62.18, category: "Utilities", note: "Electricity bill", date: daysAgo(7) },
    { id: "starter-6", type: "expense", amount: 45, category: "Entertainment", note: "Movie night", date: daysAgo(9) },
    { id: "starter-7", type: "expense", amount: 28.9, category: "Food", note: "Lunch with Alex", date: daysAgo(11) },
    { id: "starter-8", type: "expense", amount: 120, category: "Shopping", note: "New running shoes", date: daysAgo(13) }
  ],
  budgets: { Housing: 1500, Food: 500, Transport: 250, Utilities: 200, Entertainment: 180 },
  balance: 6842.5,
  theme: "light"
};

function loadData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.transactions) && stored.budgets) {
      return { ...starterData, ...stored };
    }
  } catch (error) {
    console.warn("Saved Pocket data could not be read; starting with sample data.", error);
  }
  return structuredClone(starterData);
}

let data = loadData();
let activeType = "expense";
let editingId = null;
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const selectedMonth = () => $("#month-picker").value || currentMonth;

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Could not save Pocket data in this browser.", error);
    showToast("Your changes could not be saved in this browser.");
  }
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function monthTransactions() {
  return data.transactions.filter((transaction) => transaction.date.slice(0, 7) === selectedMonth());
}

function sum(items, type) {
  return items.filter((item) => item.type === type).reduce((total, item) => total + Math.round(item.amount * 100), 0) / 100;
}

function renderSummary(transactions) {
  const income = sum(transactions, "income");
  const expenses = sum(transactions, "expense");
  const savings = income - expenses;
  const [year, month] = selectedMonth().split("-").map(Number);
  const previousDate = new Date(year, month - 2, 1);
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
  const previousTransactions = data.transactions.filter((item) => item.date.slice(0, 7) === previousMonth);
  const previousIncome = sum(previousTransactions, "income");
  const previousExpenses = sum(previousTransactions, "expense");
  const starterNet = sum(starterData.transactions, "income") - sum(starterData.transactions, "expense");
  const allTransactionsNet = sum(data.transactions, "income") - sum(data.transactions, "expense");
  $("#income-total").textContent = money(income);
  $("#expense-total").textContent = money(expenses);
  $("#savings-total").textContent = money(savings);
  $("#balance-total").textContent = money(data.balance - starterNet + allTransactionsNet);
  $("#savings-foot").textContent = savings >= 0 ? "Keep it up this month" : "Spending is above income";
  $("#balance-foot").textContent = `As of ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(today)}`;
  updateTrend("#income-trend", income, previousIncome, true);
  updateTrend("#expense-trend", expenses, previousExpenses, false);
}

function updateTrend(selector, current, previous, higherIsBetter) {
  const element = $(selector);
  if (!previous) {
    element.textContent = current ? "New this month" : "No prior data";
    element.className = "trend-pill neutral";
    return;
  }
  const change = Math.round((current - previous) / previous * 100);
  const increased = change >= 0;
  const positive = increased === higherIsBetter;
  element.textContent = `${increased ? "↗" : "↘"} ${Math.abs(change)}%`;
  element.className = `trend-pill ${positive ? "positive" : "negative"}`;
}

function renderSpending(transactions) {
  const expenses = transactions.filter((item) => item.type === "expense");
  const totals = {};
  expenses.forEach((item) => { totals[item.category] = (totals[item.category] || 0) + item.amount; });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = expenses.reduce((result, item) => result + item.amount, 0);
  $("#donut-total").textContent = total >= 1000 ? `$${(total / 1000).toFixed(1)}k` : money(total);
  const chart = $("#donut-chart");
  if (!total) {
    chart.style.background = "conic-gradient(#e8eee8 0 100%)";
    chart.setAttribute("aria-label", "No spending this month");
  } else {
    let cursor = 0;
    const stops = sorted.map(([, amount], index) => {
      const start = cursor;
      cursor += amount / total * 100;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    });
    chart.style.background = `conic-gradient(${stops.join(", ")})`;
    chart.setAttribute("aria-label", `Spending by category, total ${money(total)}`);
  }
  const top = sorted.slice(0, 6);
  $("#category-legend").innerHTML = top.length
    ? top.map(([name, amount], index) => `<div class="legend-item"><span class="legend-dot" style="background:${colors[index % colors.length]}"></span><span class="legend-name">${escapeHtml(name)}</span><span class="legend-amount">${money(amount)}</span></div>`).join("")
    : '<div class="legend-empty">Add an expense to see your breakdown.</div>';
}

function renderBudgets(transactions) {
  const expenses = {};
  transactions.filter((item) => item.type === "expense").forEach((item) => {
    expenses[item.category] = (expenses[item.category] || 0) + item.amount;
  });
  const list = Object.entries(data.budgets);
  $("#budget-list").innerHTML = list.length ? list.map(([category, budget]) => {
    const spent = expenses[category] || 0;
    const percent = budget > 0 ? spent / budget * 100 : 0;
    const state = percent >= 100 ? "over" : percent >= 80 ? "warning" : "";
    return `<div class="budget-row">
      <div class="budget-name"><span class="budget-symbol">${categoryIcons[category] || "·"}</span>${escapeHtml(category)}</div>
      <div class="budget-numbers"><strong>${money(spent)}</strong> / ${money(budget)}</div>
      <div class="progress-track" role="progressbar" aria-label="${escapeHtml(category)} budget used" aria-valuenow="${Math.min(Math.round(percent), 100)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill ${state}" style="width:${Math.min(percent, 100)}%"></div></div>
    </div>`;
  }).join("") : '<p class="legend-empty">No budgets yet. Add one to keep spending on track.</p>';
  const overBudget = list.filter(([category, budget]) => (expenses[category] || 0) >= budget).length;
  $("#budget-tip").textContent = overBudget ? `${overBudget} ${overBudget === 1 ? "category is" : "categories are"} over budget. Take a quick look.` : "A little planning goes a long way.";
}

function renderCategoryOptions() {
  $("#category-filter").innerHTML = '<option value="">All categories</option>' +
    categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  $("#form-category").innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
}

function renderTransactions() {
  const query = $("#transaction-search").value.trim().toLowerCase();
  const category = $("#category-filter").value;
  const items = monthTransactions().filter((item) => {
    const matchesText = !query || `${item.note} ${item.category} ${item.amount}`.toLowerCase().includes(query);
    return matchesText && (!category || item.category === category);
  }).sort((a, b) => b.date.localeCompare(a.date));
  const rows = $("#transaction-rows");
  $("#empty-transactions").classList.toggle("hidden", items.length > 0);
  rows.closest("table").classList.toggle("hidden", items.length === 0);
  $("#transaction-count").textContent = `Showing ${items.length} transaction${items.length === 1 ? "" : "s"}`;
  rows.innerHTML = items.slice(0, 10).map((item) => {
    const categoryClass = item.category.toLowerCase().replace(/[^a-z]/g, "");
    const name = item.note || item.category;
    const amountPrefix = item.type === "income" ? "+" : "−";
    return `<tr>
      <td><div class="transaction-name"><span class="transaction-icon ${categoryClass}">${categoryIcons[item.category] || "·"}</span><span class="transaction-copy"><strong>${escapeHtml(name)}</strong><span>${item.type === "income" ? "Income" : "Expense"}</span></span></div></td>
      <td><span class="category-tag">${escapeHtml(item.category)}</span></td>
      <td>${formatDate(item.date)}</td>
      <td class="${item.type === "income" ? "amount-income" : ""}">${amountPrefix}${money(item.amount)}</td>
      <td><div class="row-actions"><button class="row-action" data-edit="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(name)}">✎</button><button class="row-action delete" data-delete="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(name)}">×</button></div></td>
    </tr>`;
  }).join("");
}

function render() {
  const transactions = monthTransactions();
  renderSummary(transactions);
  renderSpending(transactions);
  renderBudgets(transactions);
  renderTransactions();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2800);
}

function openModal(transaction) {
  editingId = transaction ? transaction.id : null;
  activeType = transaction ? transaction.type : "expense";
  $("#modal-title").textContent = transaction ? "Edit transaction" : "Add a transaction";
  $("#save-transaction").textContent = transaction ? "Save changes" : "Save transaction";
  $("#amount-input").value = transaction ? transaction.amount : "";
  const availableCategories = activeType === "income" ? ["Salary", "Other"] : categories.filter((category) => category !== "Salary");
  $("#form-category").innerHTML = availableCategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  $("#form-category").value = transaction && availableCategories.includes(transaction.category)
    ? transaction.category
    : activeType === "income" ? "Salary" : "Food";
  $("#date-input").value = transaction ? transaction.date : today.toISOString().slice(0, 10);
  $("#note-input").value = transaction ? transaction.note : "";
  $("#form-error").classList.add("hidden");
  document.querySelectorAll(".type-option").forEach((button) => button.classList.toggle("selected", button.dataset.type === activeType));
  $("#transaction-modal").classList.remove("hidden");
  $("#amount-input").focus();
}

function closeModal() {
  $("#transaction-modal").classList.add("hidden");
  editingId = null;
}

$("#month-picker").value = currentMonth;
$("#today-label").textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(today).toUpperCase() + " AT A GLANCE";
if (data.theme === "dark") document.body.classList.add("dark");
renderCategoryOptions();
render();

$("#open-add").addEventListener("click", () => openModal());
$("#empty-add").addEventListener("click", () => openModal());
$("#close-modal").addEventListener("click", closeModal);
$("#cancel-modal").addEventListener("click", closeModal);
$("#transaction-modal").addEventListener("click", (event) => {
  if (event.target === $("#transaction-modal")) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#transaction-modal").classList.contains("hidden")) closeModal();
});
document.querySelectorAll(".type-option").forEach((button) => {
  button.addEventListener("click", () => {
    activeType = button.dataset.type;
    document.querySelectorAll(".type-option").forEach((option) => option.classList.toggle("selected", option === button));
    const options = activeType === "income" ? ["Salary", "Other"] : categories.filter((category) => category !== "Salary");
    const currentCategory = $("#form-category").value;
    $("#form-category").innerHTML = options.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    $("#form-category").value = options.includes(currentCategory) ? currentCategory : options[0];
  });
});
$("#transaction-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number($("#amount-input").value);
  const date = $("#date-input").value;
  const error = $("#form-error");
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8) {
    error.textContent = "Enter an amount greater than zero with no more than two decimal places.";
    error.classList.remove("hidden");
    return;
  }
  if (!date) {
    error.textContent = "Choose a date for this transaction.";
    error.classList.remove("hidden");
    return;
  }
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  if (new Date(`${date}T00:00:00`) > maxDate) {
    error.textContent = "The date cannot be more than one year in the future.";
    error.classList.remove("hidden");
    return;
  }
  const transaction = {
    id: editingId || (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    type: activeType,
    amount: Math.round(amount * 100) / 100,
    date,
    category: $("#form-category").value,
    note: $("#note-input").value.trim()
  };
  if (editingId) data.transactions = data.transactions.map((item) => item.id === editingId ? transaction : item);
  else data.transactions.push(transaction);
  saveData();
  closeModal();
  render();
  showToast(editingId ? "Transaction updated." : "Transaction added.");
});
$("#month-picker").addEventListener("change", render);
$("#transaction-search").addEventListener("input", renderTransactions);
$("#category-filter").addEventListener("change", renderTransactions);
$("#transaction-rows").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (editButton) {
    const transaction = data.transactions.find((item) => item.id === editButton.dataset.edit);
    if (transaction) openModal(transaction);
  }
  if (deleteButton) {
    const transaction = data.transactions.find((item) => item.id === deleteButton.dataset.delete);
    if (transaction && window.confirm(`Delete "${transaction.note || transaction.category}"?`)) {
      data.transactions = data.transactions.filter((item) => item.id !== transaction.id);
      saveData();
      render();
      showToast("Transaction deleted.");
    }
  }
});
$("#export-csv").addEventListener("click", () => {
  const items = monthTransactions().sort((a, b) => b.date.localeCompare(a.date));
  const rows = [["Date", "Type", "Category", "Amount", "Note"], ...items.map((item) => [item.date, item.type, item.category, item.amount.toFixed(2), item.note])];
  const csv = rows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `pocket-transactions-${selectedMonth()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Your CSV export is ready.");
});
$("#edit-budgets").addEventListener("click", () => {
  const category = window.prompt(`Which category? ${categories.join(", ")}`, "Food");
  if (category === null) return;
  const normalizedCategory = categories.find((item) => item.toLowerCase() === category.trim().toLowerCase());
  if (!normalizedCategory) {
    showToast("Choose one of the listed categories.");
    return;
  }
  const next = window.prompt(`Set a monthly ${normalizedCategory} budget (USD):`, String(data.budgets[normalizedCategory] || ""));
  if (next === null) return;
  const amount = Number(next);
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
    showToast("Enter a budget greater than zero with up to two decimals.");
    return;
  }
  data.budgets[normalizedCategory] = amount;
  saveData();
  render();
  showToast("Food budget updated.");
});
$("#view-all-categories").addEventListener("click", () => {
  $("#transaction-search").focus();
  $("#transactions-section").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#show-all").addEventListener("click", () => {
  $("#transaction-search").focus();
  $("#transactions-section").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#theme-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  data.theme = document.body.classList.contains("dark") ? "dark" : "light";
  saveData();
});
document.querySelectorAll(".nav-item").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const label = link.textContent.trim();
    if (label === "Transactions") $("#transactions-section").scrollIntoView({ behavior: "smooth", block: "start" });
    else if (label === "Budgets") $("#edit-budgets").scrollIntoView({ behavior: "smooth", block: "center" });
    else if (label !== "Overview") showToast(`${label} will be available in a future update.`);
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item === link);
      if (item === link) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    $("#current-page").textContent = label;
  });
});
