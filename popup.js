import {
  generateId,
  validURL,
  createElement,
  setValueInStorage,
  getValueFromStorage,
  isValidJSON,
} from "./helpers.js";

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  handleSave();
  printTraps();
  handleSaveDraft();
  activeExportIntercepts();
  activeImportIntercepts();
});

const INTERCEPTS = "intercepts";
const TEMPORAL_DATA = "temporalData";
const bugMethod = {
  GET: "🦋",
  POST: "🪰",
  PUT: "🐝",
  DELETE: "🦟",
  PATCH: "🐞",
};

function initTabs() {
  const tabsContainer = document.getElementById("tabs-container");
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");
  const selectedClass = ["text-purple-800"];
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const selected = tab.getAttribute("data-tab");

      // Quitar clases activas
      tabs.forEach((t) => t.classList.remove(...selectedClass));
      contents.forEach((c) => c.classList.add("hidden"));

      // Activar el seleccionado
      tab.classList.add(...selectedClass);
      document.getElementById(selected).classList.remove("hidden");
      tabsContainer.scrollTo(0, 0);
    });
  });
  tabs[0].click();
}

function getFormData() {
  const formData = new FormData(document.getElementById("form"));
  const values = Object.fromEntries(formData);
  return {
    id: values.id,
    method: values.method,
    url: values.url.trim(),
    name: values.name.trim(),
    webSite: values.webSite.trim(),
    active: values.active === "on",
    responseCode: parseInt(values.responseCode),
    response: JSON.parse(values.response.trim() || "{}"),
  };
}

function fillWebSiteInput() {
  const webSiteInput = document.getElementById("webSite");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const webSite = validURL(tabs[0].url)?.origin;
    webSiteInput.value = webSite;
  });
  webSiteInput.addEventListener("blur", (ev) => {
    const value = ev.target.value;
    const url = validURL(value);
    if (!url) return;
    ev.target.value = url?.origin;
  });
}

function handleSave() {
  fillWebSiteInput();
  const form = document.getElementById("form");
  form.addEventListener("submit", async (event) => {
    try {
      event.preventDefault();
      const itemToSave = getFormData();
      if (!validateForm(itemToSave)) return;
      const data = (await getValueFromStorage(INTERCEPTS)) ?? [];
      const index = data.findIndex((i) => i.id === itemToSave.id);
      if (index !== -1) {
        // update if id already exists
        data[index] = itemToSave;
      } else {
        // add if id does not exist
        data.push({ ...itemToSave, id: generateId() });
      }
      await setValueInStorage(INTERCEPTS, data);
      form.reset();
      fillWebSiteInput();
      document.querySelectorAll(".tab-btn")[0].click();
      printTraps();
      setValueInStorage(TEMPORAL_DATA, {});
    } catch (e) {
      console.error(e);
    }
  });
}

function validateForm(itemToSave) {
  console.log(JSON.stringify(itemToSave.response));
  console.log(isValidJSON(JSON.stringify(itemToSave.response)));
  if (!validURL(itemToSave.webSite)) {
    alert("Parece que la URL del sitio web no es válida");
    return false;
  }
  if (!validURL(itemToSave.url)) {
    alert("Parece que la URL a capturar no es válida");
    return false;
  }
  if (!isValidJSON(JSON.stringify(itemToSave.response))) {
    alert("Parece que la respuesta JSON no es válido");
    return false;
  }
  return true;
}

function fillForm(data) {
  const form = document.getElementById("form");
  for (const key in data) {
    const input = form[key];
    const value = data[key];
    if (!input) {
      continue;
    }
    if (key === "active") {
      input.checked = value === "on";
      continue;
    }
    if (key === "response") {
      input.value = JSON.stringify(value, null, 2);
    } else {
      input.value = value;
    }
  }
}

function handleSaveDraft() {
  // obtener datos en borrador
  getValueFromStorage(TEMPORAL_DATA).then((data = {}) => {
    fillForm(data);
  });
  // Escuchar cambios en los inputs y guardar en borrador
  const inputs = document.querySelectorAll(".control");
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      setValueInStorage(TEMPORAL_DATA, getFormData());
    });
  });
}

async function toggleEnableIntercept(selectedItem) {
  const data = (await getValueFromStorage(INTERCEPTS)) ?? [];
  const newData = data.map((item) =>
    item.id === selectedItem.id
      ? { ...item, active: !selectedItem.active }
      : item
  );
  await setValueInStorage(INTERCEPTS, newData);
  printTraps();
}

