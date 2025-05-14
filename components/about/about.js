import { createComponent } from "/lib/lucy-framework.js";

export function registerAboutComponent() {
  createComponent({
    name: "about-component",
    templateUrl: "/components/about/about.html",
  });
}
