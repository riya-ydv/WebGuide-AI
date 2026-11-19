import { useState } from "react";
import { savedSiteSchema, type Workspace } from "@/features/webguide/workspace";
export function SavedWebsites({
  value,
  onChange,
  onOpen,
}: {
  value: Workspace;
  onChange: (value: Workspace) => void;
  onOpen: (url: string) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string>();
  const [removing, setRemoving] = useState<string>();
  return (
    <section className="gf-card">
      <h2>Saved websites</h2>
      <p className="gf-muted">
        Save authorised websites for your next exploration. Opening a website fills the Explorer
        form; you choose when to start.
      </p>
      <form
        className="gf-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          const result = savedSiteSchema.safeParse({
            id: editing ?? crypto.randomUUID(),
            name,
            url,
          });
          if (!result.success) {
            setError("Enter a name and valid HTTP/HTTPS URL without credentials.");
            return;
          }
          if (!editing && value.savedSites.length >= 100) {
            setError("You can save up to 100 websites.");
            return;
          }
          onChange({
            ...value,
            savedSites: editing
              ? value.savedSites.map((s) => (s.id === editing ? result.data : s))
              : [...value.savedSites, result.data],
          });
          setName("");
          setUrl("");
          setEditing(undefined);
          setError("");
        }}
      >
        <input
          aria-label="Website name"
          placeholder="Website name"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          aria-label="Saved website URL"
          placeholder="https://example.com"
          value={url}
          maxLength={2000}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button className="gf-primary">{editing ? "Save website changes" : "Save website"}</button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setName("");
              setUrl("");
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
      {!value.savedSites.length && <p className="gf-empty">No saved websites yet.</p>}
      {value.savedSites.map((site) => (
        <article className="gf-card" key={site.id}>
          <h3>{site.name}</h3>
          <p className="gf-break">{site.url}</p>
          <div className="gf-toolbar">
            <button onClick={() => onOpen(site.url)}>Open in Explorer</button>
            <button
              onClick={() => {
                setEditing(site.id);
                setName(site.name);
                setUrl(site.url);
              }}
            >
              Edit website
            </button>
            <button onClick={() => setRemoving(site.id)}>Remove website</button>
            {removing === site.id && (
              <>
                <span>Remove this saved website?</span>
                <button
                  onClick={() => {
                    onChange({
                      ...value,
                      savedSites: value.savedSites.filter((s) => s.id !== site.id),
                    });
                    setRemoving(undefined);
                  }}
                >
                  Confirm remove
                </button>
                <button onClick={() => setRemoving(undefined)}>Keep website</button>
              </>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
