// Display helpers. Dates from PostgreSQL DATE columns arrive as plain "YYYY-MM-DD" strings.

export const CURRENCY = "INR"; // change to "INR" etc. to switch the currency shown everywhere

export function money(value) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function parseDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function fmtDate(value) {
  if (!value) return "—";
  const d = parseDay(value) ?? new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtMonth(value) {
  if (!value) return "—";
  const d = parseDay(value) ?? new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function pad(n) {
  return String(n).padStart(2, "0");
}

// Today as YYYY-MM-DD in the browser's local time zone
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonth() {
  return today().slice(0, 7);
}

export function addYears(isoDate, years) {
  const d = parseDay(isoDate) ?? new Date();
  d.setFullYear(d.getFullYear() + years);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A payment that is still 'Pending' after its due date is shown as 'Overdue' (FR4.3).
// The database trigger flags it when a row is written; this keeps the screen right in between.
export function paymentStatus(payment) {
  const status = payment.payment_status ?? payment.status;
  if (status === "Pending" && payment.due_date && payment.due_date < today()) return "Overdue";
  return status;
}

export const PRIORITY_WEIGHT = { High: 0, Medium: 1, Low: 2 };
