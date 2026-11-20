// jsdom lacks the popover, animation and layout APIs ui-sdk's popups call; the edge-runtime suites have no document.
if (typeof document !== "undefined") {
  const g = globalThis as typeof globalThis & { __UI_SDK_STRICT__?: boolean; ResizeObserver?: unknown };
  g.__UI_SDK_STRICT__ = true;
  HTMLElement.prototype.showPopover = function () {};
  HTMLElement.prototype.hidePopover = function () {};
  Element.prototype.getAnimations = () => [];
  Element.prototype.scrollIntoView = function () {};
  Element.prototype.checkVisibility = () => true;
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  document.elementFromPoint = () => null;
  document.elementsFromPoint = () => [];
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  document.head.append(Object.assign(document.createElement("style"), { textContent: "[popover] { display: block !important }" }));
  const { cleanup } = await import("@testing-library/react");
  const { afterEach } = await import("vitest");
  afterEach(cleanup);
}
export {};
