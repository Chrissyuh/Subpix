import { useEffect, useRef, type ReactElement } from "react";
import { Download, FileJson, Monitor, Paintbrush, ShieldAlert, Workflow } from "lucide-react";
import "./Site.css";

const DOWNLOAD_URL = "https://github.com/Chrissyuh/Subpix/releases/latest";
const GITHUB_URL = "https://github.com/Chrissyuh/Subpix";

function ProductCanvas(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const scale = window.devicePixelRatio || 1;
    const width = 720;
    const height = 420;
    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);

    context.fillStyle = "#070707";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(255,255,255,0.08)";
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 24) {
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 24) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(width, y + 0.5);
      context.stroke();
    }

    const originX = 96;
    const originY = 78;
    const cellW = 8;
    const cellH = 26;
    const columns = 64;
    const rows = 10;
    const slotColors = ["#ff3b3b", "#40ff76", "#4b7dff"];

    context.fillStyle = "#111111";
    context.fillRect(originX - 18, originY - 18, columns * cellW + 36, rows * cellH + 36);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1;
    context.strokeRect(originX - 18.5, originY - 18.5, columns * cellW + 37, rows * cellH + 37);

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const slot = x % 3;
        const wave = Math.sin((x + y * 3) / 5) > 0.25;
        const diagonal = Math.abs(x - y * 5 - 9) < 4 || Math.abs(x + y * 5 - 55) < 4;
        const mark = wave || diagonal || (x > 37 && x < 53 && y > 2 && y < 8);
        context.fillStyle = mark ? slotColors[slot] : "rgba(255,255,255,0.035)";
        context.globalAlpha = mark ? 0.92 : 1;
        context.fillRect(originX + x * cellW, originY + y * cellH, cellW - 1, cellH - 1);
      }
    }

    context.globalAlpha = 1;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(originX + (columns * cellW) / 2, originY + (rows * cellH) / 2, 4, 0, Math.PI * 2);
    context.fill();

  }, []);

  return <canvas aria-label="Subpix editor preview" className="product-canvas" ref={canvasRef} />;
}

function BrandMark(): ReactElement {
  return (
    <svg aria-hidden="true" className="site-brand-mark" viewBox="0 0 34 34">
      <rect className="site-brand-mark__shell" x="1" y="1" width="32" height="32" rx="6" />
      <rect className="site-brand-mark__slot site-brand-mark__slot--r" x="7" y="7" width="6" height="20" rx="2" />
      <rect className="site-brand-mark__slot site-brand-mark__slot--g" x="14" y="7" width="6" height="20" rx="2" />
      <rect className="site-brand-mark__slot site-brand-mark__slot--b" x="21" y="7" width="6" height="20" rx="2" />
    </svg>
  );
}

function GitHubMark(): ReactElement {
  return (
    <svg aria-hidden="true" className="github-mark" viewBox="0 0 98 96">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.85 0C21.88 0 0 21.88 0 48.85c0 21.58 13.99 39.89 33.39 46.35 2.44.45 3.34-1.06 3.34-2.35 0-1.16-.04-4.23-.07-8.3-13.58 2.95-16.44-6.54-16.44-6.54-2.22-5.64-5.42-7.14-5.42-7.14-4.43-3.03.34-2.97.34-2.97 4.9.34 7.48 5.03 7.48 5.03 4.35 7.45 11.41 5.3 14.2 4.05.44-3.15 1.7-5.3 3.1-6.52-10.84-1.23-22.24-5.42-22.24-24.14 0-5.33 1.9-9.69 5.03-13.1-.5-1.24-2.18-6.21.48-12.94 0 0 4.1-1.31 13.43 5.01a46.72 46.72 0 0 1 24.44 0c9.33-6.32 13.42-5.01 13.42-5.01 2.67 6.73.99 11.7.49 12.94 3.13 3.41 5.02 7.77 5.02 13.1 0 18.77-11.42 22.89-22.3 24.1 1.75 1.51 3.31 4.49 3.31 9.05 0 6.53-.06 11.8-.06 13.4 0 1.3.88 2.82 3.36 2.34C83.87 88.72 97.7 70.42 97.7 48.85 97.7 21.88 75.83 0 48.85 0Z"
      />
    </svg>
  );
}

