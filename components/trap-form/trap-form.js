import { createComponent } from "/lib/lucy-framework.js";

export const trapForm = createComponent({
  templateUrl: "/components/trap-form/trap-form.html",
  data () {
    return {
      active: false,
      id: "",
      name: "holas",
      webSite: "",
      url: "",
      method: "",
      statusCode: "",
      response: ""
    }
  },
  onMounted() {
    console.log(this.$data);

  },
  onUpdated () {
    // console.log(this.$data);
  },
  methods: {
    handleSubmit (ev) {
      ev.preventDefault();
      console.log(this.$data);
    }
  }
})