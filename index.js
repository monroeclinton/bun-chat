// Create a server to serve index.html page
Bun.serve({
  port: 3000,
  fetch() {
    return new Response(Bun.file("./index.html"));
  },
});

// Create another server for the WebSocket server
const messages = [];
let users = [];

Bun.serve({
  port: 4000,
  fetch(req, server) {
    // upgrade the request to a WebSocket

    const success = server.upgrade(req, {
      // Set username to semi-random text, collisions probably do not use in production
      data: { username: "user_" + Math.random().toString(16).slice(12) },
    });

    return success
      ? undefined
      : new Response("Upgrade failed :(", { status: 500 });
  },
  websocket: {
    open(ws) {
      // Store username
      users.push(ws.data.username);

      // Subscribe to pubsub channel to send/receive broadcasted messages,
      // without this the socket could not send events to other clients
      ws.subscribe("chat");

      // Broadcast that a user joined
      ws.publish(
        "chat",
        JSON.stringify({ type: "USERS_ADD", data: ws.data.username })
      );

      // Send message to the newly connected client containing existing users and messages
      ws.send(JSON.stringify({ type: "USERS_SET", data: users }));
      ws.send(JSON.stringify({ type: "MESSAGES_SET", data: messages }));
    },
    message(ws, data) {
      // Data sent is a string, parse to object
      const message = JSON.parse(data);
      message.username = ws.data.username;
      messages.push(message);

      // Send message to all clients subscribed to the chat channel with new message
      ws.publish(
        "chat",
        JSON.stringify({ type: "MESSAGES_ADD", data: message })
      );
    },
    close(ws) {
      users = users.filter((username) => username !== ws.data.username);

      // Send message to all clients subscribed to the chat channel that user left
      ws.publish(
        "chat",
        JSON.stringify({ type: "USERS_REMOVE", data: ws.data.username })
      );
    },
  },
});
