export interface Ship {
  id: string;
  length: number;
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
}

export interface Shot {
  x: number;
  y: number;
  hit: boolean;
}

export interface Player {
  id: string;
  name: string;
  ships: Ship[];
  shots: Shot[];
  isReady: boolean;
}

export interface GameRoom {
  id: string;
  players: Player[];
  spectators: string[];
  turn: string | null;
  phase: "placement" | "battle" | "finished";
  winner: string | null;
}

export type Message = 
  | { type: "init"; id: string }
  | { type: "room_update"; room: GameRoom }
  | { type: "join_room"; roomId: string; name?: string }
  | { type: "place_ships"; roomId: string; ships: Ship[] }
  | { type: "shoot"; roomId: string; x: number; y: number }
  | { type: "leave_room"; roomId: string };
