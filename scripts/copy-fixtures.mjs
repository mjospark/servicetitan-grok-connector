import { cpSync, mkdirSync } from "node:fs";
mkdirSync("dist/fixtures", { recursive: true });
cpSync("src/fixtures", "dist/fixtures", { recursive: true });
console.log("copied fixtures → dist/fixtures");
