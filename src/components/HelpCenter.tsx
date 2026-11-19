import { useState } from "react";
const faqs = [
  {
    category: "Voice access",
    question: "How do I start spoken guidance?",
    answer:
      "Use the Skip to voice controls link, then Start voice guide. Allow page reading before asking WebGuide to inspect this page. Choose Listen only when you want microphone input. You can use the keyboard and your screen reader without a microphone.",
    destination: "Overview",
  },
  {
    category: "Voice access",
    question: "Can I use Hindi or English?",
    answer:
      "Choose your language in the voice controls. The browser supplies available voices and recognition. If a Hindi voice is unavailable, use readable responses or your screen reader. Website text is read as written, not automatically translated.",
    destination: "Overview",
  },
  {
    category: "Voice access",
    question: "How do I stop speech or cancel an action?",
    answer:
      "Use Stop or press Escape to cancel WebGuide speech, listening and pending actions, and revoke page-reading permission. Your screen reader has its own stop command. Click requests require confirmation. Never dictate passwords or payment details.",
    destination: "Overview",
  },
  {
    category: "Voice access",
    question: "How does WebGuide work on other websites?",
    answer:
      "Install the desktop Chrome or Edge companion, visit the website and activate it from the extensions menu. It can read visible text and move through accessible controls on that tab. Restricted browser pages and cross-origin frames are not supported.",
    destination: "Website companion",
  },
  {
    category: "Getting started",
    question: "How do I create my first tutorial?",
    answer:
      "Choose Run Autonomous Demo to explore the disposable TaskDesk. WebGuide records observed actions and generates tutorials from verified results. Open Tutorials to read detailed steps or switch to a quick refresher.",
    destination: "Tutorials",
  },
  {
    category: "Getting started",
    question: "What is the difference between the demo and AI exploration?",
    answer:
      "The built-in demo uses deterministic rules and runs in this browser. Explorer’s connected worker uses a separate Chromium browser and can plan with your configured local model. A successful demo does not prove that AI is connected.",
    destination: "Explorer",
  },
  {
    category: "Local AI",
    question: "Do I need a cloud API key?",
    answer:
      "No. Extract the complete package and double-click Start WebGuide.command on Mac or Start WebGuide.bat on Windows. The launcher downloads and starts the private local Qwen model and connects the app. The first download needs internet access and time.",
    destination: "Explorer",
  },
  {
    category: "Local AI",
    question: "Why does the worker show disconnected?",
    answer:
      "Double-click the same launcher again, or type o then Return in its original window. It verifies the running services and reopens the app with a fresh one-use connection. Keep the launcher window open. Extension connection is separate; follow Website companion setup.",
    destination: "Explorer",
  },
  {
    category: "Local AI",
    question: "The worker is connected, but AI is unavailable. What should I check?",
    answer:
      "Read the error in the launcher window. Check internet access during first setup and available disk space, then retry the launcher. Wait for its real model-response check. Advanced endpoint changes require restarting the worker. Local keyboard navigation does not require AI.",
    destination: "Explorer",
  },
  {
    category: "Local AI",
    question: "Why is Ask this job temporarily disabled?",
    answer:
      "The worker allows one exploration or model request at a time. Wait for the active job or inference to finish. Its recorded tutorial evidence remains available while you wait.",
    destination: "Explorer",
  },
  {
    category: "Websites & evidence",
    question: "Can WebGuide explore any website or sign in for me?",
    answer:
      "External-site mode currently inspects public visible controls with page JavaScript disabled. It does not sign in, submit forms or execute arbitrary workflows. Use only authorised sites. Dynamic or protected pages may provide limited evidence; native applications are not supported.",
    destination: "Saved websites",
  },
  {
    category: "Websites & evidence",
    question: "What does a partial or unverified result mean?",
    answer:
      "An action limit, unsupported control, authentication boundary or unchanged outcome can stop verification. Discovery alone is not proof that a workflow succeeded. Read the run’s recorded actions and limitations before using its instructions.",
    destination: "Run history",
  },
  {
    category: "Websites & evidence",
    question: "How do I reuse a website address?",
    answer:
      "Add it under Saved websites. Open in Explorer fills the address and selects external-site mode; it does not start a scan automatically. Website names and addresses can be edited or removed.",
    destination: "Saved websites",
  },
  {
    category: "Tutorials",
    question: "How do bookmarks and completion work?",
    answer:
      "In Tutorials, bookmark useful guides or mark guides complete. Use the collection filter to find them again. Completion records your reading progress; it does not change the guide’s verification status.",
    destination: "Tutorials",
  },
  {
    category: "Tutorials",
    question: "Can I download or print a guide?",
    answer:
      "Each tutorial can be downloaded as Markdown. Print guides prints the currently filtered library. For a full browser-local backup, use Export local evidence in Settings. These actions create local files, not public share links.",
    destination: "Tutorials",
  },
  {
    category: "Tutorials",
    question: "Why can’t WebGuide answer my question?",
    answer:
      "Answers require recorded evidence. Ask WebGuide searches your local demo tutorials; questions about worker scans belong in the relevant job panel. An unsupported question is refused instead of inventing steps.",
    destination: "Ask WebGuide",
  },
  {
    category: "Profile & data",
    question: "Is my profile an online account?",
    answer:
      "No. Display name, optional email, avatar colour and workspace preferences are stored in this browser. They do not create a login, send email or sync to another device.",
    destination: "Profile",
  },
  {
    category: "Profile & data",
    question: "How do I back up or move my workspace?",
    answer:
      "In Settings, export a backup containing local demo evidence, profile, preferences, saved websites and tutorial progress. Import that file in the destination browser, review the counts, then confirm replacement. Invalid backups leave existing data unchanged. Worker jobs are not included.",
    destination: "Settings",
  },
  {
    category: "Profile & data",
    question: "Why did worker jobs disappear after a restart?",
    answer:
      "Worker evidence is saved in local SQLite and survives a normal restart. Interrupted jobs are marked cancelled, and records expire according to retention settings. Clearing the app data folder or changing the data directory changes what is available. Browser-local demo guides are stored separately.",
    destination: "Settings",
  },
  {
    category: "Profile & data",
    question: "What happens when I reset the demo or delete records?",
    answer:
      "Reset demo restores the disposable TaskDesk and marks earlier guides for re-verification. Delete local records clears demo evidence and tutorial progress while keeping your profile and saved websites. Deleting a run also deletes its linked tutorials. Export a backup first if you want to keep them.",
    destination: "Settings",
  },
] as const;
export function HelpCenter({ onNavigate }: { onNavigate: (destination: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All topics");
  const filtered = faqs.filter(
    (f) =>
      (category === "All topics" || f.category === category) &&
      `${f.question} ${f.answer}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <section className="gf-stack" aria-label="Frequently asked questions">
      <div className="gf-card">
        <span className="gf-pill">HELP CENTRE</span>
        <h2>A little guidance, right when you need it.</h2>
        <p className="gf-muted">Practical answers about setup, evidence and your workspace.</p>
        <div className="gf-toolbar">
          <input
            type="search"
            aria-label="Search FAQs"
            placeholder="Search questions, e.g. backup or AI…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="FAQ topic"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["All topics", ...new Set(faqs.map((f) => f.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setQuery("");
              setCategory("All topics");
            }}
          >
            Clear filters
          </button>
        </div>
      </div>
      <p role="status" className="gf-muted">
        {filtered.length} {filtered.length === 1 ? "answer" : "answers"} found
      </p>
      {filtered.map((f) => (
        <details className="gf-card gf-faq" key={f.question}>
          <summary>
            {f.question}
            <span>{f.category}</span>
          </summary>
          <div>
            <p>{f.answer}</p>
            <button onClick={() => onNavigate(f.destination)}>Open {f.destination}</button>
          </div>
        </details>
      ))}
      {!filtered.length && (
        <div className="gf-empty">
          <h3>No matching answers</h3>
          <p>Try a shorter search or choose All topics.</p>
          <button
            onClick={() => {
              setQuery("");
              setCategory("All topics");
            }}
          >
            Show all FAQs
          </button>
        </div>
      )}
    </section>
  );
}
