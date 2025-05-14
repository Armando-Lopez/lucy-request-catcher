import { createComponent, html } from "/lib/lucy-framework.js";

const tabsClass = [
  "px-4",
  "py-2",
  "text-sm",
  "font-medium",
  "hover:text-purple-700",
];
const selectedClass = ["text-purple-700"];

export function registerTabsComponent() {
  createComponent({
    name: "tabs-component",
    template: html`<div>
      <slot></slot>
    </div>`,
    onMounted() {
      const tabs = this.querySelectorAll("[data-tab]");
      const tabContents = this.querySelectorAll(".tab-content");
      const tabsContainer = this.querySelector("#tabs-container");
      tabs.forEach((tab) => {

        tab.classList.add(...tabsClass);
        tab.addEventListener("click", () => {
          
          // chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });

          const selected = tab.getAttribute("data-tab");

          // Remove active classes
          tabs.forEach((t) => t.classList.remove(...selectedClass));
          tabContents.forEach((c) => c.classList.add("hidden"));

          // Add active class
          tab.classList.add(...selectedClass);
          document.getElementById(selected).classList.remove("hidden");
          tabsContainer.scrollTo(0, 0);
        });
      });
      tabs[0].click();
    },
  });
}
