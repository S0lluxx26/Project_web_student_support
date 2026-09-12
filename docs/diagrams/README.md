# Report diagrams

Maker: **Bui Xuan Mai**

[Project repository](https://github.com/S0lluxx26/Project_web_student_support)

These four editable Mermaid definitions describe the implemented system:

| File | Purpose |
|---|---|
| deployment.mmd | Repository, CI gate, Pages and optional Vercel publication |
| data-flow.mmd | Browser data flow, review steps and external boundaries |
| ocr-sequence.mmd | Screenshot recognition, review, analysis and export |
| llm-sequence.mmd | Desktop opt-in, model acquisition, inference and cancellation |

The matching Mermaid blocks live in [the report](../../manual/PROJECT_GUIDE.md).
GitHub renders those blocks; the PDF embeds generated PNG figures. Full-size
SVG links appear beside each figure. No online rendering service is used.

From the repository root, after the ordinary app installation:

```sh
npm ci --prefix docs/report-tools --ignore-scripts
node scripts/render-report-diagrams.mjs
python scripts/build-guide-pdf.py
npm run build
npm run test:report
```

Diagram generation uses the locked Mermaid 12.0.0 package and the application's
Playwright Chromium. It needs Node.js 22.12 or later. Mermaid is installed only
in docs/report-tools/node_modules and never bundled into the app runtime.
The ordinary installation does not need this extra dependency.

For PDF generation, install Python with reportlab, pypdf and Pillow. The default
fonts are Windows Malgun Gothic. On another system, set GUIDE_FONT and
GUIDE_FONT_BOLD to Unicode TrueType font files with Korean coverage. The tool
does not install fonts. See the report for the full reproduction workflow.

Update an .mmd source and its report block together. The renderer records hashes
of each source, SVG and PNG in assets/manual/diagrams/manifest.json. The PDF
builder verifies those hashes, builds a clickable contents page and bookmarks,
checks the extracted headings and writes assets/manual/report-build.json.
The Node-only report check detects stale source, images, PDF or public copies.

Read the Markdown before generating its PDF. Render and inspect every PDF page
after generation. Automated integrity checks do not establish visual quality or
the factual correctness of a diagram. Commit the source, rendered figures,
manifests and published PDF together; generated output/pdf and tmp stay ignored.
