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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const client_1 = __importDefault(require("./client"));
function useZap(channelID, config) {
    /**
     * State variable to store the latest broadcast data received.
     */
    const [broadcastData, setBroadcastData] = (0, react_1.useState)({});
    /**
     * State variable to store the Zapwire instance.
     */
    const [zapwire, setZapwire] = (0, react_1.useState)(null);
    /**
     * Effect hook to initialize Zapwire and set up listeners.
     */
    (0, react_1.useEffect)(() => {
        /**
         * Function to initialize Zapwire instance and set up listeners.
         */
        const initZapwire = () => __awaiter(this, void 0, void 0, function* () {
            try {
                const newZapwire = new client_1.default(channelID, config);
                setZapwire(newZapwire);
                newZapwire.listen((message) => {
                    setBroadcastData(message);
                });
            }
            catch (error) {
                console.error("Error initializing Zapwire:", error);
            }
        });
        initZapwire();
        /**
         * Cleanup function to disconnect from Zapwire instance when component unmounts.
         */
        return () => {
            if (zapwire) {
                zapwire.cleanup();
            }
        };
    }, [channelID]);
    /**
     * Function to broadcast a message using the Zapwire instance.
     * @param payload - The message payload to be broadcasted.
     * @param scope - Optional. The scope of the broadcast. Defaults to "self".
     * @returns A boolean indicating the success of the broadcast operation.
     */
    const broadcast = (payload_1, ...args_1) => __awaiter(this, [payload_1, ...args_1], void 0, function* (payload, scope = "self") {
        if (typeof payload !== "object") {
            payload = {
                data: payload,
                type: typeof payload
            };
        }
        if (!zapwire) {
            return false;
        }
        try {
            const success = yield zapwire.broadcast(payload, scope);
            return success;
        }
        catch (error) {
            console.error("Error broadcasting message:", error);
            return false;
        }
    });
    /**
     * Function to disconnect from the Zapwire instance.
     * @returns A boolean indicating the success of the disconnection operation.
     */
    const disconnect = () => {
        if (!zapwire) {
            console.error("Zapwire not initialized.");
            return false;
        }
        zapwire.cleanup();
        return true;
    };
    return [broadcastData, broadcast, disconnect];
}
exports.default = useZap;
