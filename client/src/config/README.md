# Cutscene configuration

Edit **`cutscenes.ts`** to change intro (and other) cutscene content without touching the scene components.

- **`introCutscene.steps`** – Add, remove, or reorder steps. Each step has:
  - `type`: `'title' | 'subtitle' | 'text' | 'spacer'`
  - `text`: The copy shown on screen
  - `className`: Tailwind/CSS classes for the element
  - `duration`, `ease`, `fromY`, `positionOffset`: Animation options
  - `showSkipAfter: true`: Show the Skip button when this step finishes

- **`holdBeforeFade`** – Seconds to hold before the fade-out starts.
- **`fadeOutDuration`** – Length of the fade-out.
- **`overlayClassName`** – Background of the full-screen overlay (e.g. `bg-slate-950`).

To add another cutscene (e.g. outro), export a new config object and pass it to `<IntroCutscene config={myOtherCutscene} />`.
