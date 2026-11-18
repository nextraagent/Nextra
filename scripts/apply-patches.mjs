// Build step: applies scripts/patches.txt (exact-match text replacements) to the source tree.
import { existsSync, readFileSync, writeFileSync } from "fs";

const P = "scripts/patches.txt";
if (existsSync(P)) {
  const re = /@@@FILE (.+)\n@@@OLD\n([\s\S]*?)@@@NEW\n([\s\S]*?)@@@END\n/g;
  const txt = readFileSync(P, "utf8");
  let m, n = 0;
  while ((m = re.exec(txt))) {
    const [, file, from, to] = m;
    const src = readFileSync(file, "utf8");
    if (src.split(from).length !== 2) {
      if (src.includes(to)) continue; // already applied
      throw new Error(`patch does not match ${file}`);
    }
    writeFileSync(file, src.replace(from, () => to));
    n++;
  }
  console.log(`applied ${n} patches`);
}
