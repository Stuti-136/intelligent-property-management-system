// Browser-side helper for calling our own API routes.
// Throws an Error (with .status) whose message is the server's error text.

export async function api(path, { method = "GET", body, formData } = {}) {
  const options = { method, headers: {}, credentials: "same-origin" };

  if (formData) {
    options.body = formData; // the browser sets the multipart boundary itself
  } else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error("Could not reach the server. Check that it is running.");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }

  if (!res.ok) {
    const isAuthCall = path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register");
    if (res.status === 401 && !isAuthCall && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Downloads a lease PDF. Uses fetch so a missing file shows a message instead of a JSON page.
export async function downloadLease(documentId, fallbackName = "lease.pdf") {
  const res = await fetch(`/api/lease/${documentId}`, { credentials: "same-origin" });
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
