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
        
        // Touch gesture properties
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        this.isTouchDevice = 'ontouchstart' in window;
        this.gestureThreshold = 30; // Minimum distance for swipe
        this.tapThreshold = 200; // Maximum time for tap
        this.swipeThreshold = 50; // Minimum distance for swipe
        
        // Gamification properties
        this.learnedTSRs = new Set();
        this.achievements = new Set();
        this.quizStats = { correct: 0, total: 0, streak: 0 };
        this.memoryStats = { correct: 0, total: 0 };
        this.currentQuizQuestion = null;
        this.currentMemoryTSR = null;
        
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
        this.setupMobileOptimizations();
    }
    
    setupMobileOptimizations() {
        // Prevent zoom on double tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Add viewport meta tag if not present
        if (!document.querySelector('meta[name="viewport"]')) {
            const viewport = document.createElement('meta');
            viewport.name = 'viewport';
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            document.head.appendChild(viewport);
        }
        
        // Show touch controls on mobile
        if (this.isTouchDevice) {
            document.getElementById('touchControls').style.display = 'block';
        }
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
        // Keyboard controls
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
        
        // Touch controls
        this.setupTouchControls();
        
        // Button controls
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restart();
        });
        
        // Gamification event listeners
        this.setupGamificationEvents();
    }
    
    setupTouchControls() {
        const canvas = this.canvas;
        
        // Touch events for gestures
        canvas.addEventListener('touchstart', (e) => {
            if (!this.gameRunning || this.gameOver) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.touchStartTime = Date.now();
            this.lastTouchX = touch.clientX;
            this.lastTouchY = touch.clientY;
        }, { passive: false });
        
        canvas.addEventListener('touchmove', (e) => {
            if (!this.gameRunning || this.gameOver) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            this.lastTouchX = touch.clientX;
            this.lastTouchY = touch.clientY;
        }, { passive: false });
        
        canvas.addEventListener('touchend', (e) => {
            if (!this.gameRunning || this.gameOver) return;
            e.preventDefault();
            
            this.handleTouchEnd();
        }, { passive: false });
        
        // Virtual button controls
        document.getElementById('leftBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.movePiece(-1, 0);
            this.vibrate(50);
        });
        
        document.getElementById('rightBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.movePiece(1, 0);
            this.vibrate(50);
        });
        
        document.getElementById('rotateBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.rotatePiece();
            this.vibrate(100);
        });
        
        document.getElementById('dropBtn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.hardDrop();
            this.vibrate(150);
        });
        
        // Prevent context menu on long press
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    handleTouchEnd() {
        const deltaX = this.lastTouchX - this.touchStartX;
        const deltaY = this.lastTouchY - this.touchStartY;
        const deltaTime = Date.now() - this.touchStartTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Determine gesture type
        if (distance < this.gestureThreshold && deltaTime < this.tapThreshold) {
            // Tap - rotate piece
            this.rotatePiece();
            this.vibrate(100);
        } else if (distance > this.swipeThreshold) {
            // Swipe gesture
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            
            if (absX > absY) {
                // Horizontal swipe
                if (deltaX > 0) {
                    this.movePiece(1, 0); // Swipe right
                } else {
                    this.movePiece(-1, 0); // Swipe left
                }
                this.vibrate(50);
            } else {
                // Vertical swipe
                if (deltaY > 0) {
                    // Swipe down - quick drop
                    this.hardDrop();
                    this.vibrate(150);
                } else {
                    // Swipe up - rotate
                    this.rotatePiece();
                    this.vibrate(100);
                }
            }
        }
    }
    
    vibrate(duration = 50) {
        if (navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }
    
    setupGamificationEvents() {
        // Tab switching
        document.getElementById('catalogTab').addEventListener('click', () => this.switchTab('catalog'));
        document.getElementById('quizTab').addEventListener('click', () => this.switchTab('quiz'));
        document.getElementById('memoryTab').addEventListener('click', () => this.switchTab('memory'));
        
        // Quiz events
        document.getElementById('nextQuestionBtn').addEventListener('click', () => {
            this.generateQuizQuestion();
        });
        
        // Memory game events
        document.getElementById('memoryCheckBtn').addEventListener('click', () => {
            this.checkMemoryAnswer();
        });
        
        document.getElementById('nextMemoryBtn').addEventListener('click', () => {
            this.generateMemoryTSR();
        });
        
        // Enter key for memory input
        document.getElementById('memoryCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkMemoryAnswer();
            }
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
            
            // Show falling piece info after a short delay to avoid flickering
            setTimeout(() => {
                this.showFallingPieceInfo();
            }, 100);
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
        
        // Mark TSR as learned when used in game
        this.markTSRAsLearned(this.currentPiece.tsr);
        
        // Hide falling piece info before spawning new piece
        this.hideFallingPieceInfo();
        
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
        this.hideFallingPieceInfo();
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
    
    // Gamification methods
    markTSRAsLearned(tsrCode) {
        if (!this.learnedTSRs.has(tsrCode)) {
            this.learnedTSRs.add(tsrCode);
            this.updateLearningProgress();
            this.checkAchievements();
        }
    }
    
    updateLearningProgress() {
        const totalTSRs = Object.keys(TSR_DATA).length;
        const learnedCount = this.learnedTSRs.size;
        const percentage = (learnedCount / totalTSRs) * 100;
        
        document.getElementById('learningProgress').style.width = `${percentage}%`;
        document.getElementById('learningText').textContent = `Изучено: ${learnedCount}/${totalTSRs}`;
    }
    
    checkAchievements() {
        const learnedCount = this.learnedTSRs.size;
        
        // First TSR achievement
        if (learnedCount >= 1 && !this.achievements.has('firstTsr')) {
            this.achievements.add('firstTsr');
            this.showAchievement('firstTsr', '🎯 Первое ТСР изучено!');
        }
        
        // Category master achievement
        if (learnedCount >= 10 && !this.achievements.has('categoryMaster')) {
            this.achievements.add('categoryMaster');
            this.showAchievement('categoryMaster', '🏆 Мастер категории!');
        }
    }
    
    showAchievement(achievementId, text) {
        const achievementElement = document.getElementById(achievementId);
        if (achievementElement) {
            achievementElement.style.display = 'flex';
            achievementElement.querySelector('.achievement-text').textContent = text;
        }
        
        // Show notification
        this.showNotification(text, 'success');
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Quiz functionality
    startQuiz() {
        this.quizStats = { correct: 0, total: 0, streak: 0 };
        this.generateQuizQuestion();
    }
    
    generateQuizQuestion() {
        const tsrCodes = Object.keys(TSR_DATA);
        const correctCode = tsrCodes[Math.floor(Math.random() * tsrCodes.length)];
        const tsrData = TSR_DATA[correctCode];
        
        this.currentQuizQuestion = { correctCode, tsrData };
        
        // Update UI
        document.getElementById('quizIcon').textContent = tsrData.icon;
        document.getElementById('quizName').textContent = tsrData.name;
        
        // Generate options
        const options = [correctCode];
        while (options.length < 4) {
            const randomCode = tsrCodes[Math.floor(Math.random() * tsrCodes.length)];
            if (!options.includes(randomCode)) {
                options.push(randomCode);
            }
        }
        
        // Shuffle options
        options.sort(() => Math.random() - 0.5);
        
        const optionsContainer = document.getElementById('quizOptions');
        optionsContainer.innerHTML = '';
        
        options.forEach(code => {
            const option = document.createElement('div');
            option.className = 'quiz-option';
            option.textContent = code;
            option.addEventListener('click', () => this.checkQuizAnswer(code));
            optionsContainer.appendChild(option);
        });
        
        document.getElementById('quizResult').style.display = 'none';
    }
    
    checkQuizAnswer(selectedCode) {
        const isCorrect = selectedCode === this.currentQuizQuestion.correctCode;
        this.quizStats.total++;
        
        if (isCorrect) {
            this.quizStats.correct++;
            this.quizStats.streak++;
            this.markTSRAsLearned(selectedCode);
        } else {
            this.quizStats.streak = 0;
        }
        
        // Update UI
        const options = document.querySelectorAll('.quiz-option');
        options.forEach(option => {
            if (option.textContent === this.currentQuizQuestion.correctCode) {
                option.classList.add('correct');
            } else if (option.textContent === selectedCode && !isCorrect) {
                option.classList.add('incorrect');
            }
            option.style.pointerEvents = 'none';
        });
        
        // Show result
        const resultText = document.getElementById('resultText');
        resultText.textContent = isCorrect ? 'Правильно! 🎉' : `Неправильно. Правильный ответ: ${this.currentQuizQuestion.correctCode}`;
        resultText.className = `result-text ${isCorrect ? 'correct' : 'incorrect'}`;
        
        document.getElementById('quizResult').style.display = 'block';
        this.updateQuizStats();
    }
    
    updateQuizStats() {
        document.getElementById('quizCorrect').textContent = this.quizStats.correct;
        document.getElementById('quizTotal').textContent = this.quizStats.total;
        document.getElementById('quizStreak').textContent = this.quizStats.streak;
    }
    
    // Memory game functionality
    startMemoryGame() {
        this.memoryStats = { correct: 0, total: 0 };
        this.generateMemoryTSR();
    }
    
    generateMemoryTSR() {
        const tsrCodes = Object.keys(TSR_DATA);
        const randomCode = tsrCodes[Math.floor(Math.random() * tsrCodes.length)];
        const tsrData = TSR_DATA[randomCode];
        
        this.currentMemoryTSR = { code: randomCode, data: tsrData };
        
        // Update UI
        document.getElementById('memoryIcon').textContent = tsrData.icon;
        document.getElementById('memoryName').textContent = tsrData.name;
        document.getElementById('memoryDescription').textContent = tsrData.description;
        
        document.getElementById('memoryCodeInput').value = '';
        document.getElementById('memoryResult').style.display = 'none';
        document.getElementById('memoryCodeInput').focus();
    }
    
    checkMemoryAnswer() {
        const input = document.getElementById('memoryCodeInput');
        const userAnswer = input.value.trim().toUpperCase();
        const correctAnswer = this.currentMemoryTSR.code.toUpperCase();
        
        this.memoryStats.total++;
        
        const isCorrect = userAnswer === correctAnswer;
        if (isCorrect) {
            this.memoryStats.correct++;
            this.markTSRAsLearned(this.currentMemoryTSR.code);
        }
        
        // Show result
        const resultText = document.getElementById('memoryResultText');
        resultText.textContent = isCorrect ? 'Правильно! 🎉' : `Неправильно. Правильный ответ: ${this.currentMemoryTSR.code}`;
        resultText.className = `result-text ${isCorrect ? 'correct' : 'incorrect'}`;
        
        document.getElementById('memoryResult').style.display = 'block';
        this.updateMemoryStats();
    }
    
    updateMemoryStats() {
        document.getElementById('memoryCorrect').textContent = this.memoryStats.correct;
        document.getElementById('memoryTotal').textContent = this.memoryStats.total;
    }
    
    // Tab switching
    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(`${tabName}Content`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Initialize tab content
        if (tabName === 'quiz' && !this.currentQuizQuestion) {
            this.startQuiz();
        } else if (tabName === 'memory' && !this.currentMemoryTSR) {
            this.startMemoryGame();
        }
    }
    
    // Falling piece info methods
    showFallingPieceInfo() {
        if (!this.currentPiece) return;
        
        const tsrData = TSR_DATA[this.currentPiece.tsr];
        if (!tsrData) return;
        
        const infoPanel = document.getElementById('fallingPieceInfo');
        
        // Update UI elements
        document.getElementById('fallingIcon').textContent = tsrData.icon;
        document.getElementById('fallingCode').textContent = this.currentPiece.tsr;
        document.getElementById('fallingName').textContent = tsrData.name;
        document.getElementById('fallingDescription').textContent = tsrData.description;
        
        // Show the info panel with smooth transition
        infoPanel.style.display = 'block';
        infoPanel.style.opacity = '0';
        infoPanel.style.transform = 'translateY(-10px)';
        
        // Animate in
        requestAnimationFrame(() => {
            infoPanel.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            infoPanel.style.opacity = '1';
            infoPanel.style.transform = 'translateY(0)';
        });
    }
    
    hideFallingPieceInfo() {
        const infoPanel = document.getElementById('fallingPieceInfo');
        
        // Animate out
        infoPanel.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        infoPanel.style.opacity = '0';
        infoPanel.style.transform = 'translateY(-10px)';
        
        // Hide after animation
        setTimeout(() => {
            infoPanel.style.display = 'none';
        }, 300);
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new TetrisGame();
});
