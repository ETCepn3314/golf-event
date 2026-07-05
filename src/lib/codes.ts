import { randomInt } from "node:crypto";

/** Unambiguous alphabet: no 0/O, 1/I/L, or 5/S. */
const CODE_ALPHABET = "2346789ABCDEFGHJKMNPQRTUVWXYZ";

const SLUG_WORDS = [
  "eagle", "birdie", "fairway", "bunker", "wedge", "putter", "driver",
  "caddie", "divot", "mulligan", "albatross", "links", "rough", "green",
  "tee", "flag", "pin", "ace", "draw", "fade",
];

function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/** Unguessable public event slug, e.g. "sunny-eagle-7F3K9Q" (~60 bits with the code). */
export function generateSlug(): string {
  const a = SLUG_WORDS[randomInt(SLUG_WORDS.length)];
  const b = SLUG_WORDS[randomInt(SLUG_WORDS.length)];
  return `${a}-${b}-${randomCode(6).toLowerCase()}`;
}

/** 5-character team join code. */
export function generateJoinCode(): string {
  return randomCode(5);
}

/** 6-digit organizer PIN. */
export function generatePin(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}