async function goToEditIntercept(selectedItem) {
  document.querySelectorAll(".tab-btn")[1].click();
  fillForm(selectedItem);
}

async function deleteIntercept(selectedItem) {
  const data = (await getValueFromStorage(INTERCEPTS)) ?? [];
  const newData = data.filter((item) => item.id !== selectedItem.id);
  await setValueInStorage(INTERCEPTS, newData);
  printTraps();
}

async function printTraps() {
  const data = ((await getValueFromStorage(INTERCEPTS)) || []).toSorted(
    (a, b) => (a.name < b.name ? -1 : 1)
  );
  const container = document.getElementById("intercepts");
  container.innerHTML = "";
  if (data.length === 0) {
    container.innerHTML = `<div class="w-100 mx-auto flex flex-col justify-center items-center h-full text-center">
      <p>No hay bichos en la telaraña</p>
      <p>
        Haz click en
        <strong class="text-purple-600">"Nuevo/Editar"</strong>
        para empezar a capturar
      </p>
      <span class="text-8xl"> 🕸️ </span>
      <p>
        Si es tu primera vez por aquí, haz click en
        <strong class="text-purple-600">"Acerca"</strong>
        para aprender a usar la telaraña
      </p>
    </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  data.forEach((item) => {
    const name = createElement("strong").text(item.name);
    const webSite = createElement("p").text(`🌐 ${item.webSite}`);
    const method = createElement("span").text(item.method);
    const prettyResponse = JSON.stringify(item.response, null, 2);
    const requestInfo = createElement("details").children([
      createElement("summary").text(`${bugMethod[item.method]} ${item.url}`),
      createElement("pre").text(prettyResponse),
    ]);
    const responseCode = createElement("span")
      .text(item.responseCode)
      .attrs({
        class: item.responseCode < 400 ? "text-green-600" : "text-red-600",
      });
    const toggleBtn = createElement("button")
      .text(item.active ? "Liberar" : "Capturar")
      .attrs({
        class: `px-2 py-1 text-white rounded-md ${
          item.active ? "bg-green-700" : "bg-gray-700"
        }`,
      })
      .events({
        click: () => toggleEnableIntercept(item),
      });
    const editBtn = createElement("button")
      .text("Editar")
      .attrs({
        class: "bg-blue-500 px-2 py-1 text-white rounded-md",
      })
      .events({
        click: () => goToEditIntercept(item),
      });
    const deleteBtn = createElement("button")
      .text("Borrar")
      .attrs({
        class: "bg-red-500 px-2 py-1 text-white rounded-md",
      })
      .events({
        click: () => deleteIntercept(item),
      });
    const actions = createElement("div")
      .attrs({ class: "ml-auto space-x-2" })
      .children([toggleBtn, editBtn, deleteBtn]);

    const itemEl = createElement("div")
      .attrs({ class: "border-b border-purple-300 p-2" })
      .children([
        name,
        webSite,
        createElement("div")
          .attrs({ class: "flex items-center gap-1" })
          .children([method, "-", responseCode, actions]),
        createElement("div")
          .attrs({ class: "text-wrap break-all" })
          .children([requestInfo]),
      ]);

    itemEl.appendTo(fragment);
  });

  container.appendChild(fragment);
}

function activeExportIntercepts() {
  document.getElementById("exportBugs").addEventListener("click", async () => {
    try {
      const data = (await getValueFromStorage(INTERCEPTS)) || [];
      const newDataToExport = data.map((item) => ({
        ...item,
        id: undefined,
        active: undefined,
      }));
      const json = JSON.stringify(newDataToExport, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bichos_export.json";
      a.click();
    } catch (e) {
      console.error(e);
    }
  });
}

function activeImportIntercepts() {
  document.getElementById("importBugs").addEventListener("click", async () => {
    const inputFile = document.getElementById("importBugsFile");
    inputFile.click();
    inputFile.addEventListener("change", async (ev) => {
      try {
        const file = ev.target.files[0];
        if (!file) return;
        const content = await file.text();
        const uploadedData = JSON.parse(content);
        const prevData = (await getValueFromStorage(INTERCEPTS)) || [];
        const newDataToSave = [...prevData, ...uploadedData].map((item) => ({
          ...item,
          id: item.id || generateId(),
          active: false,
        }));
        await setValueInStorage(INTERCEPTS, newDataToSave);
        document.querySelectorAll(".tab-btn")[0].click();
        printTraps();
      } catch (e) {
        console.error(e);
      }
    });
  });
}
