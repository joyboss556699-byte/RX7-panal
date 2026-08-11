const pages = [
  "dashboard",
  "getnum",
  "console",
  "profile",
  "admin"
];

function show(id) {
  pages.forEach(page => {
    document
      .getElementById(page)
      .classList.toggle("hidden", page !== id);
  });

  if (id === "dashboard") loadDashboard();
  if (id === "console") loadConsole();
  if (id === "profile") loadProfile();
  if (id === "admin") loadAdmin();
}

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

async function loadDashboard() {
  try {
    const data = await api("/api/dashboard");

    document.getElementById("active").textContent =
      data.providers.filter(p => p.enabled).length;

    document.getElementById("orders").textContent =
      data.orders.length;

    document.getElementById("providers").innerHTML =
      data.providers.map(p => `
        <div class="provider">
          <b>${p.provider.toUpperCase()}</b>

          <span class="${p.enabled ? "on" : "off"}">
            ${p.enabled ? "ON" : "OFF"}
            · Priority ${p.priority}
          </span>
        </div>
      `).join("");

  } catch (error) {
    console.error(error);
  }
}

async function getNumber() {
  const service =
    document.getElementById("service").value.trim();

  const country =
    document.getElementById("country").value.trim();

  if (!service || !country) {
    document.getElementById("getResult").textContent =
      "Service and country required.";
    return;
  }

  try {
    const data = await api("/api/get-number", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        service,
        country,
        username: "demo"
      })
    });

    document.getElementById("getResult").textContent =
      JSON.stringify(data, null, 2);

    loadDashboard();

  } catch (error) {

    document.getElementById("getResult").textContent =
      error.message;
  }
}

async function loadConsole() {
  try {
    const rows = await api("/api/console");

    document.getElementById("consoleBox").innerHTML = `
      <table>
        <tr>
          <th>ID</th>
          <th>Provider</th>
          <th>Service</th>
          <th>Country</th>
          <th>Number</th>
          <th>Status</th>
        </tr>

        ${rows.map(row => `
          <tr>
            <td>${row.id}</td>
            <td>${row.provider}</td>
            <td>${row.service}</td>
            <td>${row.country}</td>
            <td>${row.number || "-"}</td>
            <td>${row.status}</td>
          </tr>
        `).join("")}

      </table>
    `;

  } catch (error) {
    console.error(error);
  }
}

async function loadProfile() {
  try {
    const data =
      await api("/api/profile?username=demo");

    document.getElementById("balance").textContent =
      Number(data.balance).toFixed(2) + " TK";

    document.getElementById("profileBox").innerHTML = `
      <p>
        <b>Username:</b>
        ${data.username}
      </p>

      <p>
        <b>Balance:</b>
        ${Number(data.balance).toFixed(2)} TK
      </p>

      <p>
        <b>Created:</b>
        ${data.created_at}
      </p>
    `;

  } catch (error) {
    console.error(error);
  }
}

async function loadAdmin() {
  try {
    const providers =
      await api("/api/admin/providers");

    document.getElementById("adminBox").innerHTML =
      providers.map(provider => `
        <div class="provider">

          <div>
            <b>
              ${provider.provider.toUpperCase()}
            </b>

            <br>

            <small>
              Priority: ${provider.priority}
            </small>
          </div>

          <button
            onclick="toggleProvider(
              '${provider.provider}',
              ${provider.enabled},
              ${provider.priority}
            )"
          >
            ${provider.enabled ? "Turn OFF" : "Turn ON"}
          </button>

        </div>
      `).join("");

  } catch (error) {
    console.error(error);
  }
}

async function toggleProvider(
  name,
  enabled,
  priority
) {
  try {

    await api(
      "/api/admin/providers/" + name,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          enabled: !enabled,
          priority: priority
        })
      }
    );

    loadAdmin();
    loadDashboard();

  } catch (error) {
    alert(error.message);
  }
}

show("dashboard");
