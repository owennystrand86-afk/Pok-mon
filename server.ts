import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  // Simple room system for multiplayer
  const rooms = new Map<string, { ws: WebSocket; card: any }[]>();

  wss.on("connection", (ws) => {
    let currentRoom: string | null = null;

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "join") {
          const { roomId, card } = message;
          currentRoom = roomId;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, []);
          }
          const room = rooms.get(roomId)!;

          if (room.length >= 2) {
            ws.send(JSON.stringify({ type: "error", message: "Room is full" }));
            return;
          }

          room.push({ ws, card });
          
          // If room is now full, start the game
          if (room.length === 2) {
            const p1 = room[0];
            const p2 = room[1];

            p1.ws.send(JSON.stringify({ 
              type: "game_start", 
              role: "p1", 
              opponentCard: p2.card 
            }));
            
            p2.ws.send(JSON.stringify({ 
              type: "game_start", 
              role: "p2", 
              opponentCard: p1.card 
            }));
          }
        }

        if (message.type === "action" && currentRoom) {
          const room = rooms.get(currentRoom);
          if (room) {
            room.forEach((player) => {
              if (player.ws !== ws && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(JSON.stringify(message));
              }
            });
          }
        }
      } catch (e) {
        console.error("Error parsing message", e);
      }
    });

    ws.on("close", () => {
      if (currentRoom) {
        const room = rooms.get(currentRoom);
        if (room) {
          const index = room.findIndex(p => p.ws === ws);
          if (index !== -1) {
            room.splice(index, 1);
            if (room.length === 0) {
              rooms.delete(currentRoom);
            } else {
              room.forEach((player) => {
                player.ws.send(JSON.stringify({ type: "opponent_left" }));
              });
            }
          }
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
