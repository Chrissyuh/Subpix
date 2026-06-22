/// <reference types="vite/client" />

import type { DesktopApi } from "@/app/desktopApiTypes";

declare global {
  interface Window {
    subpixDesktop?: DesktopApi;
  }
}

export {};