export function Site(): ReactElement {
  return (
    <main className="site-shell">
      <nav className="site-nav" aria-label="Main">
        <a className="site-brand" href="#top" aria-label="Subpix home">
          <BrandMark />
          <span>Subpix</span>
        </a>
        <div className="site-nav__links">
          <a href="#workflow">Workflow</a>
          <a href="#format">Format</a>
          <a href="#compatibility">Compatibility</a>
          <a href={GITHUB_URL}>GitHub</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero__copy">
          <h1>Subpix</h1>
          <p className="hero__lede">
            Create, inspect, and export logical subpixel artwork with a real `.subpix` file format built for
            horizontal RGB and BGR stripe displays.
          </p>
          <div className="hero__actions">
            <a className="button button--primary" href={DOWNLOAD_URL}>
              <Download size={18} />
              Download for Windows
            </a>
            <a className="button" href={GITHUB_URL}>
              <GitHubMark />
              View on GitHub
            </a>
          </div>
          <p className="hero__note">Unsigned v0.1 Windows builds may show a SmartScreen warning.</p>
        </div>
        <div className="hero__visual" aria-hidden="true">
          <ProductCanvas />
        </div>
      </section>

      <section className="workflow-section" id="workflow">
        <div className="section-heading">
          <p className="eyebrow">Editor workflow</p>
          <h2>Make the source image, then export pixels</h2>
        </div>
        <div className="workflow-steps">
          <article>
            <span>1</span>
            <h3>Create or open</h3>
            <p>Start a `.subpix` document, choose RGB or BGR stripe order, and work on a large simulated grid.</p>
          </article>
          <article>
            <span>2</span>
            <h3>Draw subpixels</h3>
            <p>Use brush, cell eraser, box eraser, lines, rectangles, ellipses, grid controls, and undo/redo.</p>
          </article>
          <article>
            <span>3</span>
            <h3>Save and export</h3>
            <p>Save the editable JSON-backed source file, or pack logical slots into a normal PNG for use elsewhere.</p>
          </article>
        </div>
      </section>

      <section className="feature-grid" aria-label="Subpix features">
        <article>
          <Paintbrush size={22} />
          <h2>Edit the slots inside pixels</h2>
          <p>Draw on a simulated 3 x 1 subpixel grid where every real pixel is split into logical RGB/BGR slots.</p>
        </article>
        <article>
          <FileJson size={22} />
          <h2>Keep the source image</h2>
          <p>`.subpix` stores logical subpixel cells, architecture metadata, and layer data instead of only final pixels.</p>
        </article>
        <article>
          <Monitor size={22} />
          <h2>Preview and export</h2>
          <p>Use the simulated canvas on any display, then export a packed PNG for compatible horizontal stripe screens.</p>
        </article>
        <article>
          <Workflow size={22} />
          <h2>Built like a desktop tool</h2>
          <p>Native menus, file associations, dirty-close protection, and Windows installer builds are part of the app.</p>
        </article>
      </section>

      <section className="info-band" id="format">
        <div>
          <p className="eyebrow">Subpixel Image format</p>
          <h2>A readable JSON format for v1</h2>
        </div>
        <p>
          Subpix files use the `.subpix` extension and store `image/x-subpix` data with document dimensions,
          horizontal-stripe architecture metadata, and 0-255 intensity values for every logical subpixel cell.
        </p>
      </section>

      <section className="details-grid" aria-label="Subpix v1 details">
        <article>
          <h2>What v1 supports</h2>
          <ul>
            <li>Horizontal 3 x 1 stripe subpixels</li>
            <li>RGB and BGR display profiles</li>
            <li>Custom documents from 1 x 1 to 512 x 512 real pixels</li>
            <li>Binary drawing now, 0-255 intensity stored for later tools</li>
          </ul>
        </article>
      </section>

      <section className="split-section" id="compatibility">
        <div>
          <p className="eyebrow">Display profiles</p>
          <h2>RGB and BGR are compatible</h2>
          <p>
            The artwork is stored by logical slot position. RGB export maps slots to red, green, and blue. BGR remaps
            the outside slots for displays with the reverse physical order.
          </p>
        </div>
        <div className="warning-panel">
          <ShieldAlert size={22} />
          <h2>Simulated preview works everywhere</h2>
          <p>
            OLED, PenTile, diamond, and other layouts are not true physical targets yet. Use simulated preview on those
            displays and export PNG only from a compatible RGB or BGR profile.
          </p>
        </div>
      </section>

      <section className="download-panel" id="download">
        <div>
          <p className="eyebrow">Windows release</p>
          <h2>Download the latest installer from GitHub</h2>
          <p>
            Current builds target x64 Windows and use an unsigned assisted NSIS installer. The installer creates Start
            menu and desktop shortcuts, adds an uninstall entry, and registers `.subpix` files with Subpix.
          </p>
        </div>
        <a className="button button--primary" href={DOWNLOAD_URL}>
          <Download size={18} />
          Download for Windows
        </a>
      </section>

      <footer className="site-footer">
        <span>Subpix is open source.</span>
        <a href={DOWNLOAD_URL}>Download latest release</a>
      </footer>
    </main>
  );
}
