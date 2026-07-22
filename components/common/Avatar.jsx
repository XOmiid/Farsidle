"use client";

import { useState } from "react";
import { buildAvatarUrl, parseAvatarOptions } from "@/lib/shared/avatars";

const CROWN_COLORS = { 1: "#facc15", 2: "#cbd5e1", 3: "#d97706" };

function Crown({ rank }) {
  const color = CROWN_COLORS[rank];
  if (!color) return null;
  return (
    <svg
      viewBox="0 0 24 16"
      className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-6 h-4"
      style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.4))" }}
    >
      <path d="M2 15 L0 4 L6 8.5 L12 1 L18 8.5 L24 4 L22 15 Z" fill={color} />
    </svg>
  );
}

export default function Avatar({ avatarKey, username, size = 40, rank }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showCrown = rank && rank <= 3;

  // avatarKey can be:
  //  - a JSON string (new format, stored in DB)
  //  - a plain options object (passed directly from profile page preview)
  //  - "boy" / "girl" (old format — generate from username as fallback seed)
  //  - null / undefined (no avatar set — generate from username)
  const options = parseAvatarOptions(avatarKey, username || "farsidle");
  const src = buildAvatarUrl(options, size * 2); // 2x for retina

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {showCrown && <Crown rank={rank} />}
      {src && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setImgFailed(true)}
          className="w-full h-full rounded-full object-cover border-2 border-green-dim bg-bg-1"
        />
      ) : (
        <div
          className="w-full h-full rounded-full bg-green/15 border-2 border-green-dim flex items-center justify-center text-green font-bold"
          style={{ fontSize: size * 0.42 }}
        >
          {(username || "؟")[0]}
        </div>
      )}
    </div>
  );
}
