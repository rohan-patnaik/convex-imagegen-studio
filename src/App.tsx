import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "./convexApi";
import "./App.css";

type ImageGeneration = {
  _id: string;
  prompt: string;
  status: string;
  model: string;
  provider?: string;
  aspectRatio: string;
  resolution: string;
  outputFormat: string;
  numImages: number;
  createdAt: number;
  updatedAt: number;
  imageUrls?: string[];
  error?: string;
};

type Provider = "fal" | "huggingface";
type Theme = "light" | "dark";

type ProviderOption = {
  id: Provider;
  label: string;
  model: string;
  description: string;
};

const providerOptions: ProviderOption[] = [
  {
    id: "fal",
    label: "Fal.ai",
    model: "Nano Banana Pro",
    description: "Premium quality and full control over aspect ratio, resolution, and output format.",
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    model: "SDXL Lightning",
    description: "Free API tier; outputs 1024px PNG images for quick experiments.",
  },
];

const aspectRatios = ["1:1", "4:3", "3:2", "16:9", "9:16"];
const resolutions = ["1K", "2K", "4K"];
const outputFormats = ["png", "jpeg", "webp"];

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem("theme");
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

function App() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("fal");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("1K");
  const [outputFormat, setOutputFormat] = useState("png");
  const [numImages, setNumImages] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateImage = useAction(api.images.generate);
  const images = (useQuery(api.images.list, { limit: 18 }) ?? []) as ImageGeneration[];

  const imageCount = images.length;
  const activeProvider = providerOptions.find((option) => option.id === provider);
  const isHuggingFace = provider === "huggingface";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setError("Describe the image you want to create.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      await generateImage({
        prompt: trimmedPrompt,
        aspectRatio,
        resolution,
        outputFormat,
        numImages,
        provider,
      });
      setPrompt("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to generate image.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProviderChange = (value: Provider) => {
    setProvider(value);
    if (value === "huggingface") {
      setResolution("1K");
      setOutputFormat("png");
    }
    setError(null);
  };

  const handleReset = () => {
    setPrompt("");
    setProvider("fal");
    setAspectRatio("1:1");
    setResolution("1K");
    setOutputFormat("png");
    setNumImages(1);
    setError(null);
  };

  return (
    <div className="app">
      <div className="frame">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">◎</span>
            <div>
              <span className="brand-name">Convex Image Studio</span>
              <span className="brand-subtitle">Neo-brutalist image lab</span>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="status-pill">Fal.ai + Hugging Face</span>
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-pressed={theme === "dark"}
            >
              <span className="theme-label">{theme === "light" ? "Light Mode" : "Dark Mode"}</span>
              <span className="theme-icon">{theme === "light" ? "☀︎" : "☾"}</span>
            </button>
          </div>
        </header>

        <section className="hero-grid">
          <div className="hero-panel">
            <p className="eyebrow">Neo-brutalist image studio</p>
            <h1>Build bold prompts with precision.</h1>
            <p className="lead">
              Craft cinematic prompts with Nano Banana Pro or SDXL Lightning. Every render is stored
              instantly in Convex so your team can iterate fast.
            </p>
            <div className="hero__stats">
              <div className="stat-card">
                <span className="stat-title">Model</span>
                <span className="stat-value">Nano Banana Pro + SDXL Lightning</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">Backend</span>
                <span className="stat-value">Convex Actions</span>
              </div>
              <div className="stat-card">
                <span className="stat-title">Sessions</span>
                <span className="stat-value">{imageCount} generations</span>
              </div>
            </div>
          </div>
          <div className="hero-panel hero-panel--notes">
            <div className="panel-header">
              <h3>Studio notes</h3>
              <span className="chip">Guides</span>
            </div>
            <p>
              Blend lighting, lens, and composition cues to unlock Gemini-grade detail. Use the
              controls below to experiment with aspect ratios and resolution.
            </p>
            <div className="tips">
              <div>
                <span className="tip-title">Scene</span>
                <span className="tip-body">Describe subject, action, and environment.</span>
              </div>
              <div>
                <span className="tip-title">Style</span>
                <span className="tip-body">Specify mood, medium, or era for coherence.</span>
              </div>
              <div>
                <span className="tip-title">Output</span>
                <span className="tip-body">Increase resolution for hero images.</span>
              </div>
            </div>
          </div>
        </section>

        <main className="studio-grid">
        <section className="panel controls">
          <h2>Create a generation</h2>
          <form className="prompt-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Provider</span>
              <div className="provider-toggle">
                {providerOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`provider-button ${
                      provider === option.id ? "provider-button--active" : ""
                    }`}
                    onClick={() => handleProviderChange(option.id)}
                  >
                    <span className="provider-label">{option.label}</span>
                    <span className="provider-model">{option.model}</span>
                  </button>
                ))}
              </div>
            </label>
            {activeProvider ? <p className="provider-note">{activeProvider.description}</p> : null}
            <label className="field">
              <span>Prompt</span>
              <textarea
                placeholder="A cinematic shot of a neon-lit rain-soaked Tokyo alley..."
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={5}
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Aspect ratio</span>
                <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
                  {aspectRatios.map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Resolution</span>
                <select
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  disabled={isHuggingFace}
                >
                  {resolutions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Format</span>
                <select
                  value={outputFormat}
                  onChange={(event) => setOutputFormat(event.target.value)}
                  disabled={isHuggingFace}
                >
                  {outputFormats.map((format) => (
                    <option key={format} value={format}>
                      {format.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Images</span>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={numImages}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    const clamped = Number.isNaN(value) ? 1 : Math.min(4, Math.max(1, value));
                    setNumImages(clamped);
                  }}
                />
              </label>
            </div>
            <div className="actions">
              <button className="primary" type="submit" disabled={isGenerating}>
                {isGenerating ? "Generating..." : "Generate image"}
              </button>
              <button className="ghost" type="button" onClick={handleReset}>
                Reset
              </button>
            </div>
            {error ? <p className="error">{error}</p> : null}
          </form>
        </section>

        <section className="panel gallery">
          <div className="panel__header">
            <div>
              <h2>Latest generations</h2>
              <p>Stored in Convex for rapid remixing.</p>
            </div>
            <span className="badge">{imageCount} total</span>
          </div>
          <div className="gallery-grid">
            {images.length === 0 ? (
              <div className="empty-state">
                <h3>No images yet</h3>
                <p>Start your first prompt to populate the studio gallery.</p>
              </div>
            ) : (
              images.map((image) => {
                const primaryImage = image.imageUrls?.[0];
                const extraImages = image.imageUrls && image.imageUrls.length > 1
                  ? image.imageUrls.length - 1
                  : 0;
                const aspectRatioValue = image.aspectRatio?.includes(":")
                  ? image.aspectRatio.replace(":", " / ")
                  : "1 / 1";
                const providerLabel = image.provider === "huggingface" ? "Hugging Face" : "Fal.ai";
                return (
                  <article key={image._id} className="image-card">
                    <div className="image-frame" style={{ aspectRatio: aspectRatioValue }}>
                      {primaryImage ? (
                        <img src={primaryImage} alt={image.prompt} />
                      ) : (
                        <div className="image-placeholder">Queued</div>
                      )}
                      <span className={`status status--${image.status}`}>{image.status}</span>
                      {extraImages > 0 ? <span className="count">+{extraImages}</span> : null}
                    </div>
                    <div className="image-meta">
                      <p className="prompt">{image.prompt}</p>
                      <div className="meta-row">
                        <span>{providerLabel}</span>
                        <span>{image.aspectRatio}</span>
                        <span>{image.resolution}</span>
                        <span>{image.outputFormat.toUpperCase()}</span>
                      </div>
                    </div>
                    {image.error ? <p className="error">{image.error}</p> : null}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
    </div>
  );
}

export default App;
