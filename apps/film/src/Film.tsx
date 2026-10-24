import { useEffect, useState } from "react";
import { Grain } from "./lib/fx";
import { Clock, Seq } from "./lib/time";
import { Actions, ACTIONS_LENGTH } from "./scenes/Actions";
import { Ask } from "./scenes/Ask";
import { Connect } from "./scenes/Connect";
import { Finale } from "./scenes/Finale";
import { Forecast } from "./scenes/Forecast";
import { ColdOpen, TheQuestion, TitleCard } from "./scenes/Opening";
import { Overview } from "./scenes/Overview";
import { Trust } from "./scenes/Trust";

/** The cut: each scene's start and length in seconds. The score (render/score.mjs) is timed to the same marks. */
export const CUT = {
  open: [0, 7.5],
  question: [7.5, 5.5],
  title: [13, 6],
  connect: [19, 11],
  overview: [30, 9],
  ask: [39, 16],
  actions: [55, ACTIONS_LENGTH],
  forecast: [72.5, 10.5],
  trust: [83, 13],
  finale: [96, 14],
} as const;
export const LENGTH = 110;

const SCENES = [
  ["open", ColdOpen],
  ["question", TheQuestion],
  ["title", TitleCard],
  ["connect", Connect],
  ["overview", Overview],
  ["ask", Ask],
  ["actions", Actions],
  ["forecast", Forecast],
  ["trust", Trust],
  ["finale", Finale],
] as const;

function useFit() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return scale;
}

export function Film({ seek, onReady }: { seek: number; onReady: () => void }) {
  const scale = useFit();
  return (
    <div className="film-viewport">
      <div className="film" style={{ transform: `scale(${scale})` }}>
        <Clock seek={seek} length={LENGTH} onReady={onReady}>
          {SCENES.map(([key, Scene]) => (
            <Seq key={key} at={CUT[key][0]} dur={CUT[key][1]}>
              <Scene />
            </Seq>
          ))}
          <Grain />
        </Clock>
      </div>
    </div>
  );
}
