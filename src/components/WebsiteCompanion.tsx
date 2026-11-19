import { useRef, useState } from "react";
import "./website-companion.css";
export function WebsiteCompanion() {
  const [address, setAddress] = useState("https://evisionindia.com/");
  const [error, setError] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const copyAddress = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(
        `Copied ${value}. Paste it into the address bar of desktop Chrome or Edge, then press Enter.`,
      );
    } catch {
      setCopyStatus(`Copy is unavailable. Select and copy this address manually: ${value}`);
    }
  };
  const websiteLink = useRef<HTMLAnchorElement>(null);
  let safeUrl = "";
  try {
    const url = new URL(address);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password)
      safeUrl = url.href;
  } catch {
    /* show validation on activation */
  }
  const openWebsite = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!safeUrl) {
      event.preventDefault();
      setError("Enter a complete HTTP or HTTPS address without a username or password.");
    } else {
      setError("");
      setNextStep(
        `Next, switch to ${new URL(safeUrl).hostname}. Click the WebGuide AI extension icon, then choose Open companion on this page. If no tab appeared, allow this link to open or copy the website address. This app cannot check whether the extension is installed or active.`,
      );
    }
  };
  return (
    <section className="gf-stack wg-companion" aria-label="Use WebGuide on another website">
      <div className="wg-companion-start">
        <div>
          <h2>Choose where to begin</h2>
          <p>Try the practice page, or add the companion to Chrome or Edge.</p>
        </div>
        <a className="wg-action" href="/demo-service.html" target="_blank" rel="noreferrer">
          Open practice website
        </a>
      </div>
      <div className="wg-setup-grid">
        <section className="gf-card" aria-labelledby="companion-install-title">
          <span className="wg-step-number" aria-hidden="true">
            01
          </span>
          <h2 id="companion-install-title">1. Install once in desktop Chrome or Edge</h2>
          <p>
            <strong>The browser extension must be installed first.</strong>
          </p>
          <a className="wg-action" href="/webguide-companion.zip" download>
            Download WebGuide browser companion
          </a>
          <ol className="wg-setup-short">
            <li>Extract the ZIP.</li>
            <li>
              Open Extensions settings. Turn on <strong>Developer mode</strong>.
            </li>
            <li>
              Choose <strong>Load unpacked</strong> and select <code>webguide-companion</code>.
            </li>
          </ol>
          <details>
            <summary>Open browser settings and installation help</summary>
            <div className="wg-companion-address">
              <code>chrome://extensions</code>
              <button type="button" onClick={() => void copyAddress("chrome://extensions")}>
                Copy Chrome address
              </button>
            </div>
            <div className="wg-companion-address">
              <code>edge://extensions</code>
              <button type="button" onClick={() => void copyAddress("edge://extensions")}>
                Copy Edge address
              </button>
            </div>
            {copyStatus && <p role="status">{copyStatus}</p>}
            <p>
              Paste into the address bar. This webpage cannot open browser settings or verify
              installation.
            </p>
            <p>
              On Mac, double-click the ZIP in Finder. On Windows, right-click the ZIP and choose
              Extract All.
            </p>
            <p>
              Select the folder containing <code>manifest.json</code>. For the full app package,
              select <code>webguide-ai/browser-extension</code>.
            </p>
            <h3>Cannot see Load unpacked?</h3>
            <p>
              Use the full desktop extensions settings, then turn on Developer mode. You do not need
              Pack extension. If your organisation blocks it, contact its administrator.
            </p>
            <p>
              Safari and mobile browsers are unsupported. The practice website needs no extension.
            </p>
          </details>
        </section>
        <section className="gf-card" aria-labelledby="companion-open-title">
          <span className="wg-step-number" aria-hidden="true">
            02
          </span>
          <h2 id="companion-open-title">Open your website</h2>
          <p id="website-activation-help">
            On the new tab, choose the WebGuide extension icon, then{" "}
            <strong>Open companion on this page</strong>.
          </p>
          <form
            className="wg-site-form"
            onSubmit={(e) => {
              e.preventDefault();
              websiteLink.current?.click();
            }}
          >
            <label>
              Website address
              <input
                type="url"
                required
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setError("");
                  setNextStep("");
                }}
              />
            </label>
            <a
              ref={websiteLink}
              aria-describedby="website-activation-help"
              className="wg-action"
              href={safeUrl || "#"}
              onClick={openWebsite}
              target={safeUrl ? "_blank" : undefined}
              rel="noreferrer"
            >
              Open website in a new tab
            </a>
          </form>
          {error && <p role="alert">{error}</p>}
          {nextStep && (
            <p className="gf-notice" role="status">
              {nextStep}
            </p>
          )}
          <details>
            <summary>The website opened but no WebGuide appeared</summary>
            <p>
              Opening a tab does not activate the extension. Pin WebGuide in the browser’s
              Extensions menu, then choose its icon on your website. Repeat after a full page
              navigation.
            </p>
            <p>
              Check it is enabled in this browser profile. Browser settings, extension stores and
              protected viewers cannot be assisted.
            </p>
            <p>
              Keyboard shortcut: Alt+Shift+W on Windows; Option+Shift+W on Mac. Configure conflicts
              in your browser’s extension shortcut settings.
            </p>
          </details>
        </section>
      </div>
      <details className="gf-card">
        <summary>Voice, AI connection and privacy</summary>
        <p>
          Choose Start voice guide for spoken help. Allow page reading before WebGuide inspects the
          page. Listen starts the microphone; Stop or Escape ends assistance.
        </p>
        <p>
          For AI help, choose Connect an AI guidance worker in the extension popup, then approve
          page sharing for each request. Reconnect after the browser session ends. Reading and
          navigation can work without AI.
        </p>
        <p>
          Use your screen reader or typed commands when speech is unavailable. Browser speech
          services may process audio online. Unsupported frames, images and unlabelled controls may
          limit guidance; WebGuide does not replace a screen reader.
        </p>
      </details>
    </section>
  );
}
