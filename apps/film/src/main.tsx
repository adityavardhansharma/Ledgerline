import "@ledgerline/ui/styles/tokens.css";
import "@ledgerline/ui/styles/components.css";
import "../../web/app/landing.css";
import "./film.css";
import { createRoot } from "react-dom/client";
import { Film, LENGTH, ShortFilm } from "./Film";
import { SHORTS } from "./shorts/Shorts";

const params = new URLSearchParams(location.search);
const seek = Number(params.get("seek") ?? 0);
const short = params.get("short");
const w = window as unknown as { __filmLength: number; __filmReady: boolean };
w.__filmLength = short ? SHORTS[short].length : LENGTH;

// The faces have to be in before the first frame, or the opening titles would render in a fallback.
await Promise.all(
  ['400 16px "Geist"', '500 16px "Geist"', '600 16px "Geist"', '700 16px "Geist"', '400 16px "Geist Mono"', '600 16px "Geist Mono"', '400 16px "Instrument Serif"', 'italic 400 16px "Instrument Serif"'].map((f) => document.fonts.load(f)),
);

const ready = () => (w.__filmReady = true);
createRoot(document.getElementById("root")!).render(short ? <ShortFilm id={short} seek={seek} onReady={ready} /> : <Film seek={seek} onReady={ready} />);
