import './style.css';
import { createGame } from './game/game';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<div id="game-root"></div>`;
createGame('game-root');
