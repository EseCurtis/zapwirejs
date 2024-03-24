"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = require("socket.io-client");
const this_qwickEndpoint = "https://qwick.onrender.com";
class Zapwire {
    constructor(channelID = "", config, disconnectWatcher = false) {
        this.reconnectAttempts = 0;
        this.config = config;
        this.configInfo = (config === null || config === void 0 ? void 0 : config.info) ? config.info : {};
        this.socket = (0, socket_io_client_1.io)(this_qwickEndpoint);
        this.channelID = null;
        if (!socket_io_client_1.io) {
            this.showLog("Socket.io Client Library not detected. And Zapwire Initilization failed as it is a primary dpendency", console.error);
            return false;
        }
        this.showLog('Zapwire class initialized');
        this.configure(channelID);
        this.handleDisconnect();
        if (!disconnectWatcher) {
            this.disconnectChannel = new Zapwire(`${channelID}:disconnected`, config, true);
        }
    }
    static channelExist(channelID) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetch(this_qwickEndpoint + "/ping/check-existence", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    channelID
                }),
            });
            const result = yield response.json();
            return result.existence;
        });
    }
    showLog(log, logger = console.log) {
        var _a;
        if ((_a = this.config) === null || _a === void 0 ? void 0 : _a.allowLogging) {
            const timestamp = new Date().toISOString();
            let methodName = 'Method';
            try {
                methodName = new Error().stack.split('\n')[2].match(/at\s+(.*)\s+/)[1];
            }
            catch (error) {
                methodName = 'UnknownMethod';
            }
            logger(`${timestamp} - ${methodName}: ${log}`);
        }
    }
    configure(channelID) {
        this.showLog('Configuring with channel ID: ' + channelID);
        this.channelIDPromise = new Promise((resolve, reject) => {
            this.socket.on("config", (configData) => {
                if (channelID) {
                    this.channelID = configData.channelID;
                    this.key = configData.key;
                    resolve(channelID);
                }
                else {
                    reject("Invalid channelID received from the server.");
                }
            });
            this.socket.emit("config", channelID && { channelID: channelID, info: this.configInfo });
        });
    }
    handleDisconnect() {
        this.socket.on("disconnect", () => {
            this.showLog('Socket disconnected. Attempting to reconnect...', console.warn);
            this.reconnect({}, "self");
        });
    }
    listen(callback = Function) {
        this.showLog('Listening for messages');
        this.socket.on("message", callback);
    }
    listenDisconnect(callback = Function) {
        this.showLog('Listening for disconnections');
        if (this.disconnectChannel) {
            this.disconnectChannel.listen(callback);
        }
    }
    cleanup() {
        this.socket.removeAllListeners();
        this.socket.disconnect();
    }
    broadcast() {
        return __awaiter(this, arguments, void 0, function* (payload = {}, scope = "self") {
            if (typeof payload !== "object")
                this.showLog('Payload must be of type <object>, type given:' + typeof payload, console.error);
            this.showLog('Sending message with payload: ' + JSON.stringify(payload));
            let pingType = scope;
            try {
                yield this.channelIDPromise;
                const success = yield this.ping(payload, pingType);
                this.showLog('Message sent successfully');
                return success;
            }
            catch (error) {
                this.showLog('Error in message: ' + error, console.error);
                return false;
            }
        });
    }
    ping(payload, pingType) {
        return __awaiter(this, void 0, void 0, function* () {
            this.showLog('Pinging server with payload: ' + JSON.stringify(payload));
            const pingTo = this.determinePingTo(pingType);
            const pingRoute = this.determinePingRoute(pingType);
            try {
                const response = yield this.sendPingRequest(pingRoute, payload, pingTo);
                if (!response.ok) {
                    if (response.status === 401) {
                        if (this.reconnectAttempts < 3) {
                            this.reconnectAttempts++;
                            yield this.handleUnauthorizedError(payload, pingType);
                            return yield this.ping(payload, pingType);
                        }
                        else {
                            throw new Error(`Request failed with status ${response.status}. Reconnection attempts exhausted.`);
                        }
                    }
                    else {
                        throw new Error(`Request failed with status ${response.status}`);
                    }
                }
                const result = yield this.handleSuccessfulPingResponse(response);
                this.reconnectAttempts = 0;
                return result.success;
            }
            catch (error) {
                this.handlePingError(error);
                return false;
            }
        });
    }
    determinePingTo(pingType) {
        let pingTo = this.key;
        if (pingType !== 'self' && pingType !== 'public') {
            pingTo = pingType;
        }
        return pingTo;
    }
    determinePingRoute(pingType) {
        let pingRoute = "/self";
        if (pingType === 'public') {
            pingRoute = "/public";
        }
        return pingRoute;
    }
    sendPingRequest(pingRoute, payload, pingTo) {
        return fetch(this_qwickEndpoint + "/ping" + pingRoute, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                channelID: this.channelID,
                key: pingTo,
                payload: payload || {},
            }),
        });
    }
    handleUnauthorizedError(payload, pingType) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.reconnect(payload, pingType);
        });
    }
    handleSuccessfulPingResponse(response) {
        return __awaiter(this, void 0, void 0, function* () {
            if (response.ok) {
                const result = yield response.json();
                if (result.success) {
                    this.showLog(result.message, console.log);
                }
                else {
                    this.showLog(result.message, console.warn);
                }
                return result;
            }
        });
    }
    handlePingError(error) {
        this.showLog('Error in ping: ' + error.message, console.error);
    }
    reconnect(payload, pingType) {
        return __awaiter(this, void 0, void 0, function* () {
            this.reconnectAttempts++;
            if (this.reconnectAttempts <= 3) {
                this.showLog(`Reconnecting. Attempt ${this.reconnectAttempts}...`);
                yield new Promise((resolve) => {
                    this.configure(this.channelID);
                    if (this.channelIDPromise) {
                        this.channelIDPromise.then(() => {
                            this.showLog('Reconnection successful.', console.info);
                            this.broadcast(payload, pingType);
                            resolve(true);
                        });
                    }
                });
            }
            else {
                this.showLog('Reconnection attempts exhausted.', console.error);
            }
            this.reconnectAttempts = 0;
        });
    }
}
exports.default = Zapwire;
