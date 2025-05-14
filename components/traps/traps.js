import { getValueFromStorage } from "/helpers/helpers.js";
import { createComponent, html } from "/lib/lucy-framework.js";

export function registerTrapsComponent() {
  createComponent({
    name: "traps-component",
    template: html`
      <div>
        <template l-for="trap in traps">
          <trap-item-component l:trap="trap"></trap-item-component>
        </template>
      </div>
    `,
    data() {
      return {
        traps: [],
      };
    },
    onMounted() {
      getValueFromStorage("traps").then((traps = []) => {
        this.$data.traps = traps;
      });
    },
  });

  createComponent({
    name: "trap-item-component",
    template: html`
      <div class="border-b border-purple-300 p-2">
        <strong>{{ trap.name }}</strong>
        <p>🌐 {{ trap.webSite }}</p>
        <div class="flex items-center gap-1">
          <span>{{ trap.method }}</span>
          -
          <span
            l:class="{
              isSuccessCode => text-green-600,
              isErrorCode => text-red-600
            }"
            >{{ trap.statusCode }}</span
          >
          <div class="ml-auto space-x-2">
            <button class="px-2 py-1 text-white rounded-md bg-gray-700">
              Capturar
            </button>
            <button class="bg-blue-500 px-2 py-1 text-white rounded-md">
              Editar
            </button>
            <button class="bg-red-500 px-2 py-1 text-white rounded-md">
              Borrar
            </button>
          </div>
        </div>
        <div class="text-wrap break-all">
          <details>
            <summary>🦋 {{ trap.url }}</summary>
            <pre>{{ response }}</pre>
          </details>
        </div>
      </div>
    `,
    props: ["trap"],
    data() {
      const isSuccessCode = this.$props.trap.statusCode < 400;
      return {
        isSuccessCode,
        isErrorCode: !isSuccessCode,
        response: JSON.stringify(this.$props.trap.response, null, 2),
      };
    },
    onMounted() {
      console.log("Mounted child");
      // this.traps = ["a", "b", "c", "d"];
      // console.log(this.$data);
      // console.log(this.$props.trap.response);
    },
    onUpdated(data) {
      console.log("Updated child", data);
      // console.trace(data);
      // console.log(this.$props.traps);
    },
  });
}
