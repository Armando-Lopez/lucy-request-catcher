import {
  createElement,
  getValueFromStorage,
  setValueInStorage,
} from "./helpers.js";

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initForm();
  printIntercepts();
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
    });
  });
  tabs[0].click();
}

function getFormData() {
  const formData = new FormData(document.getElementById("form"));
  const values = Object.fromEntries(formData);
  return {
    name: values.name,
    method: values.method,
    url: values.url.trim(),
    responseCode: parseInt(values.responseCode),
    response: JSON.parse(values.response.trim() || "{}"),
    active: values.active === "on",
  };
}

function initForm() {
  const form = document.getElementById("form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const itemToSave = getFormData();
    const data = (await getValueFromStorage(INTERCEPTS)) ?? [];
    const index = data.findIndex((i) => i.name === itemToSave.name);
    if (index !== -1) {
      // update if name already exists
      data[index] = itemToSave;
    } else {
      // add if name does not exist
      data.push(itemToSave);
    }
    await setValueInStorage(INTERCEPTS, data);
    form.reset();
    document.querySelectorAll(".tab-btn")[0].click();
    printIntercepts();
    setValueInStorage(TEMPORAL_DATA, {});
  });
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
    item.name === selectedItem.name
      ? { ...item, active: !selectedItem.active }
      : item
  );
  await setValueInStorage(INTERCEPTS, newData);
  printIntercepts();
}

async function goToEditIntercept(selectedItem) {
  document.querySelectorAll(".tab-btn")[1].click();
  fillForm(selectedItem);
}

async function deleteIntercept(selectedItem) {
  const data = (await getValueFromStorage(INTERCEPTS)) ?? [];
  const newData = data.filter((item) => item.name !== selectedItem.name);
  await setValueInStorage(INTERCEPTS, newData);
  printIntercepts();
}

async function printIntercepts() {
  const data = ((await getValueFromStorage(INTERCEPTS)) || []).toSorted(
    (a, b) => (a.name < b.name ? -1 : 1)
  );
  const container = document.getElementById("intercepts");
  container.innerHTML = "";
  if (data.length === 0) {
    container.innerHTML = `<div class="flex flex-col justify-center items-center h-full">
      <p>No hay bichos en la telaraña</p>
      <p>
        Haz click en
        <strong class="text-purple-600">"Nuevo/Editar"</strong>
        para empezar a capturar
      </p>
      <span class="text-8xl"> 🕸️ </span>
    </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  data.forEach((item) => {
    const methodName = createElement("strong").text(item.method);
    const prettyResponse = JSON.stringify(item.response, null, 2);
    const requestInfo = createElement("details").children([
      createElement("summary").text(item.url),
      createElement("pre").text(prettyResponse),
    ]);
    const responseCode = createElement("span").text(item.responseCode);
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
        createElement("span").text(item.name),
        createElement("div")
          .attrs({ class: "flex items-center" })
          .children([
            bugMethod[item.method],
            methodName,
            " - ",
            responseCode,
            actions,
          ]),
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
    const data = (await getValueFromStorage(INTERCEPTS)) || [];
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bichos_export.json";
    a.click();
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
        const data = JSON.parse(content);
        await setValueInStorage(INTERCEPTS, data);
        document.querySelectorAll(".tab-btn")[0].click();
        printIntercepts();
      } catch (e) {
        console.error(e);
      }
    });
  });
}
