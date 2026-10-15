# Local font assets

The Chinese site uses Noto Serif SC for headings and Noto Sans SC for interface and body text. They are the Google Noto distributions of the shared Source Han CJK designs.

- Families in CSS: `Nuo Serif`, `Nuo Sans`.
- Style: upright variable weight 400–700.
- Each family has 101 original Google Fonts Unicode subsets, preserving coverage for user-entered Chinese text. The browser requests only subsets containing characters used in the document.
- Files are served locally through `/fonts.css`; no external font service is contacted at runtime.
- Downloaded 2026-10-07 from the official Google Fonts CSS API and `fonts.gstatic.com`.
- Noto Sans SC source manifest: https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400..700&display=swap
- Noto Serif SC source manifest: https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400..700&display=swap
- Official family pages: https://fonts.google.com/noto/specimen/Noto+Sans+SC and https://fonts.google.com/noto/specimen/Noto+Serif+SC
- Redistribution license: SIL Open Font License 1.1; original licenses are retained as `OFL-NotoSansSC.txt` and `OFL-NotoSerifSC.txt` from https://github.com/google/fonts/tree/main/ofl .

To update, download the official CSS for the same weight range, copy each referenced WOFF2 file locally, preserve its `unicode-range`, and retain the license. Filenames are local aliases; font binaries are unmodified.
