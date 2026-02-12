import { greet } from "./app.js";

const args = process.argv.slice(2);
const nameFlagIndex = args.indexOf("--name");
const rawName = nameFlagIndex >= 0 ? args[nameFlagIndex + 1] : undefined;
const name = rawName && !rawName.startsWith("--") ? rawName : "world";
const excited = args.includes("--excited");

console.log(greet(name, { excited }));
