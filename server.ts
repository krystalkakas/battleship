import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Ship {
  id: string;
  length: number;
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
}

interface Shot {
  x: number;
  y: number;
  hit: boolean;
}

interface Player {
  id: string;
  name: string;
  ships: Ship[];
  shots: Shot[];
  isReady: boolean;
}

interface GameRoom {
  id: string;
  players: Player[];
  spectators: string[]; // IDs of spectators
  turn: string | null; // Player ID
  phase: "placement" | "battle" | "finished";
  winner: string | null;
}

const rooms: Map<string, GameRoom> = new Map();
const clients: Map<string, WebSocket> = new Map();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  // API Routes
  app.get("/api/rooms", (req, res) => {
    const roomList = Array.from(rooms.values()).map((r) => ({
      id: r.id,
      playerCount: r.players.length,
      spectatorCount: r.spectators.length,
      phase: r.phase,
    }));
    res.json(roomList);
  });

  // WebSocket Logic
  wss.on("connection", (ws) => {
    const clientId = Math.random().toString(36).substring(2, 9);
    clients.set(clientId, ws);

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(clientId, message);
      } catch (err) {
        console.error("Failed to parse message", err);
      }
    });

    ws.on("close", () => {
      clients.delete(clientId);
      handleDisconnect(clientId);
    });

    // Send initial ID
    ws.send(JSON.stringify({ type: "init", id: clientId }));
  });

  function broadcastToRoom(roomId: string, message: any) {
    const room = rooms.get(roomId);
    if (!room) return;

    const recipientIds = [...room.players.map((p) => p.id), ...room.spectators];
    recipientIds.forEach((id) => {
      const client = clients.get(id);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  function handleMessage(clientId: string, message: any) {
    switch (message.type) {
      case "join_room": {
        const { roomId, name } = message;
        let room = rooms.get(roomId);
        if (!room) {
          room = {
            id: roomId,
            players: [],
            spectators: [],
            turn: null,
            phase: "placement",
            winner: null,
          };
          rooms.set(roomId, room);
        }

        if (room.players.length < 2 && !room.players.find(p => p.id === clientId)) {
          room.players.push({
            id: clientId,
            name: name || `Player ${room.players.length + 1}`,
            ships: [],
            shots: [],
            isReady: false,
          });
        } else if (!room.players.find(p => p.id === clientId) && !room.spectators.includes(clientId)) {
          room.spectators.push(clientId);
        }

        broadcastToRoom(roomId, { type: "room_update", room });
        break;
      }

      case "place_ships": {
        const { roomId, ships } = message;
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.players.find((p) => p.id === clientId);
        if (player) {
          player.ships = ships;
          player.isReady = true;

          // If both players are ready, start battle
          if (room.players.length === 2 && room.players.every((p) => p.isReady)) {
            room.phase = "battle";
            room.turn = room.players[0].id;
          }
          broadcastToRoom(roomId, { type: "room_update", room });
        }
        break;
      }

      case "shoot": {
        const { roomId, x, y } = message;
        const room = rooms.get(roomId);
        if (!room || room.phase !== "battle" || room.turn !== clientId) return;

        const opponent = room.players.find((p) => p.id !== clientId);
        const currentPlayer = room.players.find((p) => p.id === clientId);
        if (!opponent || !currentPlayer) return;

        // Check if already shot here
        if (currentPlayer.shots.find((s) => s.x === x && s.y === y)) return;

        // Check for hit
        let isHit = false;
        for (const ship of opponent.ships) {
          for (let i = 0; i < ship.length; i++) {
            const sx = ship.orientation === "horizontal" ? ship.x + i : ship.x;
            const sy = ship.orientation === "vertical" ? ship.y + i : ship.y;
            if (sx === x && sy === y) {
              isHit = true;
              break;
            }
          }
          if (isHit) break;
        }

        currentPlayer.shots.push({ x, y, hit: isHit });

        // Check win condition
        const totalShipCells = opponent.ships.reduce((acc, s) => acc + s.length, 0);
        const totalHits = currentPlayer.shots.filter((s) => s.hit).length;

        if (totalHits === totalShipCells) {
          room.phase = "finished";
          room.winner = clientId;
        } else if (!isHit) {
          // Switch turn if miss
          room.turn = opponent.id;
        }

        broadcastToRoom(roomId, { type: "room_update", room });
        break;
      }
      
      case "leave_room": {
        handleDisconnect(clientId);
        break;
      }
    }
  }

  function handleDisconnect(clientId: string) {
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex((p) => p.id === clientId);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        // If a player leaves, reset game or handle as needed
        if (room.phase === "battle") {
          room.phase = "finished";
          room.winner = room.players[0]?.id || null;
        }
        if (room.players.length === 0 && room.spectators.length === 0) {
          rooms.delete(roomId);
        } else {
          broadcastToRoom(roomId, { type: "room_update", room });
        }
      } else {
        const specIndex = room.spectators.indexOf(clientId);
        if (specIndex !== -1) {
          room.spectators.splice(specIndex, 1);
          if (room.players.length === 0 && room.spectators.length === 0) {
            rooms.delete(roomId);
          } else {
            broadcastToRoom(roomId, { type: "room_update", room });
          }
        }
      }
    });
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = process.env.PORT || 3000;
  httpServer.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
