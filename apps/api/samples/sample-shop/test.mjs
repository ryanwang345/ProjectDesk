// Regression test for the sample shop. Every button must carry the shared
// .btn class so it is styled the same in every environment.
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const buttons = [...html.matchAll(/<button\b([^>]*)>/g)];
const failures = [];

if (buttons.length === 0) failures.push("no buttons found");
for (const [tag, attrs] of buttons) {
  if (!/\bclass="[^"]*\bbtn\b[^"]*"/.test(attrs)) failures.push(`missing .btn: ${tag}`);
}

if (failures.length > 0) {
  console.error("FAIL\n" + failures.join("\n"));
  process.exit(1);
}
console.log(`ok - ${buttons.length} buttons carry .btn`);
