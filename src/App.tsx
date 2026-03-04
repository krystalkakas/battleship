import React, { useState, useEffect, useRef } from 'react';
import { Ship, Shot, Player, GameRoom, Message } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Ship as ShipIcon, Users, Trophy, LogOut, Plus, Play, RotateCw, Volume2, VolumeX } from 'lucide-react';

// --- Constants ---
const GRID_SIZE = 10;
const SHIP_TYPES = [
  { length: 5, count: 1 },
  { length: 4, count: 2 },
  { length: 3, count: 1 },
  { length: 2, count: 1 },
];

const SOUNDS = {
  hit: 'https://cdn.freesound.org/previews/536/536421_11881477-lq.mp3', // Explosion
  miss: 'https://cdn.freesound.org/previews/273/273337_4486188-lq.mp3', // Splash
  bgm: 'https://cdn.freesound.org/previews/655/655513_11537234-lq.mp3', // Ambient
  turn: 'https://cdn.freesound.org/previews/215/215438_3943373-lq.mp3', // Notification
  sunk: 'https://cdn.freesound.org/previews/414/414346_5121236-lq.mp3'  // Sinking
};

// --- Components ---

const GridCell = ({ 
  x, y, 
  isShip, isHit, isMiss, isTargetable, 
  onClick, onMouseEnter, onMouseLeave 
}: { 
  x: number; y: number; 
  isShip?: boolean; isHit?: boolean; isMiss?: boolean; isTargetable?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) => {
  return (
    <div 
      className={`
        relative w-full aspect-square border border-white/10 flex items-center justify-center cursor-pointer
        transition-colors duration-200
        ${isTargetable ? 'hover:bg-white/10' : ''}
        ${isShip && !isHit && !isMiss ? 'bg-indigo-500/40' : ''}
      `}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {isHit && (
        <div className="w-3/4 h-3/4 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" />
      )}
      {isMiss && (
        <div className="w-1/2 h-1/2 rounded-full bg-white/30" />
      )}
      {isTargetable && !isHit && !isMiss && (
        <div className="absolute inset-0 border-2 border-transparent hover:border-indigo-400/50" />
      )}
    </div>
  );
};

const GameGrid = ({ 
  ships = [], 
  shots = [], 
  onCellClick,
  onMouseEnter,
  onMouseLeave,
  targetable = false,
  previewShip,
  showShips = true
}: { 
  ships?: Ship[]; 
  shots?: Shot[]; 
  onCellClick?: (x: number, y: number) => void;
  onMouseEnter?: (x: number, y: number) => void;
  onMouseLeave?: () => void;
  targetable?: boolean;
  previewShip?: { x: number; y: number; length: number; orientation: 'horizontal' | 'vertical'; isValid: boolean } | null;
  showShips?: boolean;
}) => {
  const cells = [];
  
  // Header row (1-10)
  cells.push(<div key="corner" className="flex items-center justify-center text-[10px] font-bold text-slate-600 bg-black/20 border-b border-r border-white/5"></div>);
  for (let x = 0; x < GRID_SIZE; x++) {
    cells.push(
      <div key={`h-${x}`} className="flex items-center justify-center text-[10px] font-bold text-slate-600 bg-black/20 border-b border-white/5">
        {x + 1}
      </div>
    );
  }

  for (let y = 0; y < GRID_SIZE; y++) {
    // Row label (A-J)
    cells.push(
      <div key={`v-${y}`} className="flex items-center justify-center text-[10px] font-bold text-slate-600 bg-black/20 border-r border-white/5">
        {String.fromCharCode(65 + y)}
      </div>
    );

    for (let x = 0; x < GRID_SIZE; x++) {
      const shot = shots.find(s => s.x === x && s.y === y);
      const isHit = shot?.hit;
      const isMiss = shot && !shot.hit;
      
      let isShip = false;
      if (showShips) {
        isShip = ships.some(s => {
          for (let i = 0; i < s.length; i++) {
            const sx = s.orientation === 'horizontal' ? s.x + i : s.x;
            const sy = s.orientation === 'vertical' ? s.y + i : s.y;
            if (sx === x && sy === y) return true;
          }
          return false;
        });
      }

      let isPreview = false;
      if (previewShip) {
        for (let i = 0; i < previewShip.length; i++) {
          const px = previewShip.orientation === 'horizontal' ? previewShip.x + i : previewShip.x;
          const py = previewShip.orientation === 'vertical' ? previewShip.y + i : previewShip.y;
          if (px === x && py === y) isPreview = true;
        }
      }

      cells.push(
        <div 
          key={`${x}-${y}`}
          className={`
            relative w-full aspect-square border border-white/5 flex items-center justify-center
            ${targetable ? 'cursor-crosshair hover:bg-white/5' : ''}
            ${isShip && !isHit ? 'bg-indigo-500/30' : ''}
            ${isPreview ? (previewShip?.isValid ? 'bg-green-500/40' : 'bg-red-500/40') : ''}
          `}
          onClick={() => onCellClick?.(x, y)}
          onMouseEnter={() => onCellClick && onMouseEnter?.(x, y)}
        >
          {isHit && <div className="w-2/3 h-2/3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />}
          {isMiss && <div className="w-1/3 h-1/3 rounded-full bg-slate-400/50" />}
        </div>
      );
    }
  }

  return (
    <div 
      className="grid grid-cols-[30px_repeat(10,1fr)] grid-rows-[30px_repeat(10,1fr)] w-full aspect-square bg-slate-900/50 border-2 border-white/10 rounded-lg overflow-hidden shadow-2xl"
      onMouseLeave={onMouseLeave}
    >
      {cells}
    </div>
  );
};

export default function App() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  
  // Audio State
  const [isMuted, setIsMuted] = useState(false);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const lastShotCountRef = useRef<number>(0);
  const lastTurnRef = useRef<string | null>(null);
  const sunkShipsRef = useRef<Set<string>>(new Set());

  const [notification, setNotification] = useState<string | null>(null);
  const [placedShips, setPlacedShips] = useState<Ship[]>([]);
  const [selectedShipLength, setSelectedShipLength] = useState<number | null>(SHIP_TYPES[0].length);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null);

  const [battleHover, setBattleHover] = useState<{ x: number, y: number } | null>(null);

  const getRemainingCount = (length: number) => {
    const total = SHIP_TYPES.find(t => t.length === length)?.count || 0;
    const placed = placedShips.filter(s => s.length === length).length;
    return total - placed;
  };

  const playSfx = (type: keyof typeof SOUNDS) => {
    if (isMuted) return;
    const audio = new Audio(SOUNDS[type]);
    audio.volume = type === 'bgm' ? 0.2 : 0.6;
    audio.play().catch(() => {});
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setOrientation(prev => prev === 'horizontal' ? 'vertical' : 'horizontal');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (bgmRef.current) {
      bgmRef.current.muted = isMuted;
      if (!isMuted) {
        bgmRef.current.play().catch(() => {});
      } else {
        bgmRef.current.pause();
      }
    }
  }, [isMuted]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onmessage = (event) => {
      const msg: Message = JSON.parse(event.data);
      if (msg.type === 'init') {
        setMyId(msg.id);
      } else if (msg.type === 'room_update') {
        const newRoom = msg.room;
        
        // Detect turn change
        if (newRoom.phase === 'battle' && newRoom.turn !== lastTurnRef.current) {
          if (newRoom.turn === myId) {
            playSfx('turn');
            showNotification('Đến lượt của bạn!');
          }
          lastTurnRef.current = newRoom.turn;
        }

        // Detect new shots and sunk ships
        const allPlayers = newRoom.players;
        const totalShots = allPlayers.flatMap(p => p.shots).length;
        
        if (totalShots > lastShotCountRef.current) {
          const shooter = allPlayers.find(p => p.shots.length > (room?.players.find(oldP => oldP.id === p.id)?.shots.length || 0));
          if (shooter) {
            const latestShot = shooter.shots[shooter.shots.length - 1];
            playSfx(latestShot.hit ? 'hit' : 'miss');

            // Check if a ship was sunk
            const victim = allPlayers.find(p => p.id !== shooter.id);
            if (victim && latestShot.hit) {
              victim.ships.forEach(ship => {
                if (sunkShipsRef.current.has(ship.id)) return;
                
                const isSunk = Array.from({ length: ship.length }).every((_, i) => {
                  const sx = ship.orientation === 'horizontal' ? ship.x + i : ship.x;
                  const sy = ship.orientation === 'vertical' ? ship.y + i : ship.y;
                  return shooter.shots.some(s => s.x === sx && s.y === sy && s.hit);
                });

                if (isSunk) {
                  sunkShipsRef.current.add(ship.id);
                  playSfx('sunk');
                  showNotification(`${shooter.id === myId ? 'Bạn' : 'Đối phương'} đã đánh chìm tàu ${ship.length} ô!`);
                }
              });
            }
          }
        }
        lastShotCountRef.current = totalShots;
        
        setRoom(newRoom);
      }
    };

    setSocket(ws);
    fetchRooms();

    return () => ws.close();
  }, [isMuted]);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      setAvailableRooms(data);
    } catch (e) {
      console.error(e);
    }
  };

  const joinRoom = (id: string) => {
    if (!socket || !id.trim()) return;
    socket.send(JSON.stringify({ type: 'join_room', roomId: id.trim().toUpperCase(), name: nameInput }));
    
    // Start music on first interaction
    if (bgmRef.current && !isMuted) {
      bgmRef.current.play().catch(() => {});
    }
  };

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    joinRoom(newRoomId);
  };

  const leaveRoom = () => {
    if (!socket || !room) return;
    socket.send(JSON.stringify({ type: 'leave_room', roomId: room.id }));
    setRoom(null);
    setPlacedShips([]);
    setSelectedShipLength(SHIP_TYPES[0].length);
    sunkShipsRef.current = new Set();
    lastShotCountRef.current = 0;
    lastTurnRef.current = null;
    fetchRooms();
  };

  const handlePlacementClick = (x: number, y: number) => {
    if (selectedShipLength === null) return;
    if (getRemainingCount(selectedShipLength) <= 0) return;
    
    if (isValidPlacement(x, y, selectedShipLength, orientation, placedShips)) {
      const newShip: Ship = {
        id: Math.random().toString(36).substring(7),
        length: selectedShipLength,
        x,
        y,
        orientation
      };
      const newPlaced = [...placedShips, newShip];
      setPlacedShips(newPlaced);
      
      // Auto select next ship type if current is exhausted
      if (getRemainingCount(selectedShipLength) <= 1) {
        const nextType = SHIP_TYPES.find(t => {
          const placed = newPlaced.filter(s => s.length === t.length).length;
          return placed < t.count;
        });
        setSelectedShipLength(nextType ? nextType.length : null);
      }
    }
  };

  const isValidPlacement = (x: number, y: number, length: number, orient: 'horizontal' | 'vertical', existing: Ship[]) => {
    if (orient === 'horizontal' && x + length > GRID_SIZE) return false;
    if (orient === 'vertical' && y + length > GRID_SIZE) return false;

    // Check collisions
    const newCells = [];
    for (let i = 0; i < length; i++) {
      newCells.push({
        x: orient === 'horizontal' ? x + i : x,
        y: orient === 'vertical' ? y + i : y
      });
    }

    for (const ship of existing) {
      for (let i = 0; i < ship.length; i++) {
        const sx = ship.orientation === 'horizontal' ? ship.x + i : ship.x;
        const sy = ship.orientation === 'vertical' ? ship.y + i : ship.y;
        if (newCells.some(c => c.x === sx && c.y === sy)) return false;
      }
    }

    return true;
  };

  const submitShips = () => {
    if (!socket || !room) return;
    socket.send(JSON.stringify({ type: 'place_ships', roomId: room.id, ships: placedShips }));
  };

  const shoot = (x: number, y: number) => {
    if (!socket || !room || room.turn !== myId) return;
    socket.send(JSON.stringify({ type: 'shoot', roomId: room.id, x, y }));
  };

  const isSpectator = room?.spectators.includes(myId || '');
  const me = room?.players.find(p => p.id === myId) || room?.players[0];
  const opponent = room?.players.find(p => p.id !== (isSpectator ? room?.players[0]?.id : myId)) || room?.players[1];

  const totalShipsToPlace = SHIP_TYPES.reduce((acc, t) => acc + t.count, 0);

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black tracking-tighter uppercase italic text-indigo-500">Bắn Thuyền</h1>
            <p className="text-slate-400 text-sm tracking-widest uppercase">Chiến Tranh Hải Quân Trực Tuyến</p>
          </div>

          <div className="bg-slate-900/50 border border-white/10 p-8 rounded-2xl space-y-6 backdrop-blur-xl">
            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Tên của bạn</label>
              <input 
                type="text" 
                placeholder="NHẬP TÊN..."
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="pt-2">
              <button 
                onClick={createRoom}
                className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3 group"
              >
                <Plus size={20} className="group-hover:rotate-90 transition-transform" /> 
                Tạo Phòng Mới
              </button>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">HOẶC</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Vào Phòng Có Sẵn</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="MÃ PHÒNG..."
                  value={roomIdInput}
                  onChange={e => setRoomIdInput(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                />
                <button 
                  onClick={() => joinRoom(roomIdInput)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 px-6 rounded-lg font-bold transition-colors flex items-center gap-2"
                >
                  VÀO
                </button>
              </div>
            </div>

            {availableRooms.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-white/5">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Các Trận Đánh Đang Diễn Ra</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {availableRooms.map(r => (
                    <button 
                      key={r.id}
                      onClick={() => joinRoom(r.id)}
                      className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-lg transition-colors group"
                    >
                      <span className="font-mono text-sm">{r.id}</span>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Users size={14} /> {r.playerCount}/2</span>
                        <span className="uppercase tracking-tighter group-hover:text-indigo-400">{r.phase === 'placement' ? 'Dàn trận' : r.phase === 'battle' ? 'Giao chiến' : 'Kết thúc'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col p-4 md:p-8 font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <ShipIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tighter uppercase italic">Phòng: {room.id}</h2>
            <p className="text-xs text-slate-500 uppercase tracking-widest">
              {isSpectator ? 'Đang xem' : 'Đang chiến đấu'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
            title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button 
            onClick={leaveRoom}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} /> Rút lui
          </button>
        </div>
      </div>

      <audio ref={bgmRef} src={SOUNDS.bgm} loop />

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-20 left-1/2 z-50 bg-indigo-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl border border-indigo-400 uppercase tracking-widest text-sm pointer-events-none"
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 grid lg:grid-cols-[1fr_400px] gap-8 max-w-7xl mx-auto w-full">
        {/* Main Game Area */}
        <div className="space-y-8">
          {room.phase === 'placement' && !isSpectator && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold uppercase tracking-tighter">Dàn Trận Hạm Đội</h3>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setPlacedShips([]);
                      setSelectedShipLength(SHIP_TYPES[0].length);
                    }}
                    className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded-lg text-sm font-bold text-red-400 transition-colors"
                  >
                    Đặt lại
                  </button>
                  <button 
                    onClick={() => setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal')}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                  >
                    <RotateCw size={16} /> Xoay: {orientation === 'horizontal' ? 'NGANG' : 'DỌC'}
                  </button>
                  {placedShips.length === totalShipsToPlace && !me?.isReady && (
                    <button 
                      onClick={submitShips}
                      className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
                    >
                      <Play size={16} /> SẴN SÀNG CHIẾN ĐẤU
                    </button>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-[1fr_300px] gap-8 items-start">
                <div className="space-y-4">
                  <GameGrid 
                    ships={placedShips}
                    onCellClick={handlePlacementClick}
                    onMouseEnter={(x, y) => setHoverPos({ x, y })}
                    onMouseLeave={() => setHoverPos(null)}
                    previewShip={hoverPos && selectedShipLength ? { 
                      ...hoverPos, 
                      length: selectedShipLength, 
                      orientation,
                      isValid: isValidPlacement(hoverPos.x, hoverPos.y, selectedShipLength, orientation, placedShips)
                    } : null}
                  />
                  <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-lg flex items-center gap-3">
                    <div className="bg-indigo-500 p-2 rounded-full">
                      <Play size={16} />
                    </div>
                    <p className="text-xs text-indigo-300 font-medium">
                      Mẹo: Nhấn <span className="bg-indigo-500/20 px-1.5 py-0.5 rounded font-bold text-white">SPACE</span> để xoay tàu nhanh. Click vào lưới để đặt tàu.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-900/50 border border-white/10 p-6 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Chọn Tàu Để Đặt</h4>
                    <div className="space-y-3">
                      {SHIP_TYPES.map(type => {
                        const remaining = getRemainingCount(type.length);
                        return (
                          <button
                            key={type.length}
                            disabled={remaining <= 0}
                            onClick={() => setSelectedShipLength(type.length)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                              selectedShipLength === type.length 
                                ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-500/20' 
                                : remaining <= 0 
                                  ? 'bg-black/20 border-white/5 opacity-40 cursor-not-allowed' 
                                  : 'bg-white/5 border-white/10 hover:border-white/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex gap-1">
                                {Array(type.length).fill(0).map((_, i) => (
                                  <div key={i} className={`w-3 h-3 rounded-sm ${selectedShipLength === type.length ? 'bg-white' : 'bg-indigo-500'}`} />
                                ))}
                              </div>
                              <span className="text-xs font-bold">Tàu {type.length} ô</span>
                            </div>
                            <span className="text-[10px] font-mono opacity-60">Còn {remaining}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-slate-900/50 border border-white/10 p-6 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Mệnh Lệnh Dàn Quân</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Sắp xếp hạm đội của bạn trên lưới. Đối phương sẽ không thấy tàu của bạn. 
                      Khi đã sẵn sàng, hãy nhấn nút bắt đầu để tham chiến.
                    </p>
                    <div className="space-y-2 pt-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Tàu đã đặt:</span>
                        <span className="font-mono">{placedShips.length} / {totalShipsToPlace}</span>
                      </div>
                      <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full transition-all duration-500" 
                          style={{ width: `${(placedShips.length / totalShipsToPlace) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {room.phase === 'battle' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-bold uppercase tracking-tighter">Giai Đoạn Giao Chiến</h3>
                  <div className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-widest ${room.turn === myId ? 'bg-indigo-500 text-white animate-pulse' : 'bg-white/5 text-slate-500'}`}>
                    {room.turn === myId ? 'Lượt của bạn' : "Lượt đối phương"}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Target size={14} className="text-red-500" /> Lưới Tấn Công (Vùng biển địch)
                  </label>
                  <GameGrid 
                    shots={me?.shots || []}
                    onCellClick={shoot}
                    onMouseEnter={(x, y) => setBattleHover({ x, y })}
                    onMouseLeave={() => setBattleHover(null)}
                    targetable={room.turn === myId && !isSpectator}
                    showShips={room.phase === 'finished'} // Reveal enemy ships at end
                    ships={opponent?.ships} // Pass opponent ships to reveal
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <ShipIcon size={14} className="text-indigo-500" /> Hạm Đội Của Bạn (Vùng biển nhà)
                  </label>
                  <GameGrid 
                    ships={me?.ships}
                    shots={opponent?.shots}
                    showShips={true}
                  />
                </div>
              </div>
            </div>
          )}

          {room.phase === 'finished' && (
            <div className="space-y-8">
              <div className="flex flex-col items-center justify-center py-10 space-y-8">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center space-y-4"
                >
                  <div className="inline-block p-6 bg-yellow-500/20 rounded-full mb-4">
                    <Trophy size={64} className="text-yellow-500" />
                  </div>
                  <h3 className="text-5xl font-black uppercase italic tracking-tighter">
                    {room.winner === myId ? 'Chiến Thắng!' : 'Hạm Đội Bị Tiêu Diệt'}
                  </h3>
                  <p className="text-slate-400 uppercase tracking-widest">
                    {room.winner === myId ? 'Hạm đội địch đã bị tiêu diệt hoàn toàn.' : 'Tàu của bạn đã bị đánh chìm. Hãy rút lui về căn cứ.'}
                  </p>
                </motion.div>
                <button 
                  onClick={leaveRoom}
                  className="bg-white text-black px-8 py-3 rounded-lg font-bold hover:bg-slate-200 transition-colors uppercase tracking-widest text-sm"
                >
                  Quay lại cảng
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Bản đồ đối phương (Đã lộ diện)</label>
                  <GameGrid 
                    ships={opponent?.ships}
                    shots={me?.shots}
                    showShips={true}
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Bản đồ của bạn</label>
                  <GameGrid 
                    ships={me?.ships}
                    shots={opponent?.shots}
                    showShips={true}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar / Intel */}
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-white/10 p-6 rounded-xl space-y-6">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Users size={14} /> Tình Báo Chiến Thuật
            </h4>
            
            <div className="space-y-4">
              {room.players.map(p => (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${p.id === myId ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/5'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${p.isReady ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="font-bold text-sm uppercase tracking-tight">{p.name} {p.id === myId && '(BẠN)'}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    {p.shots.filter(s => s.hit).length} TRÚNG
                  </div>
                </div>
              ))}
              {room.spectators.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Khán giả ({room.spectators.length})</span>
                </div>
              )}
            </div>

            {room.phase === 'battle' && (
              <div className="space-y-4 pt-4 border-t border-white/5">
                <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nhật Ký Chiến Đấu</h5>
                <div className="space-y-2 max-h-40 overflow-y-auto text-[10px] font-mono text-slate-400">
                  {[...(me?.shots || []), ...(opponent?.shots || [])]
                    .sort((a, b) => 0) 
                    .slice(-5)
                    .map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                        <span className={s.hit ? 'text-red-400' : 'text-slate-500'}>
                          {s.hit ? 'TRÚNG ĐÍCH' : 'HỤT'} TẠI {String.fromCharCode(65 + s.y)}{s.x + 1}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-xl">
            <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-2">Nhiệm Vụ Chiến Đấu</h4>
            <p className="text-xs text-indigo-300/70 leading-relaxed">
              Tìm và tiêu diệt toàn bộ 5 tàu của địch. 
              Bắn trúng sẽ được bắn tiếp. 
              Hãy phối hợp và duy trì ưu thế chiến thuật.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

