import { ImageResponse } from "next/og";
import { SocialCard } from "@/app/metadata-brand";
import { OWCS_SITE_NAME } from "@/app/site-config";

export const alt = `${OWCS_SITE_NAME} 공유 이미지`;

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<SocialCard width={1200} height={630} />, size);
}
