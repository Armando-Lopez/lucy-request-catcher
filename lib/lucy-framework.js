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
  return class extends HTMLElement {
    constructor() {
      super();
      this.$name = name;
      this.isMounted = false;
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
      bindInputs({ self: this });
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
      const context = {
        self: this,
        data: this.$data,
        props: this.$props,
      };
      renderLoops(context);
      sendPropsToChild(context);
      renderDynamicClasses(context);
      renderMustaches(context);
      bindInputs({ self: this });
    }
  };
}

export function registerComponent(name, component) {
  customElements.define(name, component);
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

function renderMustaches({ self, data, props }) {
  const context = { ...props, ...data };
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
    const tagParent = node.parentNode;
    const text = tagParent._mustacheTemplate || node.textContent;

    // const matches = text.match(/\{\{(.+?)\}\}/g);
    const matches = text.match(/{{\s*[\w.]+\s*}}/g);

    if (!matches) continue;

    if (!tagParent._mustacheTemplate) {
      tagParent._mustacheTemplate = text;
    }

    let newText = text;

    matches?.forEach((match) => {
      const key = match.replace(/[{}]/g, "").trim();
      const value = resolveObjectPath(context, key);
      newText = newText.replace(match, value);
    });

    node.nodeValue = newText;
  }
}

function renderDynamicClasses({ self, data, props }) {
  const classAttr = "l:class";
  const evalDivider = "=>";
  const context = { ...data, ...props };
  elementsInScope(self)
    .filter((el) => el.hasAttribute(classAttr))
    .forEach((el) => {
      const dynamicValues = el.getAttribute(classAttr);
      dynamicValues.split(",").forEach((expression) => {
        const cleaned = expression.replace("{", "").replace("}", "").trim();
        if (cleaned === "") return;
        const [codeExpression, classesToReturn] = cleaned
          .split(evalDivider)
          .map((v) => v.trim());
        const expressionResult = resolveObjectPath(context, codeExpression);
        classesToReturn.split(" ").forEach((theClass) => {
          el.classList.toggle(theClass, Boolean(expressionResult));
        });
      });
    });
}

function bindEvents({ self, methods }) {
  const eventAttr = "l-on:";
  elementsInScope(self)
    .filter((el) => hasAttrStartsWith(el, eventAttr))
    .forEach((el) => {
      getAttrsArray(el).forEach((attr) => {
        if (!attr.name.startsWith(eventAttr)) return;

        const eventName = attr.name.replace(eventAttr, "");
        const fn = methods[attr.value];
        if (!fn) {
          console.warn(`Method '${attr.value}' does not exist`);
          return;
        }
        if (el[`$hasEvent:${eventName}`]) return;
        el[`$hasEvent:${eventName}`] = true;
        el.removeAttribute(attr.name);
        el.addEventListener(eventName, ($event) => fn.call(self, $event));
      });
    });
}

function bindInputs({ self }) {
  const bindAttr = "l:model";
  const data = self.$data;
  elementsInScope(self)
    .filter((el) => el.hasAttribute(bindAttr))
    .forEach((el) => {
      const dataField = el.getAttribute(bindAttr);
      el.value = data[dataField];
      if (el.$hasLModel) return;
      el.$hasLModel = true;
      el.addEventListener("input", (ev) => {
        const { value } = ev.target;
        data[dataField] = value;
      });
    });
}

// AS PARENT
function sendPropsToChild({ self, data }) {
  const childComponents = elementsInScope(self)
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
    self._loopTemplates = elementsInScope(self).filter((el) =>
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
          if (attr.name === `l:${loopKey}`) {
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
        componentToRender.removeAttribute(`l:${loopKey}`);
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

function elementsInScope(scopeParent) {
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

function hasAttrStartsWith(el, attrStart) {
  return Array.from(el.attributes).some((attr) =>
    attr.name.startsWith(attrStart)
  );
}

function isProp(attr) {
  return attr.startsWith("l:");
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
