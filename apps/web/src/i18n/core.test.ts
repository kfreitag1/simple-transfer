import { expect, test } from "bun:test";
import { pickLocale, translate } from "./core.ts";

const en = { a: { greet: "Hello {name}, {name}!", only: "English" } };
const de = { a: { greet: "Hallo {name}" } };

test("placeholders are replaced, missing params become empty and missing keys fall back to English", () => {
  expect(translate(de, en, "a.greet", { name: "Ana" })).toBe("Hallo Ana");
  expect(translate(en, en, "a.greet", { name: 1 })).toBe("Hello 1, 1!");
  expect(translate(en, en, "a.greet")).toBe("Hello , !");
  expect(translate(de, en, "a.only")).toBe("English");
});

test("the locale is the stored choice, else the first supported browser language, else English", () => {
  expect(pickLocale(["en", "de", "fr"], "fr", ["de-DE"])).toBe("fr");
  expect(pickLocale(["en", "de"], "xx", ["nl-NL", "de-AT", "en"])).toBe("de");
  expect(pickLocale(["en", "de"], null, ["ja"])).toBe("en");
});
