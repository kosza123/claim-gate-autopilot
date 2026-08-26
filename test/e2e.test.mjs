import assert from "node:assert/strict";
import { withdraw } from "../src/withdraw.mjs";

assert.equal(withdraw(100, 1), 99);
