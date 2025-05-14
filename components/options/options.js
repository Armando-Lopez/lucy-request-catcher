import { createComponent } from "/lib/lucy-framework.js";

export function registerOptionsComponent() {
  createComponent({
    name: "options-component",
    templateUrl: "/components/options/options.html",
  });
}
