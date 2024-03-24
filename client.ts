import { io, Socket } from "socket.io-client";

const this_qwickEndpoint: string = "https://qwick.onrender.com";

class Zapwire {
    private socket: Socket;
    private channelID: string | null;
    private key: string | undefined;
    private config: { info?: any, allowLogging?: boolean };
    private configInfo: object;
    private channelIDPromise?: Promise<string>;
    private disconnectChannel?: Zapwire;
    private reconnectAttempts: number = 0;

    constructor(channelID: string = "", config: Zapwire["config"], disconnectWatcher: boolean = false) {
        this.config = config;
        this.configInfo = config?.info ? config.info : {};

        this.socket = io(this_qwickEndpoint);
        this.channelID = null;
        if (!io) {
            this.showLog("Socket.io Client Library not detected. And Zapwire Initilization failed as it is a primary dpendency", console.error);
            return false as any;
        }
        this.showLog('Zapwire class initialized');
        this.configure(channelID);
        this.handleDisconnect();

        if (!disconnectWatcher) {
            this.disconnectChannel = new Zapwire(`${channelID}:disconnected`, config, true);
        }
    }

    static async channelExist(channelID: string): Promise<boolean> {
        const response = await fetch(this_qwickEndpoint + "/ping/check-existence", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                channelID
            }),
        });

        const result = await response.json();
        return result.existence;
    }

    private showLog(log: any, logger: Function = console.log): void {
        if (this.config?.allowLogging) {
            const timestamp = new Date().toISOString();
            let methodName = 'Method';

            try {
                methodName = new Error().stack!.split('\n')[2].match(/at\s+(.*)\s+/)![1];
            } catch (error) {
                methodName = 'UnknownMethod';
            }
            logger(`${timestamp} - ${methodName}: ${log}`);
        }
    }

    private configure(channelID: string): void {
        this.showLog('Configuring with channel ID: ' + channelID);
        this.channelIDPromise = new Promise((resolve, reject) => {
            this.socket.on("config", (configData: any) => {
                if (channelID) {
                    this.channelID = configData.channelID;
                    this.key = configData.key;

                    resolve(channelID);
                } else {
                    reject("Invalid channelID received from the server.");
                }
            });

            this.socket.emit("config", channelID && { channelID: channelID, info: this.configInfo });
        });
    }

    private handleDisconnect(): void {
        this.socket.on("disconnect", () => {
            this.showLog('Socket disconnected. Attempting to reconnect...', console.warn);
            this.reconnect({}, "self");
        });
    }

    listen(callback: Function = Function): void {
        this.showLog('Listening for messages');
        this.socket.on("message", callback as (...args: any[]) => void);
    }

    listenDisconnect(callback: Function = Function): void {
        this.showLog('Listening for disconnections');
        if (this.disconnectChannel) {
            this.disconnectChannel.listen(callback);
        }

    }

    cleanup(): void {
        this.socket.removeAllListeners();
        this.socket.disconnect();
    }

    async broadcast(payload: object = {}, scope: string = "self"): Promise<boolean> {
        if (typeof payload !== "object") this.showLog('Payload must be of type <object>, type given:' + typeof payload, console.error);
        this.showLog('Sending message with payload: ' + JSON.stringify(payload));
        let pingType = scope;

        try {
            await this.channelIDPromise;
            const success = await this.ping(payload, pingType);
            this.showLog('Message sent successfully');
            return success;
        } catch (error) {
            this.showLog('Error in message: ' + error, console.error);
            return false;
        }
    }

    private async ping(payload: object, pingType: string): Promise<boolean> {
        this.showLog('Pinging server with payload: ' + JSON.stringify(payload));
        const pingTo = this.determinePingTo(pingType);
        const pingRoute = this.determinePingRoute(pingType);

        try {
            const response = await this.sendPingRequest(pingRoute, payload, pingTo);

            if (!response.ok) {
                if (response.status === 401) {
                    if (this.reconnectAttempts < 3) {
                        this.reconnectAttempts++;
                        await this.handleUnauthorizedError(payload, pingType);
                        return await this.ping(payload, pingType);
                    } else {
                        throw new Error(`Request failed with status ${response.status}. Reconnection attempts exhausted.`);
                    }
                } else {
                    throw new Error(`Request failed with status ${response.status}`);
                }
            }

            const result = await this.handleSuccessfulPingResponse(response);

            this.reconnectAttempts = 0;
            return result.success;
        } catch (error) {
            this.handlePingError(error as Error);
            return false;
        }
    }

    private determinePingTo(pingType: string): string {
        let pingTo = this.key;
        if (pingType !== 'self' && pingType !== 'public') {
            pingTo = pingType;
        }
        return pingTo!;
    }

    private determinePingRoute(pingType: string): string {
        let pingRoute = "/self";
        if (pingType === 'public') {
            pingRoute = "/public";
        }
        return pingRoute;
    }

    private sendPingRequest(pingRoute: string, payload: object, pingTo: string): Promise<Response> {
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

    private async handleUnauthorizedError(payload: object, pingType: string): Promise<void> {
        await this.reconnect(payload, pingType);
    }

    private async handleSuccessfulPingResponse(response: Response): Promise<any> {
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                this.showLog(result.message, console.log);
            } else {
                this.showLog(result.message, console.warn);
            }
            return result;
        }
    }

    private handlePingError(error: Error): void {
        this.showLog('Error in ping: ' + error.message, console.error);
    }

    private async reconnect(payload: object, pingType: string): Promise<void> {
        this.reconnectAttempts++;

        if (this.reconnectAttempts <= 3) {
            this.showLog(`Reconnecting. Attempt ${this.reconnectAttempts}...`);
            await new Promise((resolve) => {
                this.configure(this.channelID!);
                if (this.channelIDPromise) {
                    this.channelIDPromise.then(() => {
                        this.showLog('Reconnection successful.', console.info);
                        this.broadcast(payload, pingType);
                        resolve(true);
                    });
                }

            });
        } else {
            this.showLog('Reconnection attempts exhausted.', console.error);
        }

        this.reconnectAttempts = 0;
    }
}

export default Zapwire;
