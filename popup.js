import {
  validURL,
  generateId,
  isValidJSON,
  createElement,
  setValueInStorage,
  setValueToSession,
  getValueFromStorage,
  getValueFromSession,
} from "./helpers/helpers.js";

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-btn");
  const trapsList = document.getElementById("traps-list");
  const tabContents = document.querySelectorAll(".tab-content");
  const tabsContainer = document.getElementById("tabs-container");

  const trapForm = document.getElementById("trap-form");

  const noSpiesMessage = document.getElementById("no-spies");
  const requestsSpiesList = document.getElementById("requests-spies-list");
  const clearRequestsSpiesBtn = document.getElementById("clear-spies-list");
  const toggleSpiesBtn = document.getElementById("toggle-active-spy");

  const TRAPS = "traps";
  const FORM_DRAFT = "form_draft";
  const REQUEST_SPIES = "requests_spies";
  const RUN_SPY_TABS = "run_spy_tabs";
  const bugMethod = {
    GET: "🦋",
    POST: "🪰",
    PUT: "🐝",
    DELETE: "🦟",
    PATCH: "🐞",
  };

  activeTabs();
  printTraps();
  activeSaveForm();
  activeSaveDraft();
  activeExportTraps();
  activeImportTraps();
  activePrintRequestsSpies();
  activeClearRequestsSpies();

  function activeTabs() {
    const selectedClass = ["text-purple-700"];
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const selected = tab.getAttribute("data-tab");

        // Quitar clases activas
        tabs.forEach((t) => t.classList.remove(...selectedClass));
        tabContents.forEach((c) => c.classList.add("hidden"));

        // Activar el seleccionado
        tab.classList.add(...selectedClass);
        document.getElementById(selected).classList.remove("hidden");
        tabsContainer.scrollTo(0, 0);
      });
    });
    tabs[0].click();
  }

  function getFormData() {
    const formData = new FormData(trapForm);
    const values = Object.fromEntries(formData);
    return {
      id: values.id,
      method: values.method,
      url: values.url.trim(),
      name: values.name.trim(),
      webSite: values.webSite.trim(),
      active: values.active === "on",
      statusCode: parseInt(values.statusCode),
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

  function activeSaveForm() {
    fillWebSiteInput();
    trapForm.addEventListener("submit", async (event) => {
      try {
        event.preventDefault();
        const itemToSave = getFormData();
        if (!validateForm(itemToSave)) return;
        const data = (await getValueFromStorage(TRAPS)) ?? [];
        const index = data.findIndex((i) => i.id === itemToSave.id);
        if (index !== -1) {
          // update if id already exists
          data[index] = itemToSave;
        } else {
          // add if id does not exist
          data.push({ ...itemToSave, id: generateId() });
        }
        await setValueInStorage(TRAPS, data);
        trapForm.reset();
        fillWebSiteInput();
        tabs[0].click();
        printTraps();
        setValueInStorage(FORM_DRAFT, {});
      } catch (e) {
        console.error(e);
      }
    });
  }

  function validateForm(itemToSave) {
    if (!validURL(itemToSave.webSite)) {
      alert("Parece que la URL del sitio web no es válida");
      return false;
    }
    if (!isValidJSON(JSON.stringify(itemToSave.response))) {
      alert("Parece que la respuesta JSON no es válido");
      return false;
    }
    return true;
  }

  function fillForm(data) {
    for (const key in data) {
      const input = trapForm[key];
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

  function activeSaveDraft() {
    // obtener datos en borrador
    getValueFromStorage(FORM_DRAFT).then((data = {}) => {
      fillForm(data);
    });
    // Escuchar cambios en los inputs y guardar en borrador
    const inputs = document.querySelectorAll(".control");
    inputs.forEach((input) => {
      input.addEventListener("input", () => {
        setValueInStorage(FORM_DRAFT, getFormData());
      });
    });
  }

  async function toggleEnableTrap(selectedItem) {
    const data = (await getValueFromStorage(TRAPS)) ?? [];
    const newData = data.map((item) =>
      item.id === selectedItem.id
        ? { ...item, active: !selectedItem.active }
        : item
    );
    await setValueInStorage(TRAPS, newData);
    printTraps();
  }

  async function goToEditTrap(selectedItem) {
    tabs[1].click();
    fillForm(selectedItem);
  }

  async function deleteTrap(selectedItem) {
    const data = (await getValueFromStorage(TRAPS)) ?? [];
    const newData = data.filter((item) => item.id !== selectedItem.id);
    await setValueInStorage(TRAPS, newData);
    printTraps();
  }

  async function printTraps() {
    const data = ((await getValueFromStorage(TRAPS)) || []).toSorted((a, b) =>
      a.name < b.name ? -1 : 1
    );
    trapsList.innerHTML = "";
    if (data.length === 0) {
      trapsList.innerHTML = `<div class="w-100 mx-auto flex flex-col justify-center items-center h-full text-center">
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
      const statusCode = createElement("span")
        .text(item.statusCode)
        .attrs({
          class: item.statusCode < 400 ? "text-green-600" : "text-red-600",
        });
      const toggleBtn = createElement("button")
        .text(item.active ? "Liberar" : "Capturar")
        .attrs({
          class: `px-2 py-1 text-white rounded-md ${
            item.active ? "bg-green-700" : "bg-gray-700"
          }`,
        })
        .events({
          click: () => toggleEnableTrap(item),
        });
      const editBtn = createElement("button")
        .text("Editar")
        .attrs({
          class: "bg-blue-500 px-2 py-1 text-white rounded-md",
        })
        .events({
          click: () => goToEditTrap(item),
        });
      const deleteBtn = createElement("button")
        .text("Borrar")
        .attrs({
          class: "bg-red-500 px-2 py-1 text-white rounded-md",
        })
        .events({
          click: () => deleteTrap(item),
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
            .children([method, "-", statusCode, actions]),
          createElement("div")
            .attrs({ class: "text-wrap break-all" })
            .children([requestInfo]),
        ]);

      itemEl.appendTo(fragment);
    });
    trapsList.appendChild(fragment);
  }

  function activeExportTraps() {
    document
      .getElementById("exportBugs")
      .addEventListener("click", async () => {
        try {
          const data = (await getValueFromStorage(TRAPS)) || [];
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

  function activeImportTraps() {
    document
      .getElementById("importBugs")
      .addEventListener("click", async () => {
        const inputFile = document.getElementById("importBugsFile");
        inputFile.click();
        inputFile.addEventListener("change", async (ev) => {
          try {
            const file = ev.target.files[0];
            if (!file) return;
            const content = await file.text();
            const uploadedData = JSON.parse(content);
            const prevData = (await getValueFromStorage(TRAPS)) || [];
            const newDataToSave = [...prevData, ...uploadedData].map(
              (item) => ({
                ...item,
                id: item.id || generateId(),
                active: false,
              })
            );
            await setValueInStorage(TRAPS, newDataToSave);
            tabs[0].click();
            printTraps();
            setValueInStorage(FORM_DRAFT, {});
            chrome.tabs?.reload?.();
          } catch (e) {
            console.error(e);
          }
        });
      });
  }

  function activePrintRequestsSpies() {
    getValueFromSession(REQUEST_SPIES).then((data = []) => {
      printRequestsSpies(data);
    });
    chrome.storage.session.onChanged.addListener(({ requests_spies }) => {
      printRequestsSpies(JSON.parse(requests_spies.newValue) ?? []);
    });
  }

  function createSpyElement(item) {
    const webSite = createElement("p").text(`🌐 ${item.webSite}`);
    const method = createElement("span").text(item.method);
    const prettyResponse = JSON.stringify(item.response, null, 2);
    const requestInfo = createElement("details").children([
      createElement("summary").text(`${bugMethod[item.method]} ${item.url}`),
      createElement("pre").text(prettyResponse),
    ]);
    const statusCode = createElement("span")
      .text(item.statusCode)
      .attrs({
        class: item.statusCode < 400 ? "text-green-600" : "text-red-600",
      });
    const createTrapBtn = createElement("button")
      .text("Crear trampa")
      .attrs({
        class: "px-2 py-1 text-white rounded-md bg-green-700",
      })
      .events({
        click: () => sendSpyToTrapForm(item),
      });

    const actions = createElement("div")
      .attrs({ class: "ml-auto space-x-2" })
      .children([createTrapBtn]);

    const itemEl = createElement("div")
      .attrs({ class: "border-b border-purple-300 p-2" })
      .children([
        webSite,
        createElement("div")
          .attrs({ class: "flex items-center gap-1" })
          .children([method, "-", statusCode, actions]),
        createElement("div")
          .attrs({ class: "text-wrap break-all" })
          .children([requestInfo]),
      ]);
    return itemEl;
  }

  function printRequestsSpies(data) {
    if (requestsSpiesList.childElementCount === 0) {
      const requestSpiesFragment = document.createDocumentFragment();
      requestsSpiesList.innerHTML = "";
      if (data.length === 0) {
        noSpiesMessage.classList.remove("hidden");
        return;
      }
      noSpiesMessage.classList.add("hidden");

      data.forEach((item) => {
        const itemEl = createSpyElement(JSON.parse(item));
        itemEl.appendTo(requestSpiesFragment);
      });

      requestsSpiesList.appendChild(requestSpiesFragment);
    } else {
      const mostRecentSpy = data[0];
      const itemEl = createSpyElement(JSON.parse(mostRecentSpy));
      const requestSpYFragment = document.createDocumentFragment();
      itemEl.appendTo(requestSpYFragment);
      requestsSpiesList.prepend(requestSpYFragment);
    }
  }

  // COOMING SOON
  // function activeToggleSpy() {
  //   toggleSpiesBtn.addEventListener("click", () => {
  //     chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  //       const currentTab = tabs[0];
  //       const tabsToSpy = (await getValueFromSession(RUN_SPY_TABS)) ?? [];
  //       if (!tabsToSpy.includes(currentTab.url)) {
  //         tabsToSpy.push(currentTab.url);
  //       }
  //       setValueToSession(RUN_SPY_TABS, tabsToSpy);
  //     });
  //   });
  // }

  function activeClearRequestsSpies() {
    clearRequestsSpiesBtn.addEventListener("click", () => {
      setValueToSession(REQUEST_SPIES, []);
      requestsSpiesList.innerHTML = "";
    });
  }

  function sendSpyToTrapForm(data) {
    trapForm.reset();
    fillWebSiteInput();
    fillForm({
      url: data.url,
      method: data.method,
      webSite: data.webSite,
      response: data.response,
      statusCode: data.statusCode,
    });
    tabs[1].click();
  }
});
