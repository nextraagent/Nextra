// Build step: applies scripts/patches*.txt (exact-match text replacements, in order) to the source tree.
import { existsSync, readFileSync, writeFileSync } from "fs";

const re = /@@@FILE (.+)\n@@@OLD\n([\s\S]*?)@@@NEW\n([\s\S]*?)@@@END\n/g;
let n = 0;
for (const P of ["scripts/patches.txt", "scripts/patches2.txt"]) {
  if (!existsSync(P)) continue;
  const txt = readFileSync(P, "utf8");
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(txt))) {
    const [, file, from, to] = m;
    const src = readFileSync(file, "utf8");
    if (src.split(from).length !== 2) {
      if (src.includes(to)) continue; // already applied
      throw new Error(`${P}: patch does not match ${file}`);
    }
    writeFileSync(file, src.replace(from, () => to));
    n++;
  }
}
console.log(`applied ${n} patches`);
