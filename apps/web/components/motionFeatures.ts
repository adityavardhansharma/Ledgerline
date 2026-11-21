import { domAnimation, domMax } from "motion/react";

// Animation features, loaded after the page itself (see MotionProvider). The app needs only animations, exits,
// hover and tap; the landing page's navigation also uses shared-layout animations, which only domMax has.
export { domAnimation, domMax };
