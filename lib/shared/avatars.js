// Add more entries here as you create more avatars — nothing else
// needs to change, the picker and every display spot read from this.
export const AVATARS = [
  { key: "boy", label: "پسر", src: "/avatars/boy.png" },
  { key: "girl", label: "دختر", src: "/avatars/girl.png" },
];

export function getAvatarSrc(key) {
  const found = AVATARS.find((a) => a.key === key);
  return found ? found.src : null;
}
