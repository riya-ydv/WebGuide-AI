/* Explicit embedded-widget activation. The same dock is used by the extension. */
(() => {
  if (
    typeof document === "undefined" ||
    document.getElementById("webguide-launcher") ||
    document.getElementById("webguide-companion")
  )
    return;
  const button = document.createElement("button");
  button.id = "webguide-launcher";
  button.type = "button";
  button.textContent = "Open WebGuide AI";
  button.setAttribute("data-webguide-ui", "");
  Object.assign(button.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "2147483646",
    background: "#174b77",
    color: "white",
    border: "2px solid white",
    borderRadius: "999px",
    font: "600 16px system-ui",
    padding: "14px 20px",
    minHeight: "48px",
    boxShadow: "0 4px 20px #102a4340",
    cursor: "pointer",
  });
  button.addEventListener("click", () => {
    window.WebGuideOpenCompanion?.();
  });
  document.documentElement.append(button);
})();
