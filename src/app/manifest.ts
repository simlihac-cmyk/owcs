import type { MetadataRoute } from "next";
import {
  OWCS_SITE_DESCRIPTION,
  OWCS_SITE_NAME,
  OWCS_SITE_SHORT_NAME
} from "@/app/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: OWCS_SITE_NAME,
    short_name: OWCS_SITE_SHORT_NAME,
    description: OWCS_SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#f28b2f",
    lang: "ko-KR",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png"
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };
}
