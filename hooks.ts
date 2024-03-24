import { useEffect, useState } from "react";
import Zapwire from "./client";

type BroadcastData = Record<string, any>;

function useZapwire(channelID?: string, config?: Zapwire["config"]) {
    const [broadcastData, setBroadcastData] = useState<BroadcastData>({});
    const [zapwire, setZapwire] = useState<Zapwire | null>(null);

    useEffect(() => {
        const initZapwire = async () => {
            try {
                const newZapwire = new Zapwire(channelID, config as Zapwire["config"]);
                setZapwire(newZapwire);

                newZapwire.listen((message: any) => {
                    setBroadcastData(message);
                });
            } catch (error) {
                console.error("Error initializing Zapwire:", error);
            }
        };

        initZapwire();

        return () => {
            if (zapwire) {
                zapwire.cleanup();
            }
        };
    }, [channelID]);

    const broadcast = async (payload: object, scope: string = "self") => {
        if(typeof payload !== "object") {
            payload = {
                data: payload,
                type: typeof payload
            }
        }

        if (!zapwire) {
            return false;
        }

        try {
            const success = await zapwire.broadcast(payload, scope);
            return success;
        } catch (error) {
            console.error("Error broadcasting message:", error);
            return false;
        }
    };

    const disconnect = () => {
        if (!zapwire) {
            console.error("Zapwire not initialized.");
            return false;
        }

        zapwire.cleanup();
        return true;
    };

    return [broadcastData, broadcast, disconnect] as const;
}

export default useZapwire;
