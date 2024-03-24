import { io, Socket } from "socket.io-client";

/*!
 * Zapwire v1.0.0
 * (c) 2023-2023 Ese Curtis
 * Released under the MIT License.
 */


class Zapwire {
    private wss: string;
    private socket: Socket;
    private channelID: string | null;
    private key: string | undefined;
    private config: { info?: any, allowLogging?: boolean };
    private configInfo: object;
    private channelIDPromise?: Promise<string>;
    private disconnectChannel?: Zapwire;
    private reconnectAttempts: number = 0;
    static wss: string = "https://qwick.onrender.com";

    /**
    * Constructs a new instance of the Zapwire class.
    * @param channelID - Unique identifier for the communication channel.
    * @param config - Configuration options for Zapwire.
    * @param disconnectWatcher - Indicates whether to watch for disconnections.
    */
    constructor(channelID: string = "", config: Zapwire["config"], disconnectWatcher: boolean = false) {
        this.wss = "https://qwick.onrender.com";
        this.config = config;
        this.configInfo = config?.info ? config.info : {};

        this.socket = io(this.wss);
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

    /**
     * Checks if a channel exists.
     * @param channelID - The ID of the channel to check.
     * @returns A promise that resolves to true if the channel exists; otherwise, false.
     */
    static async channelExist(channelID: string): Promise<boolean> {
        const response = await fetch(Zapwire.wss + "/ping/check-existence", {
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
    /**
        * Logs a message to the console.
        * @param log - The message to log.
        * @param logger - The logger function to use.
        */
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

    /**
     * Configures the instance with the specified channel ID.
     * @param channelID - The channel ID to configure with.
     */
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

    /**
         * Handles disconnection events.
         */
    private handleDisconnect(): void {
        this.socket.on("disconnect", () => {
            this.showLog('Socket disconnected. Attempting to reconnect...', console.warn);
            this.reconnect({}, "self");
        });
    }

    /**
     * Listens for incoming messages.
     * @param callback - The callback function to invoke when a message is received.
     */
    listen(callback: Function = Function): void {
        this.showLog('Listening for messages');
        this.socket.on("message", callback as (...args: any[]) => void);
    }

    /**
    * Listens for disconnection events.
    * @param callback - The callback function to invoke when a disconnection occurs.
    */
    listenDisconnect(callback: Function = Function): void {
        this.showLog('Listening for disconnections');
        if (this.disconnectChannel) {
            this.disconnectChannel.listen(callback);
        }

    }

    /**
     * Cleans up resources and removes event listeners.
     */
    cleanup(): void {
        this.socket.removeAllListeners();
        this.socket.disconnect();
    }

    /**
    * Broadcasts a message to the specified scope.
    * @param payload - The payload to broadcast.
    * @param scope - The scope of the broadcast.
    * @returns A promise that resolves to true if the broadcast is successful; otherwise, false.
    */
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

    /**
     * Sends a ping request to the server.
     * @param payload - The payload of the ping request.
     * @param pingType - The type of ping request.
     * @returns A promise that resolves to true if the ping is successful; otherwise, false.
     */
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

    /**
     * Determines the target of the ping request.
     * @param pingType - The type of ping request.
     * @returns The target of the ping request.
     */
    private determinePingTo(pingType: string): string {
        let pingTo = this.key;
        if (pingType !== 'self' && pingType !== 'public') {
            pingTo = pingType;
        }
        return pingTo!;
    }

    /**
     * Determines the route for the ping request.
     * @param pingType - The type of ping request.
     * @returns The route for the ping request.
     */
    private determinePingRoute(pingType: string): string {
        let pingRoute = "/self";
        if (pingType === 'public') {
            pingRoute = "/public";
        }
        return pingRoute;
    }

    /**
     * Sends the ping request to the server.
     * @param pingRoute - The route for the ping request.
     * @param payload - The payload of the ping request.
     * @param pingTo - The target of the ping request.
     * @returns A promise that resolves to the server response.
     */
    private sendPingRequest(pingRoute: string, payload: object, pingTo: string): Promise<Response> {
        return fetch(this.wss + "/ping" + pingRoute, {
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

    /**
     * Handles unauthorized errors during ping requests.
     * @param payload - The payload of the ping request.
     * @param pingType - The type of ping request.
     */
    private async handleUnauthorizedError(payload: object, pingType: string): Promise<void> {
        await this.reconnect(payload, pingType);
    }

    /**
     * Handles successful ping responses from the server.
     * @param response - The response from the server.
     * @returns A promise that resolves to the server response.
     */
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


    /**
     * Handles errors that occur during ping requests.
     * @param error - The error that occurred during the ping request.
     */
    private handlePingError(error: Error): void {
        this.showLog('Error in ping: ' + error.message, console.error);
    }


    /**
    * Attempts to reconnect to the server.
    * @param payload - The payload of the ping request.
    * @param pingType - The type of ping request.
    */
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
