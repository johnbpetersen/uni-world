import React, { useState, useEffect } from 'react';
import RingWorldGame from './components/RingWorldGame';
import { GameState, GameStats, UpgradeStats } from './types';
import { audioService } from './services/audioService';
import { consultOracle } from './services/geminiService';
import { UPGRADE_COST_BASE, UPGRADE_COST_SCALING } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [stats, setStats] = useState<GameStats>({
    shards: 0,
    berries: 0,
    timeSurvived: 0,
    enemiesKilled: 0,
  });
  const [upgrades, setUpgrades] = useState<UpgradeStats>({
    maxHp: 100,
    attackDamage: 10,
    moveSpeed: 1.0,
    orbitals: 0,
  });

  const [highScore, setHighScore] = useState<number>(0);
  const [oracleMessage, setOracleMessage] = useState<string>("");
  const [isLoadingOracle, setIsLoadingOracle] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('unicycle_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
    
    // Start audio context on user click anywhere (browser policy)
    const initAudio = () => {
      audioService.resume();
      window.removeEventListener('click', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('click', initAudio);
    window.addEventListener('keydown', initAudio);
  }, []);

  const handleGameOver = (finalStats: GameStats) => {
    if (finalStats.shards > highScore) {
      setHighScore(finalStats.shards);
      localStorage.setItem('unicycle_highscore', finalStats.shards.toString());
    }
    // Auto consult oracle for eulogy
    setIsLoadingOracle(true);
    consultOracle(finalStats, 'DEATH').then(msg => {
      setOracleMessage(msg);
      setIsLoadingOracle(false);
    });
  };

  const restartGame = () => {
    setStats({ shards: 0, berries: 0, timeSurvived: 0, enemiesKilled: 0 });
    setUpgrades({ maxHp: 100, attackDamage: 10, moveSpeed: 1.0, orbitals: 0 });
    setGameState(GameState.PLAYING);
    setOracleMessage("");
  };

  const askOracleTip = async () => {
    setIsLoadingOracle(true);
    const msg = await consultOracle(stats, 'TIP');
    setOracleMessage(msg);
    setIsLoadingOracle(false);
  };

  const getUpgradeCost = () => {
    // Simple calculation based on total upgrade count
    const count = upgrades.orbitals + Math.round((upgrades.moveSpeed - 1)*10) + ((upgrades.maxHp - 100)/20) + ((upgrades.attackDamage - 10)/5);
    return Math.floor(UPGRADE_COST_BASE * Math.pow(UPGRADE_COST_SCALING, count));
  };
  
  const currentCost = getUpgradeCost();

  return (
    <div className="relative w-full h-screen bg-gray-900 text-white overflow-hidden">
      {/* Scanline Effect Div */}
      <div className="scanline pointer-events-none"></div>

      <RingWorldGame 
        gameState={gameState}
        setGameState={setGameState}
        stats={stats}
        setStats={setStats}
        upgrades={upgrades}
        setUpgrades={setUpgrades}
        onGameOver={handleGameOver}
      />

      {/* HUD */}
      {gameState === GameState.PLAYING && (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 text-sm md:text-base font-mono pointer-events-none">
           <div className="flex items-center gap-2 text-red-400 drop-shadow-md">
             <span>❤️</span>
             <div className="w-32 h-4 bg-gray-700 rounded-full overflow-hidden border border-gray-500">
                <div className="h-full bg-red-500 transition-all duration-200" style={{width: '100%'}}></div>
                {/* Note: We don't have exact HP in parent state easily without prop drilling back up constantly, 
                    but for UI we can use maxHp mostly or just trust the canvas visual feedback. 
                    Let's keep it simple: Display Resources. 
                */}
             </div>
           </div>
           <div className="flex items-center gap-2 text-red-500 drop-shadow-md">
             <span className="text-xl">🍒</span>
             <span className="text-2xl font-bold">{stats.berries}</span>
           </div>
           <div className="flex items-center gap-2 text-blue-400 drop-shadow-md">
             <span className="text-xl">💎</span>
             <span className="text-xl">{stats.shards}</span>
           </div>
           <div className="mt-2 opacity-70">Time: {(stats.timeSurvived / 1000).toFixed(0)}s</div>
        </div>
      )}

      {/* Upgrade Panel (Sticky/Always Visible on Desktop, togglable on mobile ideally, but sticking to corners) */}
      {gameState === GameState.PLAYING && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end pointer-events-auto">
          <div className="text-xs text-gray-400 mb-1">Cost: {currentCost} 🍒</div>
          <div className="flex flex-col gap-2">
            <UpgradeBtn label="[1] Max HP" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', {'code': 'Digit1'}))} cost={currentCost} balance={stats.berries} />
            <UpgradeBtn label="[2] DMG" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', {'code': 'Digit2'}))} cost={currentCost} balance={stats.berries} />
            <UpgradeBtn label="[3] Speed" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', {'code': 'Digit3'}))} cost={currentCost} balance={stats.berries} />
            <UpgradeBtn label="[4] Orbital" onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', {'code': 'Digit4'}))} cost={currentCost} balance={stats.berries} />
          </div>
        </div>
      )}

      {/* Start Screen */}
      {gameState === GameState.START && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 mb-4 drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]">
            UNI-CYCLE
          </h1>
          <p className="text-xl text-gray-300 mb-8 font-mono">The Ring of Poop</p>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 max-w-md text-center">
            <p className="mb-4 text-sm text-gray-400">
              Sprint left/right. Space to DASH (invincible).<br/>
              Drop poop automatically. Stand on patches to PLANT.<br/>
              Collect Berries 🍒 to buy Upgrades.<br/>
              Kill Shadows to get Shards 💎.
            </p>
            <button 
              onClick={() => setGameState(GameState.PLAYING)}
              className="px-8 py-3 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full text-white font-bold text-xl hover:scale-105 transition-transform shadow-lg shadow-pink-500/20"
            >
              START RUN
            </button>
          </div>
        </div>
      )}

      {/* Game Over / Pause Screen */}
      {(gameState === GameState.GAME_OVER || gameState === GameState.PAUSED) && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 backdrop-blur-md">
          <h2 className="text-5xl font-bold text-white mb-2">
            {gameState === GameState.PAUSED ? "PAUSED" : "YOU DIED"}
          </h2>
          
          <div className="grid grid-cols-2 gap-8 my-8 text-center font-mono">
            <div>
              <div className="text-gray-500 text-sm">Score</div>
              <div className="text-3xl text-blue-400">{stats.shards}</div>
            </div>
            <div>
              <div className="text-gray-500 text-sm">High Score</div>
              <div className="text-3xl text-yellow-400">{highScore}</div>
            </div>
          </div>

          {/* Oracle Section */}
          <div className="mb-8 p-4 bg-gray-800/50 rounded border border-gray-700 max-w-lg w-full text-center min-h-[100px] flex flex-col justify-center items-center">
             {isLoadingOracle ? (
               <span className="animate-pulse text-purple-400">Consulting the stars...</span>
             ) : (
               <p className="italic text-purple-300">"{oracleMessage || (gameState === GameState.PAUSED ? "Paused in the void." : "Rest in peace, star runner.")}"</p>
             )}
             {gameState === GameState.PAUSED && (
                <button onClick={askOracleTip} className="mt-4 text-xs text-gray-500 hover:text-white underline">
                  Ask Oracle for a Tip
                </button>
             )}
          </div>

          <div className="flex gap-4">
            <button 
              onClick={gameState === GameState.PAUSED ? () => setGameState(GameState.PLAYING) : restartGame}
              className="px-8 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-colors"
            >
              {gameState === GameState.PAUSED ? "RESUME" : "TRY AGAIN"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const UpgradeBtn: React.FC<{label: string, onClick: () => void, cost: number, balance: number}> = ({label, onClick, cost, balance}) => {
  const canAfford = balance >= cost;
  return (
    <button 
      onClick={onClick}
      disabled={!canAfford}
      className={`
        flex items-center justify-between w-32 px-3 py-2 rounded border text-sm font-mono transition-all
        ${canAfford 
          ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-white shadow-lg' 
          : 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'}
      `}
    >
      <span>{label}</span>
    </button>
  );
};

export default App;