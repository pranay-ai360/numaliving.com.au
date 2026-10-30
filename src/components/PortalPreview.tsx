import { withBasePath } from "@/lib/assetPath";
import { LAZY_IMAGE_PROPS } from "./ui";

/**
 * Laptop + phone showing real screenshots of the client portal (home page, "Every Approval, Online").
 * The screenshots live in /public/portal-preview/. To update them, replace those two files
 * (keep the same names), or ask for fresh screenshots of the demo.
 */
export function PortalPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[640px] sm:pb-[6%]">
      {/* Laptop: hidden on small phones, where it would be too small to read */}
      <div className="hidden w-[88%] sm:block">
        <div className="overflow-hidden rounded-t-[14px] rounded-b-sm border-[10px] border-b-[14px] border-[#2e2b27] bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBasePath("/portal-preview/portal-desktop.jpg")}
            alt="The Numa client portal on a laptop: project stage, approvals waiting, open RFIs and the latest factory updates"
            {...LAZY_IMAGE_PROPS}
            className="block aspect-[1440/820] w-full object-cover object-top"
          />
        </div>
        <div className="relative -mx-[6%] h-3.5 rounded-b-[12px] bg-gradient-to-b from-[#3a3631] to-[#24221f]">
          <span className="absolute left-1/2 top-0 h-1.5 w-24 -translate-x-1/2 rounded-b-md bg-[#1a1816]" />
        </div>
      </div>

      {/* Phone */}
      <div className="mx-auto w-[220px] overflow-hidden rounded-[28px] border-[8px] border-[#2e2b27] bg-black shadow-[0_24px_50px_rgba(0,0,0,0.5)] sm:absolute sm:bottom-0 sm:right-0 sm:w-[27%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBasePath("/portal-preview/portal-mobile.jpg")}
          alt="The Numa client portal on a phone: project stage and the shop drawings and samples approved so far"
          {...LAZY_IMAGE_PROPS}
          className="block aspect-[390/844] w-full object-cover object-top"
        />
      </div>
    </div>
  );
}
