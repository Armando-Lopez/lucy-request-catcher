"use strict";
export function createComponent({
  name,
  template: templateString,
  templateUrl,
  props = [],
  data = () => ({}),
  methods = {},
  onMounted = () => {},
  onUpdated = () => {},
}) {
  customElements.define(
    name,
    class extends HTMLElement {
      constructor() {
        super();
        this.$name = name;
        this.isMounted = false;
        // this.props = props;
        this.$props = receivePropsFromParent({ self: this, props });
        this.$data = reactiveData({
          object: data.call(this),
          onSet: (data) => this.updated(data),
        });
      }
      connectedCallback() {
        this.mount(); // INIT COMPONENT MOUNT
      }
      async mount() {
        // ASYNC MOUNT BECAUSE OF TEMPLATE URL FETCH
        await mountTemplate({
          self: this,
          templateUrl,
          templateString,
        });
        this.triggerRender(); // INITIAL RENDER ON MOUNT
        bindEvents({ self: this, methods });
        this.isMounted = true;
        onMounted.call(this); // CALL ON MOUNTED
      }
      updated(data) {
        this.triggerRender(); // TRIGGER RENDER
        if (this.isMounted) {
          onUpdated.call(this, data); // CALL ON UPDATED
        }
      }
      triggerRender() {
        // PRINT BINDINGS VALUES
        // console.count(name);
        sendPropsToChild({ self: this, data: this.$data });
        renderLoops({ self: this, data: this.$data });
        renderMustaches({
          self: this,
          data: { ...this.$data, ...this.$props },
        });
        renderTextDirectives({
          self: this,
          data: this.$data,
        });
      }
    }
  );
}

function reactiveData({ object: data, onGet = () => {}, onSet = () => {} }) {
  const validateProperty = (name) => {
    if (!Reflect.has(data, name)) {
      console.warn(`Property '${name}' does not exist`);
      return false;
    }
    return true;
  };
  return new Proxy(data, {
    get(target, name) {
      if (!validateProperty(name)) return "";
      const value = Reflect.get(target, name);
      onGet({ name, value });
      return value;
    },
    set(target, name, value) {
      if (!validateProperty(name)) return false;
      const updateData = {
        name,
        previousValue: Reflect.get(target, name),
        newValue: value,
      };
      const result = Reflect.set(target, name, value);
      if (updateData.previousValue !== updateData.newValue) {
        onSet(updateData);
      }
      return result;
    },
  });
}

async function mountTemplate({ self, templateUrl, templateString }) {
  if (templateString) {
    self.appendChild(templateString.cloneNode(true));
    return;
  }
  const htmlText = await fetch(templateUrl).then((r) => r.text());
  const template = document.createElement("template");
  template.innerHTML = htmlText;
  const fragment = template.content.cloneNode(true);
  self.appendChild(fragment);
}

function renderMustaches({ self, data }) {

  const walker = document.createTreeWalker(
    self,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return isInsideChildrenComponents(self, node)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    },
    false
  );

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent;

    // const matches = text.match(/\{\{(.+?)\}\}/g);
    const matches = text.match(/{{\s*[\w.]+\s*}}/g);

    if (!matches) continue;

    let newText = text;

    matches?.forEach((match) => {
      const key = match.replace(/[{}]/g, "").trim();
      const value = resolveObjectPath(data, key);
      newText = newText.replace(match, value);
    });

    node.nodeValue = newText;
  }
}

function renderTextDirectives({ self, data }) {
  self.querySelectorAll("*[l-text]").forEach((el) => {
    const propName = el.getAttribute("l-text");
    el.textContent = Reflect.get(data, propName);
  });
}

function bindEvents({ self, methods }) {
  const directElements = elementsInDirectScope(self);
  directElements.forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith("l-on:")) {
        const eventName = attr.name.replace("l-on:", "");
        const fn = methods[attr.value];
        if (!fn) {
          console.warn(`Method '${attr.value}' does not exist`);
          return;
        }
        el.addEventListener(eventName, ($event) => fn.call(self, $event));
      }
    });
  });
}

// AS PARENT
function sendPropsToChild({ self, data }) {
  const childComponents = elementsInDirectScope(self)
    .filter((el) => isCustomElement(el))
    .filter((el) => !el._fromLoop);
  childComponents.forEach((childComponent) => {
    getAttrsArray(childComponent).forEach((attr) => {
      const propName = getPropName(attr.name);

      if (!isProp(attr.name)) return;
      if (!isInData(data, attr.value)) return;
      childComponent[`will_receive_prop:${propName}`] = Reflect.get(
        data,
        attr.value
      );
    });
  });
}

