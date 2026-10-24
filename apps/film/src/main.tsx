import "@ledgerline/ui/styles/tokens.css";
import "@ledgerline/ui/styles/components.css";
import "../../web/app/landing.css";
import "./film.css";
import { createRoot } from "react-dom/client";
import { Film, LENGTH } from "./Film";

const params = new URLSearchParams(location.search);
const seek = Number(params.get("seek") ?? 0);
const w = window as unknown as { __filmLength: number; __filmReady: boolean };
w.__filmLength = LENGTH;

// The faces have to be in before the first frame, or the opening titles would render in a fallback.
await Promise.all(
  ['400 16px "Geist"', '500 16px "Geist"', '600 16px "Geist"', '700 16px "Geist"', '400 16px "Geist Mono"', '600 16px "Geist Mono"', '400 16px "Instrument Serif"', 'italic 400 16px "Instrument Serif"'].map((f) => document.fonts.load(f)),
);

createRoot(document.getElementById("root")!).render(<Film seek={seek} onReady={() => (w.__filmReady = true)} />);
