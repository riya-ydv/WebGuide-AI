import { useEffect, useState, type FormEvent } from "react";
import { avatarColors, workspaceSchema, type Workspace } from "@/features/webguide/workspace";

interface Props {
  value: Workspace;
  onChange: (next: Workspace) => void;
  section?: "profile" | "preferences";
}

export function WorkspaceSettings({ value, onChange, section = "profile" }: Props) {
  const [profile, setProfile] = useState(value.profile);
  const [preferences, setPreferences] = useState(value.preferences);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setProfile(value.profile);
  }, [value.profile]);
  useEffect(() => {
    setPreferences(value.preferences);
  }, [value.preferences]);
  useEffect(() => {
    setError("");
    setMessage("");
  }, [section]);
  function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const result = workspaceSchema.safeParse({
      ...value,
      ...(section === "profile" ? { profile } : { preferences }),
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check your settings");
      return;
    }
    onChange(result.data);
    setMessage(
      section === "profile"
        ? "Profile saved in this browser."
        : "Preferences saved in this browser.",
    );
  }
  return (
    <form className="gf-card gf-settings-form" onSubmit={save}>
      <h2>{section === "profile" ? "Your profile" : "Workspace preferences"}</h2>
      <p className="gf-muted">
        Stored in this browser only. This profile is not an account or sign-in.
      </p>
      {section === "profile" ? (
        <>
          <div className="gf-profile-preview">
            <span
              className="gf-avatar"
              role="img"
              aria-label={`Avatar for ${profile.displayName || "your profile"}`}
              style={{ backgroundColor: avatarColors[profile.avatarColor], color: "#fff" }}
            >
              {Array.from(profile.displayName.trim())[0]?.toUpperCase() || "G"}
            </span>
            <strong>{profile.displayName || "Your profile"}</strong>
          </div>
          <label className="gf-worker-label">
            Display name
            <input
              required
              maxLength={80}
              value={profile.displayName}
              onChange={(event) => {
                setMessage("");
                setProfile({ ...profile, displayName: event.target.value });
              }}
            />
          </label>
          <label className="gf-worker-label">
            Email (optional)
            <input
              type="email"
              maxLength={254}
              value={profile.email}
              onChange={(event) => {
                setMessage("");
                setProfile({ ...profile, email: event.target.value });
              }}
            />
          </label>
          <label className="gf-worker-label">
            Role or title (optional)
            <input
              maxLength={80}
              value={profile.role}
              onChange={(event) => {
                setMessage("");
                setProfile({ ...profile, role: event.target.value });
              }}
            />
          </label>
          <label className="gf-worker-label">
            Workspace name
            <input
              required
              maxLength={80}
              value={profile.workspaceName}
              onChange={(event) => {
                setMessage("");
                setProfile({ ...profile, workspaceName: event.target.value });
              }}
            />
          </label>
          <label className="gf-worker-label">
            Avatar colour
            <select
              value={profile.avatarColor}
              onChange={(event) => {
                setMessage("");
                setProfile({
                  ...profile,
                  avatarColor: event.target.value as Workspace["profile"]["avatarColor"],
                });
              }}
            >
              {Object.keys(avatarColors).map((color) => (
                <option key={color} value={color}>
                  {color[0]?.toUpperCase()}
                  {color.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="gf-worker-label">
            Default instruction mode
            <select
              value={preferences.defaultInstructionMode}
              onChange={(event) => {
                setMessage("");
                setPreferences({
                  ...preferences,
                  defaultInstructionMode: event.target.value as "beginner" | "refresher",
                });
              }}
            >
              <option value="beginner">Beginner — detailed steps</option>
              <option value="refresher">Refresher — concise steps</option>
            </select>
          </label>
          <label className="gf-setting-toggle">
            <input
              type="checkbox"
              checked={preferences.compactLayout}
              onChange={(event) => {
                setMessage("");
                setPreferences({ ...preferences, compactLayout: event.target.checked });
              }}
            />{" "}
            Compact layout
          </label>
          <label className="gf-setting-toggle">
            <input
              type="checkbox"
              checked={preferences.reducedMotion}
              onChange={(event) => {
                setMessage("");
                setPreferences({ ...preferences, reducedMotion: event.target.checked });
              }}
            />{" "}
            Reduce motion
          </label>
        </>
      )}
      {error && (
        <p className="gf-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="gf-notice" role="status">
          {message}
        </p>
      )}
      <button type="submit" className="gf-primary">
        {section === "profile" ? "Save profile" : "Save preferences"}
      </button>
    </form>
  );
}

export default WorkspaceSettings;
