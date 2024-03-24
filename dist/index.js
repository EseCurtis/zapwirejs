"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = __importDefault(require("./client"));
const hooks_1 = __importDefault(require("./hooks"));
exports.default = {
    Zapwire: client_1.default,
    useZap: hooks_1.default
};
