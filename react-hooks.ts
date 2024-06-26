import { useEffect, useState } from "react";
import Zapwire from "./client";

/**
 * A custom React hook for integrating Zapwire real-time messaging functionality into components.
 * This hook allows components to listen for messages, broadcast messages, and disconnect from the Zapwire instance.
 * @param channelID - Optional. The unique identifier for the communication channel.
 * @param config - Optional. Configuration options for Zapwire.
 * @returns An array containing the latest broadcast data, a function to broadcast messages, and a function to disconnect from the Zapwire instance.
 */


type TuseZapScope = "self"|"public";
type TuseZapBroadcast<T> = (payload: T, scope: TuseZapScope ) => Promise<boolean>
type TuseZap<T> = [T, TuseZapBroadcast<T>, Zapwire["cleanup"]];

function useZap<T>(channelID?: string, config?: Zapwire["config"]): TuseZap<T> {
    /**
     * State variable to store the latest broadcast data received.
     */
    const [broadcastData, setBroadcastData] = useState<T | {}>({});

    /**
     * State variable to store the Zapwire instance.
     */
    const [zapwire, setZapwire] = useState<Zapwire | null>(null);

    /**
     * Effect hook to initialize Zapwire and set up listeners.
     */
    useEffect(() => {
        /**
         * Function to initialize Zapwire instance and set up listeners.
         */
        const initZapwire = async () => {
            try {
                const newZapwire = new Zapwire(channelID, config as Zapwire["config"]);
                setZapwire(newZapwire);

                newZapwire.listen((message: any) => {
                    setBroadcastData(message?.data);
                });
            } catch (error) {
                console.error("Error initializing Zapwire:", error);
            }
        };

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
     * @param scope - Optional. The scope of the broadcast. Defaults to "self" but has "public" scope also.
     * @returns A boolean indicating the success of the broadcast operation.
     */
    const broadcast = async (payload: T, scope: TuseZapScope = "self") => {
        const broadCastPayload = {
                data: payload,
                type: typeof payload
            }

        if (!zapwire) {
            return false;
        }

        try {
            const success = await zapwire.broadcast(broadCastPayload, scope);
            return success;
        } catch (error) {
            console.error("Error broadcasting message:", error);
            return false;
        }
    };

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

    return [broadcastData as T, broadcast, disconnect] as const;
}

export default useZap;
