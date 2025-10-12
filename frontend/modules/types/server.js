"use strict";
/**
 * 定義伺服器相關的類型
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerProcessStatus = void 0;
/**
 * 伺服器進程狀態
 */
var ServerProcessStatus;
(function (ServerProcessStatus) {
    ServerProcessStatus["STARTING"] = "starting";
    ServerProcessStatus["RUNNING"] = "running";
    ServerProcessStatus["ERROR"] = "error";
    ServerProcessStatus["STOPPED"] = "stopped";
})(ServerProcessStatus || (exports.ServerProcessStatus = ServerProcessStatus = {}));