function renderLoops({ self, data }) {
  if (!self._loopTemplates) {
    self._loopTemplates = elementsInDirectScope(self).filter((el) =>
      el.hasAttribute("l-for")
    );
  }

  self._loopTemplates.forEach((template) => {
    const [loopKey, arrayName] = template
      .getAttribute("l-for")
      .split(" in ")
      .map((s) => s.trim());

    const arrayData = data[arrayName];
    if (!Array.isArray(arrayData)) return;

    if (!template._hasRendered) {
      template._originalContent = template.content.cloneNode(true);
      template._loopMarker = document.createComment("loop-start:" + arrayName);
      const parent = template.parentElement;
      parent.insertBefore(template._loopMarker, template);
      template.remove();
      template._hasRendered = true;
    }

    const parent = template._loopMarker.parentElement;
    const marker = template._loopMarker;

    // REMOVE PREVIOUS CLONES
    let next = marker.nextSibling;
    while (next && next.nodeType !== Node.COMMENT_NODE) {
      const toRemove = next;
      next = next.nextSibling;
      toRemove.remove();
    }

    // RENDER CLONES
    arrayData.forEach((item) => {
      const clone = template._originalContent.cloneNode(true);
      const componentToRender = clone.querySelector("*");
      if (isCustomElement(componentToRender)) {
        getAttrsArray(componentToRender).forEach((attr) => {
          if (!isProp(attr.name)) return;
          if (attr.name === `p:${loopKey}`) {
            // PASS LOOP ITEM
            componentToRender[`will_receive_prop:${loopKey}`] = item;
          }
          if (isInData(data, getPropName(attr.name))) {
            // PASS OTHER PROPS
            componentToRender[`will_receive_prop:${getPropName(attr.name)}`] =
              Reflect.get(data, getPropName(attr.name));
            componentToRender.removeAttribute(attr.name);
          }
        });
        componentToRender._fromLoop = true;
        parent.insertBefore(componentToRender, marker.nextSibling);
        componentToRender.removeAttribute(`p:${loopKey}`);
      }
    });
  });
}

// AS CHILD
function receivePropsFromParent({ self, props }) {
  const definedProps = {};
  props.forEach((key) => {
    definedProps[key] = self[`will_receive_prop:${key}`];
    delete self[`will_receive_prop:${key}`];
  });
  return reactiveData({
    object: definedProps,
    onSet: (data) => self.updated(data),
  });
}

// UTILS
export function html(strings, ...values) {
  const template = document.createElement("template");
  let finalString = "";

  strings.forEach((str, i) => {
    finalString += str + (values[i] !== undefined ? values[i] : "");
  });

  template.innerHTML = finalString.trim();
  const elementHTML = template.content.cloneNode(true);
  return elementHTML;
}

function elementsInDirectScope(scopeParent) {
  const tags = [];
  getElements(scopeParent);
  function getElements(parent) {
    const directElements = parent.querySelectorAll(":scope > *");
    directElements.forEach((el) => {
      if (isCustomElement(el)) {
        tags.push(el);
        return; // STOP RECURSION ON CUSTOM ELEMENTS BECAUSE THEY HAVE THEIR OWN SCOPE
      }
      tags.push(el);
      getElements(el);
    });
  }
  return tags;
}

function isInsideChildrenComponents(root, node) {
  let current = node.parentNode;

  while (current && current !== root) {
    if (isCustomElement(current)) return true;
    current = current.parentNode;
  }

  return false;
}

function isCustomElement(el) {
  return el.tagName && el.tagName.includes("-");
}

function getAttrsArray(el) {
  return Array.from(el.attributes).map((attr) => ({
    name: attr.name,
    value: parseAttribute(attr.value),
  }));
}

function isProp(attr) {
  return attr.startsWith("p:");
}

function getPropName(attr) {
  return attr.split(":")[1];
}

function isInData(data, key) {
  return Reflect.has(data, key);
}

function parseAttribute(value) {
  if (value === null) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (!isNaN(value)) return Number(value);
  return value;
}

function resolveObjectPath(obj, path) {
  return path
    .split(".")
    .reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}
