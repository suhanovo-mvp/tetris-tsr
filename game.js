class TetrisGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('nextCanvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        this.BOARD_WIDTH = 10;
        this.BOARD_HEIGHT = 20;
        this.CELL_SIZE = 30;
        
        this.board = [];
        this.currentPiece = null;
        this.nextPiece = null;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropTime = 0;
        this.dropInterval = 1000;
        
        this.gameRunning = false;
        this.gameOver = false;
        
        // Animation properties
        this.clearingLines = [];
        this.clearAnimationTime = 0;
        this.pieceAnimation = { scale: 1, rotation: 0 };
        
        this.init();
    }
    
    init() {
        this.initBoard();
        this.setupEventListeners();
        this.generateNextPiece();
        this.spawnPiece();
        this.gameRunning = true;
        this.gameLoop();
        this.createTSRCatalog();
    }
    
    initBoard() {
        this.board = [];
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            this.board[y] = [];
            for (let x = 0; x < this.BOARD_WIDTH; x++) {
                this.board[y][x] = 0;
            }
        }
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.gameRunning || this.gameOver) return;
            
            switch(e.code) {
                case 'ArrowLeft':
                    this.movePiece(-1, 0);
                    break;
                case 'ArrowRight':
                    this.movePiece(1, 0);
                    break;
                case 'ArrowDown':
                    this.movePiece(0, 1);
                    break;
                case 'ArrowUp':
                    this.rotatePiece();
                    break;
                case 'Space':
                    e.preventDefault();
                    this.hardDrop();
                    break;
            }
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restart();
        });
    }
    
    generateNextPiece() {
        const pieces = Object.keys(TETRIS_PIECES);
        const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
        this.nextPiece = {
            type: randomPiece,
            shape: TETRIS_PIECES[randomPiece].shape,
            tsr: TETRIS_PIECES[randomPiece].tsr,
            name: TETRIS_PIECES[randomPiece].name,
            x: 0,
            y: 0
        };
    }
    
    spawnPiece() {
        if (this.nextPiece) {
            this.currentPiece = { ...this.nextPiece };
            this.currentPiece.x = Math.floor(this.BOARD_WIDTH / 2) - Math.floor(this.currentPiece.shape[0].length / 2);
            this.currentPiece.y = 0;
            
            if (this.checkCollision(this.currentPiece, 0, 0)) {
                this.gameOver = true;
                this.gameRunning = false;
                this.showGameOver();
                return;
            }
            
            this.generateNextPiece();
            this.drawNextPiece();
        }
    }
    
    movePiece(dx, dy) {
        if (!this.checkCollision(this.currentPiece, dx, dy)) {
            this.currentPiece.x += dx;
            this.currentPiece.y += dy;
            if (dx !== 0) {
                this.playSound('move');
            }
            return true;
        }
        return false;
    }
    
    rotatePiece() {
        const rotated = this.rotateMatrix(this.currentPiece.shape);
        const originalShape = this.currentPiece.shape;
        this.currentPiece.shape = rotated;
        
        if (this.checkCollision(this.currentPiece, 0, 0)) {
            this.currentPiece.shape = originalShape;
        } else {
            this.playSound('rotate');
        }
    }
    
    rotateMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const rotated = [];
        
        for (let i = 0; i < cols; i++) {
            rotated[i] = [];
            for (let j = 0; j < rows; j++) {
                rotated[i][j] = matrix[rows - 1 - j][i];
            }
        }
        
        return rotated;
    }
    
    hardDrop() {
        while (this.movePiece(0, 1)) {
            this.score += 2;
        }
        this.playSound('drop');
        this.placePiece();
    }
    
    checkCollision(piece, dx, dy) {
        const newX = piece.x + dx;
        const newY = piece.y + dy;
        
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const boardX = newX + x;
                    const boardY = newY + y;
                    
                    if (boardX < 0 || boardX >= this.BOARD_WIDTH || 
                        boardY >= this.BOARD_HEIGHT || 
                        (boardY >= 0 && this.board[boardY][boardX])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    placePiece() {
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    const boardX = this.currentPiece.x + x;
                    const boardY = this.currentPiece.y + y;
                    if (boardY >= 0) {
                        this.board[boardY][boardX] = this.currentPiece.tsr;
                    }
                }
            }
        }
        
        this.clearLines();
        this.spawnPiece();
    }
    
    clearLines() {
        let linesCleared = 0;
        this.clearingLines = [];
        
        for (let y = this.BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0)) {
                this.clearingLines.push(y);
                linesCleared++;
            }
        }
        
        if (linesCleared > 0) {
            this.clearAnimationTime = 500; // Animation duration in ms
            this.playSound('lineClear');
            
            // Delay the actual clearing for animation
            setTimeout(() => {
                this.clearingLines.forEach(lineY => {
                    this.board.splice(lineY, 1);
                    this.board.unshift(new Array(this.BOARD_WIDTH).fill(0));
                });
                this.clearingLines = [];
                this.clearAnimationTime = 0;
            }, 300);
            
            this.lines += linesCleared;
            this.score += linesCleared * 100 * this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
            
            this.updateScore();
        }
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = `Уровень: ${this.level}`;
        document.getElementById('lines').textContent = `Линии: ${this.lines}`;
    }
    
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#f8f9fa';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw board
        this.drawBoard();
        
        // Draw current piece
        if (this.currentPiece) {
            this.drawPiece(this.currentPiece);
        }
        
        // Draw clearing animation
        if (this.clearAnimationTime > 0) {
            this.drawClearingAnimation();
        }
        
        // Draw grid
        this.drawGrid();
    }
    
    drawBoard() {
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            for (let x = 0; x < this.BOARD_WIDTH; x++) {
                if (this.board[y][x]) {
                    const tsrCode = this.board[y][x];
                    const tsrData = TSR_DATA[tsrCode];
                    const color = tsrData ? tsrData.color : '#333';
                    
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(x * this.CELL_SIZE, y * this.CELL_SIZE, this.CELL_SIZE, this.CELL_SIZE);
                    
                    // Draw TSR icon
                    if (tsrData && tsrData.icon) {
                        this.ctx.fillStyle = 'white';
                        this.ctx.font = '16px Arial';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(
                            tsrData.icon, 
                            x * this.CELL_SIZE + this.CELL_SIZE / 2, 
                            y * this.CELL_SIZE + this.CELL_SIZE / 2 + 5
                        );
                    }
                }
            }
        }
    }
    
    drawPiece(piece) {
        const tsrData = TSR_DATA[piece.tsr];
        const color = tsrData ? tsrData.color : '#333';
        
        this.ctx.fillStyle = color;
        
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const drawX = (piece.x + x) * this.CELL_SIZE;
                    const drawY = (piece.y + y) * this.CELL_SIZE;
                    
                    this.ctx.fillRect(drawX, drawY, this.CELL_SIZE, this.CELL_SIZE);
                    
                    // Draw TSR icon
                    if (tsrData && tsrData.icon) {
                        this.ctx.fillStyle = 'white';
                        this.ctx.font = '16px Arial';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(
                            tsrData.icon, 
                            drawX + this.CELL_SIZE / 2, 
                            drawY + this.CELL_SIZE / 2 + 5
                        );
                        this.ctx.fillStyle = color;
                    }
                }
            }
        }
    }
    
    drawGrid() {
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= this.BOARD_WIDTH; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.CELL_SIZE, 0);
            this.ctx.lineTo(x * this.CELL_SIZE, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.BOARD_HEIGHT; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.CELL_SIZE);
            this.ctx.lineTo(this.canvas.width, y * this.CELL_SIZE);
            this.ctx.stroke();
        }
    }
    
    drawClearingAnimation() {
        const progress = 1 - (this.clearAnimationTime / 500);
        const alpha = Math.sin(progress * Math.PI);
        
        this.ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
        
        this.clearingLines.forEach(lineY => {
            this.ctx.fillRect(0, lineY * this.CELL_SIZE, this.canvas.width, this.CELL_SIZE);
        });
        
        this.clearAnimationTime -= 16; // Assuming 60fps
    }
    
    playSound(soundType) {
        // Create audio context for sound effects
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        switch(soundType) {
            case 'move':
                oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.1);
                break;
            case 'rotate':
                oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.1);
                break;
            case 'lineClear':
                oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
                oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);
                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.3);
                break;
            case 'drop':
                oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + 0.2);
                break;
        }
    }
    
    drawNextPiece() {
        this.nextCtx.fillStyle = '#f8f9fa';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        if (this.nextPiece) {
            const tsrData = TSR_DATA[this.nextPiece.tsr];
            const color = tsrData ? tsrData.color : '#333';
            const cellSize = 20;
            const offsetX = (this.nextCanvas.width - this.nextPiece.shape[0].length * cellSize) / 2;
            const offsetY = (this.nextCanvas.height - this.nextPiece.shape.length * cellSize) / 2;
            
            this.nextCtx.fillStyle = color;
            
            for (let y = 0; y < this.nextPiece.shape.length; y++) {
                for (let x = 0; x < this.nextPiece.shape[y].length; x++) {
                    if (this.nextPiece.shape[y][x]) {
                        const drawX = offsetX + x * cellSize;
                        const drawY = offsetY + y * cellSize;
                        
                        this.nextCtx.fillRect(drawX, drawY, cellSize, cellSize);
                        
                        // Draw TSR icon
                        if (tsrData && tsrData.icon) {
                            this.nextCtx.fillStyle = 'white';
                            this.nextCtx.font = '12px Arial';
                            this.nextCtx.textAlign = 'center';
                            this.nextCtx.fillText(
                                tsrData.icon, 
                                drawX + cellSize / 2, 
                                drawY + cellSize / 2 + 4
                            );
                            this.nextCtx.fillStyle = color;
                        }
                    }
                }
            }
        }
    }
    
    createTSRCatalog() {
        const tsrGrid = document.getElementById('tsrGrid');
        tsrGrid.innerHTML = '';
        
        Object.entries(TSR_DATA).forEach(([code, data]) => {
            const tsrItem = document.createElement('div');
            tsrItem.className = 'tsr-item';
            tsrItem.innerHTML = `
                <span class="tsr-icon">${data.icon}</span>
                <div class="tsr-name">${data.name}</div>
                <div class="tsr-code">${code}</div>
                <div class="tsr-description">${data.description}</div>
            `;
            
            tsrItem.addEventListener('click', () => {
                this.showTSRInfo(code, data);
                document.querySelectorAll('.tsr-item').forEach(item => item.classList.remove('active'));
                tsrItem.classList.add('active');
            });
            
            tsrGrid.appendChild(tsrItem);
        });
    }
    
    showTSRInfo(code, data) {
        const description = document.getElementById('tsrDescription');
        description.innerHTML = `
            <h4>${data.name}</h4>
            <p><strong>Код:</strong> ${code}</p>
            <p><strong>Категория:</strong> ${data.category}</p>
            <p><strong>Описание:</strong> ${data.description}</p>
        `;
    }
    
    showGameOver() {
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').style.display = 'block';
    }
    
    restart() {
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropInterval = 1000;
        this.gameOver = false;
        this.gameRunning = true;
        
        this.initBoard();
        this.generateNextPiece();
        this.spawnPiece();
        this.updateScore();
        
        document.getElementById('gameOver').style.display = 'none';
    }
    
    gameLoop() {
        if (!this.gameRunning) return;
        
        const currentTime = Date.now();
        
        if (currentTime - this.dropTime > this.dropInterval) {
            if (!this.movePiece(0, 1)) {
                this.placePiece();
            }
            this.dropTime = currentTime;
        }
        
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TetrisGame();
});
