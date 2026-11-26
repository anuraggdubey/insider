"use client";

import { create } from "zustand";

export type FloorView = "simple" | "full";

const GUIDE_KEY = "insider.guide.v1";
const VIEW_KEY = "insider.floor.view.v1";
/** Set by an earlier version of the guide; those players have already been introduced. */
const OLD_GUIDE_KEY = "insider.guide.seen.v1";

type Prefs = {
  /** False until the saved choices are read, so the guide never flashes for returning players. */
  loaded: boolean;
  guideSeen: boolean;
  view: FloorView;
};

/** How this browser likes the floor. Display choices only, kept in localStorage. */
export const useFloorPrefs = create<Prefs>(() => ({
  loaded: false,
  guideSeen: false,
  view: "simple",
}));

export function loadFloorPrefs() {
  try {
    useFloorPrefs.setState({
      loaded: true,
      guideSeen:
        window.localStorage.getItem(GUIDE_KEY) === "seen" ||
        window.localStorage.getItem(OLD_GUIDE_KEY) !== null,
      view: window.localStorage.getItem(VIEW_KEY) === "full" ? "full" : "simple",
    });
  } catch {
    useFloorPrefs.setState({ loaded: true });
  }
}

export function markGuideSeen() {
  useFloorPrefs.setState({ guideSeen: true });
  try {
    window.localStorage.setItem(GUIDE_KEY, "seen");
  } catch {}
}

export function setFloorView(view: FloorView) {
  useFloorPrefs.setState({ view });
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {}
}
