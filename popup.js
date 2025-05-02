import {
  createElement,
  getValueFromStorage,
  setValueInStorage,
  isValidJSON,
} from "./helpers.js";

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initForm();
  printIntercepts();
  handleSaveDraft();
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

function initForm() {
  const form = document.getElementById("form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const values = Object.fromEntries(formData);
    const data = {
      name: values.name,
      method: values.method,
      url: values.url.trim(),
      responseCode: values.responseCode,
      response: values.response.trim() || "{}",
      active: values.active === "on",
    };

    const prevData = (await getValueFromStorage(INTERCEPTS)) ?? {};
    const newData = { ...prevData, [data.name]: data };
    await setValueInStorage(INTERCEPTS, newData);
    printIntercepts();
    form.reset();
    document.querySelectorAll(".tab-btn")[0].click();

    setValueInStorage(TEMPORAL_DATA, JSON.stringify({}));
  });
}

function fillForm(data) {
  const form = document.getElementById("form");
  for (const key in data) {
    if (key === "active") {
      form[key].checked = data[key] === "on";
      continue;
    }
    if (form[key]) {
      form[key].value = data[key];
    }
  }
}
function handleSaveDraft() {
  // obtener datos en borrador
  getValueFromStorage(TEMPORAL_DATA).then((data = "{}") => {
    fillForm(JSON.parse(data));
  });
  // Escuchar cambios en los inputs y guardar en borrador
  const inputs = document.querySelectorAll(".control");
  inputs.forEach((input) => {
    input.addEventListener("input", (ev) => {
      const form = document.getElementById("form");
      const temporalData = JSON.stringify(
        Object.fromEntries(new FormData(form))
      );
      setValueInStorage(TEMPORAL_DATA, temporalData);
    });
  });
}

async function toggleEnableIntercept(item) {
  const prevData = ((await getValueFromStorage(INTERCEPTS)) ?? {}) || {};
  const newData = { ...prevData };
  newData[item.name].active = !item.active;
  await setValueInStorage(INTERCEPTS, newData);
  printIntercepts();
}

async function editIntercept(item) {
  document.querySelectorAll(".tab-btn")[1].click();
  fillForm(item);
}

async function deleteIntercept(item) {
  const prevData = ((await getValueFromStorage(INTERCEPTS)) ?? {}) || {};
  const newData = { ...prevData };
  delete newData[item.name];
  await setValueInStorage(INTERCEPTS, newData);
  printIntercepts();
}

async function printIntercepts() {
  const data = (await getValueFromStorage(INTERCEPTS)) || {};
  const container = document.getElementById("intercepts");
  const dataArray = Object.values(data).sort((a, b) =>
    a.name < b.name ? -1 : 1
  );

  if (dataArray.length === 0) {
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
  dataArray.forEach((item) => {
    const res = isValidJSON(item.response)
      ? item.response
      : '{"Error": "JSON de respuesta inválido"}';
    const prettyResponse = item.response
      ? JSON.stringify(JSON.parse(res), null, 2)
      : "";

    const methodName = createElement("strong").text(item.method);
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
        click: () => editIntercept(item),
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
