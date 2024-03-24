
# Zapwire React Hook

The Zapwire React Hook provides an easy way to integrate real-time messaging functionality into your React components using Zapwire. With this hook, you can listen for messages, broadcast messages, and disconnect from the Zapwire instance.

## Installation

You can install the Zapwire React Hook via npm:

```bash
npm install zapwire-react-hook
```

## Usage

```javascript
import { useEffect, useState } from "react";
import useZapwire from "zapwire-react-hook";

function MyComponent() {
    const [broadcastData, broadcast, disconnect] = useZapwire("channelID", { /* optional config */ });

    useEffect(() => {
        // Component initialization code

        // Cleanup function
        return () => {
            disconnect();
        };
    }, []);

    const sendMessage = async () => {
        const payload = { message: "Hello, world!" };
        const success = await broadcast(payload);
        if (success) {
            console.log("Message sent successfully");
        } else {
            console.error("Failed to send message");
        }
    };

    return (
        <div>
            {/* Your component UI */}
        </div>
    );
}
```

## API

### `useZapwire(channelID?, config?)`

This hook initializes a Zapwire instance and sets up listeners for incoming messages.

- `channelID` (optional): The unique identifier for the communication channel.
- `config` (optional): Configuration options for Zapwire.

Returns an array containing:
1. `broadcastData`: The latest broadcast data received.
2. `broadcast(payload, scope)`: A function to broadcast messages.
3. `disconnect()`: A function to disconnect from the Zapwire instance.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
```

