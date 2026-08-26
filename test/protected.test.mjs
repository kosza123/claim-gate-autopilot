import assert from "node:assert/strict";
import { withdraw } from "../src/withdraw.mjs";

assert.throws(() => withdraw(40, 100), /insufficient/);
