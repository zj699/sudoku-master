class GameLogic {
    constructor() {
        this.currentLevel = 1;
        this.currentPuzzle = null;
        this.currentSolution = null;
        this.playerGrid = null;
        this.notes = Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
        this.selectedCell = {row: -1, col: -1};
        this.selectedNumber = 0;
        this.isNoteMode = false;
        this.mistakes = 0;
        this.maxMistakes = 3;
        this.hintsUsed = 0;
        this.maxHints = 3;
        this.gameTimer = null;
        this.startTime = 0;
        this.currentTime = 0;
        this.isPaused = false;
        this.generator = new SudokuGenerator();
        this.gameStats = {
            totalTime: 0,
            gamesPlayed: 0,
            gamesWon: 0,
            bestTime: Infinity,
            currentStreak: 0,
            maxStreak: 0
        };
    }

    // 初始化新游戏
    initializeLevel(level) {
        try {
            this.currentLevel = level;
            this.mistakes = 0;
            this.hintsUsed = 0;
            this.selectedCell = {row: -1, col: -1};
            this.selectedNumber = 0;
            this.isNoteMode = false;
            this.isPaused = false;
            
            // 生成数独谜题
            const puzzleData = this.generator.generatePuzzle(level);
            
            if (!puzzleData || !puzzleData.puzzle || !puzzleData.solution) {
                throw new Error('数独生成失败');
            }
            
            this.currentPuzzle = puzzleData.puzzle;
            this.currentSolution = puzzleData.solution;
            this.playerGrid = this.currentPuzzle.map(row => [...row]);
            
            // 确保playerGrid格式正确
            if (!Array.isArray(this.playerGrid) || this.playerGrid.length !== 9) {
                throw new Error('玩家网格格式错误');
            }
            
            for (let i = 0; i < 9; i++) {
                if (!Array.isArray(this.playerGrid[i]) || this.playerGrid[i].length !== 9) {
                    throw new Error(`玩家网格第${i}行格式错误`);
                }
            }
            
            // 重置笔记
            this.notes = Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
            
            // 开始计时
            this.startTimer();
            
            console.log(`关卡${level}初始化成功`);
            
            return {
                puzzle: this.currentPuzzle,
                solution: this.currentSolution,
                type: puzzleData.type,
                difficulty: puzzleData.difficulty,
                level: level
            };
            
        } catch (error) {
            console.error('关卡初始化失败:', error);
            // 返回一个基本的可用状态
            this.initializeFallbackLevel();
            return {
                puzzle: this.currentPuzzle,
                solution: this.currentSolution,
                type: '标准9x9',
                difficulty: '简单',
                level: level
            };
        }
    }

    // 初始化备用关卡（当生成失败时使用）
    initializeFallbackLevel() {
        console.log('使用备用关卡初始化');
        
        // 创建一个简单的部分填充网格
        this.currentSolution = [
            [5,3,4,6,7,8,9,1,2],
            [6,7,2,1,9,5,3,4,8],
            [1,9,8,3,4,2,5,6,7],
            [8,5,9,7,6,1,4,2,3],
            [4,2,6,8,5,3,7,9,1],
            [7,1,3,9,2,4,8,5,6],
            [9,6,1,5,3,7,2,8,4],
            [2,8,7,4,1,9,6,3,5],
            [3,4,5,2,8,6,1,7,9]
        ];
        
        // 创建谜题（移除一些数字）
        this.currentPuzzle = this.currentSolution.map(row => [...row]);
        const cellsToRemove = [[0,1],[0,3],[0,5],[1,0],[1,2],[1,6],[2,1],[2,7]]; // 简单移除
        
        cellsToRemove.forEach(([r, c]) => {
            this.currentPuzzle[r][c] = 0;
        });
        
        this.playerGrid = this.currentPuzzle.map(row => [...row]);
        this.notes = Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
        
        console.log('备用关卡初始化完成');
    }

    // 开始计时器
    startTimer() {
        this.startTime = Date.now();
        this.currentTime = 0;
        
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
        }
        
        this.gameTimer = setInterval(() => {
            if (!this.isPaused) {
                this.currentTime = Date.now() - this.startTime;
                this.updateTimerDisplay();
            }
        }, 1000);
    }

    // 暂停/恢复游戏
    pauseGame() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    // 停止计时器
    stopTimer() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
    }

    // 更新计时器显示
    updateTimerDisplay() {
        const minutes = Math.floor(this.currentTime / 60000);
        const seconds = Math.floor((this.currentTime % 60000) / 1000);
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timerElement = document.getElementById('gameTimer');
        if (timerElement) {
            timerElement.textContent = timeString;
        }
    }

    // 获取格式化时间
    getFormattedTime() {
        const minutes = Math.floor(this.currentTime / 60000);
        const seconds = Math.floor((this.currentTime % 60000) / 1000);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // 选择格子
    selectCell(row, col) {
        // 检查是否是给定数字的格子
        if (this.currentPuzzle[row][col] !== 0) {
            return false;
        }
        
        this.selectedCell = {row, col};
        return true;
    }

    // 选择数字
    selectNumber(number) {
        this.selectedNumber = number;
    }

    // 检查在指定位置放置数字是否符合数独规则
    isValidPlacement(row, col, number) {
        // 检查行中是否已存在该数字
        for (let c = 0; c < 9; c++) {
            if (c !== col && this.playerGrid[row][c] === number) {
                return {valid: false, reason: 'row', conflictCell: {row, col: c}};
            }
        }

        // 检查列中是否已存在该数字
        for (let r = 0; r < 9; r++) {
            if (r !== row && this.playerGrid[r][col] === number) {
                return {valid: false, reason: 'col', conflictCell: {row: r, col}};
            }
        }

        // 检查3x3区域中是否已存在该数字
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        
        for (let r = startRow; r < startRow + 3; r++) {
            for (let c = startCol; c < startCol + 3; c++) {
                if ((r !== row || c !== col) && this.playerGrid[r][c] === number) {
                    return {valid: false, reason: 'box', conflictCell: {row: r, col: c}};
                }
            }
        }

        return {valid: true};
    }

    // 在格子中放置数字
    placeNumber(row, col, number) {
        // 检查是否是给定数字的格子
        if (this.currentPuzzle[row][col] !== 0) {
            return {success: false, reason: 'given'};
        }

        // 如果是笔记模式
        if (this.isNoteMode) {
            return this.toggleNote(row, col, number);
        }

        // 检查数独规则
        const validation = this.isValidPlacement(row, col, number);
        if (!validation.valid) {
            return {
                success: false, 
                reason: 'rule_violation',
                violationType: validation.reason,
                conflictCell: validation.conflictCell,
                message: this.getRuleViolationMessage(validation.reason)
            };
        }

        // 清除该格子的笔记
        this.notes[row][col].clear();

        // 放置数字
        this.playerGrid[row][col] = number;
        
        // 清除相关格子中的笔记
        this.clearRelatedNotes(row, col, number);
        
        // 检查是否与正确解决方案匹配（仅用于提供反馈）
        const isCorrectAnswer = this.currentSolution && this.currentSolution[row][col] === number;
        
        // 检查是否完成游戏
        if (this.isGameComplete()) {
            this.completeGame();
            return {success: true, complete: true, correctAnswer: isCorrectAnswer};
        }
        
        return {success: true, correctAnswer: isCorrectAnswer};
    }

    // 获取规则违反提示信息
    getRuleViolationMessage(violationType) {
        switch (violationType) {
            case 'row':
                return '该数字在同一行中已存在';
            case 'col':
                return '该数字在同一列中已存在';
            case 'box':
                return '该数字在同一个3x3区域中已存在';
            default:
                return '违反数独规则';
        }
    }

    // 切换笔记模式
    toggleNoteMode() {
        this.isNoteMode = !this.isNoteMode;
        return this.isNoteMode;
    }

    // 切换笔记
    toggleNote(row, col, number) {
        if (this.notes[row][col].has(number)) {
            this.notes[row][col].delete(number);
        } else {
            this.notes[row][col].add(number);
        }
        return {success: true, notes: Array.from(this.notes[row][col])};
    }

    // 清除相关笔记
    clearRelatedNotes(row, col, number) {
        // 清除同行的笔记
        for (let c = 0; c < 9; c++) {
            this.notes[row][c].delete(number);
        }
        
        // 清除同列的笔记
        for (let r = 0; r < 9; r++) {
            this.notes[r][col].delete(number);
        }
        
        // 清除同一3x3区域的笔记
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        
        for (let r = startRow; r < startRow + 3; r++) {
            for (let c = startCol; c < startCol + 3; c++) {
                this.notes[r][c].delete(number);
            }
        }
    }

    // 擦除格子
    eraseCell(row, col) {
        if (this.currentPuzzle[row][col] !== 0) {
            return {success: false, reason: 'given'};
        }
        
        this.playerGrid[row][col] = 0;
        this.notes[row][col].clear();
        return {success: true};
    }

    // 获取提示
    getHint() {
        if (this.hintsUsed >= this.maxHints) {
            return {success: false, reason: 'no_hints'};
        }
        
        const hint = this.generator.getHint(this.playerGrid, this.currentSolution);
        if (!hint) {
            return {success: false, reason: 'no_empty_cells'};
        }
        
        this.hintsUsed++;
        
        // 自动填入提示数字
        this.playerGrid[hint.row][hint.col] = hint.value;
        this.notes[hint.row][hint.col].clear();
        this.clearRelatedNotes(hint.row, hint.col, hint.value);
        
        // 检查是否完成游戏
        if (this.isGameComplete()) {
            this.completeGame();
            return {
                success: true,
                hint: hint,
                complete: true,
                hintsRemaining: this.maxHints - this.hintsUsed
            };
        }
        
        return {
            success: true,
            hint: hint,
            hintsRemaining: this.maxHints - this.hintsUsed
        };
    }

    // 检查游戏是否完成
    isGameComplete() {
        // 检查是否所有格子都填满
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.playerGrid[row][col] === 0) {
                    return false;
                }
            }
        }
        
        // 验证解决方案是否正确
        return this.generator.isComplete(this.playerGrid);
    }

    // 完成游戏
    completeGame() {
        this.stopTimer();
        
        // 更新统计信息
        this.gameStats.gamesPlayed++;
        this.gameStats.gamesWon++;
        this.gameStats.totalTime += this.currentTime;
        this.gameStats.currentStreak++;
        
        if (this.currentTime < this.gameStats.bestTime) {
            this.gameStats.bestTime = this.currentTime;
        }
        
        if (this.gameStats.currentStreak > this.gameStats.maxStreak) {
            this.gameStats.maxStreak = this.gameStats.currentStreak;
        }
        
        // 计算星星评级
        const stars = this.calculateStars();
        
        // 保存进度（异步执行，不阻塞游戏完成）
        this.saveProgress().catch(err => {
            console.error('保存关卡完成状态失败:', err);
        });
        
        // 清除当前完成关卡的游戏状态（因为已经完成）
        if (window.sudokuGame && window.sudokuGame.dataManager) {
            window.sudokuGame.dataManager.clearLevelState(this.currentLevel).catch(err => {
                console.error('清除关卡状态失败:', err);
            });
        }
        
        return {
            time: this.currentTime,
            mistakes: this.mistakes,
            hintsUsed: this.hintsUsed,
            stars: stars,
            level: this.currentLevel
        };
    }

    // 游戏失败
    gameOver() {
        this.stopTimer();
        this.gameStats.currentStreak = 0;
        this.gameStats.gamesPlayed++;
        
        return {
            reason: 'too_many_mistakes',
            mistakes: this.mistakes,
            time: this.currentTime
        };
    }

    // 计算星星评级
    calculateStars() {
        let stars = 3;
        
        // 根据时间扣星
        const timeLimit = this.getTimeLimit();
        if (this.currentTime > timeLimit * 1.5) {
            stars = Math.max(1, stars - 1);
        }
        
        // 根据错误扣星
        if (this.mistakes > 0) {
            stars = Math.max(1, stars - 1);
        }
        
        // 根据提示扣星
        if (this.hintsUsed > 1) {
            stars = Math.max(1, stars - 1);
        }
        
        return stars;
    }

    // 获取时间限制（毫秒）
    getTimeLimit() {
        const baseTimes = {
            '简单': 300000,  // 5分钟
            '中等': 600000,  // 10分钟
            '困难': 1200000, // 20分钟
            '专家': 1800000  // 30分钟
        };
        
        const difficulty = this.generator.getDifficulty(this.currentLevel).name;
        return baseTimes[difficulty] || 600000;
    }

    // 获取相关数字（用于高亮显示）
    getRelatedCells(row, col) {
        const related = [];
        
        // 检查游戏状态是否有效
        if (!this.playerGrid || row < 0 || col < 0 || row >= 9 || col >= 9) {
            return related;
        }
        
        const currentNumber = this.playerGrid[row] ? this.playerGrid[row][col] : 0;
        
        if (this.selectedNumber > 0 || currentNumber > 0) {
            const targetNumber = this.selectedNumber || currentNumber;
            
            // 查找相同数字的格子
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (this.playerGrid[r] && this.playerGrid[r][c] === targetNumber) {
                        related.push({row: r, col: c, type: 'same_number'});
                    }
                }
            }
        }
        
        // 添加同行同列同区域的格子
        if (row >= 0 && col >= 0 && row < 9 && col < 9) {
            // 同行
            for (let c = 0; c < 9; c++) {
                if (c !== col) {
                    related.push({row: row, col: c, type: 'same_row'});
                }
            }
            
            // 同列
            for (let r = 0; r < 9; r++) {
                if (r !== row) {
                    related.push({row: r, col: col, type: 'same_col'});
                }
            }
            
            // 同区域
            const startRow = Math.floor(row / 3) * 3;
            const startCol = Math.floor(col / 3) * 3;
            
            for (let r = startRow; r < startRow + 3; r++) {
                for (let c = startCol; c < startCol + 3; c++) {
                    if (r !== row || c !== col) {
                        related.push({row: r, col: c, type: 'same_region'});
                    }
                }
            }
        }
        
        return related;
    }

    // 验证当前状态
    validateCurrentState() {
        return this.generator.validateCurrentState(this.playerGrid);
    }

    // 重置游戏
    resetGame() {
        this.playerGrid = this.currentPuzzle.map(row => [...row]);
        this.notes = Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
        this.mistakes = 0;
        this.hintsUsed = 0;
        this.selectedCell = {row: -1, col: -1};
        this.selectedNumber = 0;
        this.isNoteMode = false;
        this.startTimer();
    }

    // 保存进度
    async saveProgress() {
        const completedLevels = await this.getCompletedLevels();
        const progress = {
            currentLevel: this.currentLevel,
            completedLevels: completedLevels,
            gameStats: this.gameStats,
            settings: this.getSettings()
        };
        
        // 保存到localStorage（兼容性）
        localStorage.setItem('sudoku_progress', JSON.stringify(progress));
        
        // 保存到IndexedDB
        if (window.sudokuGame && window.sudokuGame.dataManager) {
            try {
                const completionData = {
                    completed: true,
                    stars: this.calculateStars(),
                    time: this.currentTime,
                    mistakes: this.mistakes,
                    hintsUsed: this.hintsUsed,
                    completedAt: new Date().toISOString()
                };
                
                await window.sudokuGame.dataManager.saveGameProgress(this.currentLevel, completionData);
                
                // 更新用户统计
                const userStats = {
                    totalGames: this.gameStats.gamesPlayed,
                    gamesWon: this.gameStats.gamesWon,
                    totalTime: this.gameStats.totalTime,
                    bestTime: this.gameStats.bestTime,
                    currentStreak: this.gameStats.currentStreak,
                    maxStreak: this.gameStats.maxStreak,
                    hintsUsed: this.hintsUsed,
                    mistakesMade: this.mistakes
                };
                
                await window.sudokuGame.dataManager.saveUserStats(userStats);
                
                console.log(`✓ 关卡${this.currentLevel}完成状态已保存到数据库`);
            } catch (error) {
                console.error('保存关卡完成状态到数据库失败:', error);
            }
        }
    }

    // 加载进度
    loadProgress() {
        const saved = localStorage.getItem('sudoku_progress');
        if (saved) {
            try {
                const progress = JSON.parse(saved);
                this.currentLevel = progress.currentLevel || 1;
                this.gameStats = {...this.gameStats, ...progress.gameStats};
                return progress;
            } catch (e) {
                console.error('Failed to load progress:', e);
            }
        }
        return null;
    }

    // 获取已完成关卡
    async getCompletedLevels() {
        // 优先从IndexedDB读取
        if (window.sudokuGame && window.sudokuGame.dataManager) {
            try {
                const completedLevels = await window.sudokuGame.dataManager.getAllCompletedLevels();
                return completedLevels.map(level => level.level);
            } catch (error) {
                console.error('从数据库获取已完成关卡失败:', error);
            }
        }
        
        // 回退到localStorage
        const saved = localStorage.getItem('sudoku_progress');
        if (saved) {
            try {
                const progress = JSON.parse(saved);
                return progress.completedLevels || [];
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    // 获取设置
    getSettings() {
        return {
            soundEnabled: true,
            autoCheckErrors: true,
            highlightNumbers: true,
            theme: 'light'
        };
    }

    // 获取成就
    getAchievements() {
        const achievements = [
            {
                id: 'first_win',
                name: '初战告捷',
                description: '完成第一个关卡',
                unlocked: this.gameStats.gamesWon >= 1
            },
            {
                id: 'speed_demon',
                name: '速度恶魔',
                description: '在3分钟内完成一个简单关卡',
                unlocked: this.gameStats.bestTime <= 180000
            },
            {
                id: 'perfectionist',
                name: '完美主义者',
                description: '无错误完成10个关卡',
                unlocked: this.gameStats.gamesWon >= 10 && this.gameStats.currentStreak >= 10
            },
            {
                id: 'marathon_runner',
                name: '马拉松选手',
                description: '累计游戏时间超过10小时',
                unlocked: this.gameStats.totalTime >= 36000000
            },
            {
                id: 'expert_level',
                name: '专家级别',
                description: '完成所有100关',
                unlocked: false // 这里需要异步获取，先设为false
            }
        ];
        
        return achievements;
    }

    // 获取统计信息
    async getStatistics() {
        const completedLevels = await this.getCompletedLevels();
        const totalMinutes = Math.floor(this.gameStats.totalTime / 60000);
        const bestTimeFormatted = this.gameStats.bestTime === Infinity ? 
            '未设定' : 
            `${Math.floor(this.gameStats.bestTime / 60000)}:${Math.floor((this.gameStats.bestTime % 60000) / 1000).toString().padStart(2, '0')}`;
        
        return {
            totalGames: this.gameStats.gamesPlayed,
            gamesWon: this.gameStats.gamesWon,
            winRate: this.gameStats.gamesPlayed > 0 ? Math.round((this.gameStats.gamesWon / this.gameStats.gamesPlayed) * 100) : 0,
            totalTime: `${totalMinutes}分钟`,
            bestTime: bestTimeFormatted,
            currentStreak: this.gameStats.currentStreak,
            maxStreak: this.gameStats.maxStreak,
            completedLevels: completedLevels.length,
            currentLevel: this.currentLevel
        };
    }

    // 保存当前游戏状态
    async saveCurrentState() {
        if (!window.sudokuGame || !window.sudokuGame.dataManager) {
            console.warn('无法保存游戏状态：DataManager不可用');
            return false;
        }

        try {
            // 检查游戏状态是否有效
            if (!this.playerGrid || !Array.isArray(this.playerGrid)) {
                console.warn('playerGrid无效，跳过保存');
                return false;
            }

            const gameState = {
                level: this.currentLevel,
                playerGrid: this.playerGrid,
                notes: this.notes,
                mistakes: this.mistakes,
                hintsUsed: this.hintsUsed,
                currentTime: this.currentTime,
                startTime: this.startTime,
                selectedCell: this.selectedCell,
                selectedNumber: this.selectedNumber,
                isNoteMode: this.isNoteMode,
                puzzle: this.currentPuzzle,
                solution: this.currentSolution
            };

            console.log(`保存游戏状态 - 关卡${this.currentLevel}, 错误${this.mistakes}, 已填格子数:`, 
                this.playerGrid.flat().filter(cell => cell !== 0).length);

            await window.sudokuGame.dataManager.saveCurrentGameState(gameState);
            console.log('✓ 游戏状态已保存成功');
            return true;
        } catch (error) {
            console.error('✗ 保存游戏状态失败:', error);
            return false;
        }
    }

    // 加载游戏状态
    // 加载特定关卡的状态
    async loadLevelState(level) {
        if (!window.sudokuGame || !window.sudokuGame.dataManager) {
            console.warn('无法加载游戏状态：DataManager不可用');
            return false;
        }

        try {
            console.log(`正在加载关卡${level}的保存状态...`);
            const savedState = await window.sudokuGame.dataManager.getLevelState(level);
            if (!savedState) {
                console.log(`✗ 关卡${level}没有保存的游戏状态`);
                return false;
            }

            console.log(`找到关卡${level}的保存状态 - 保存时间: ${new Date(savedState.savedAt).toLocaleString()}`);
            console.log(`保存状态详情:`, {
                level: savedState.level,
                mistakes: savedState.mistakes,
                hintsUsed: savedState.hintsUsed,
                filledCells: savedState.playerGrid ? savedState.playerGrid.flat().filter(cell => cell !== 0).length : 0,
                hasNotes: savedState.notes ? 'yes' : 'no',
                hasPuzzle: savedState.puzzle ? 'yes' : 'no'
            });

            // 恢复游戏状态
            this.currentLevel = savedState.level || level;
            this.playerGrid = savedState.playerGrid || Array(9).fill().map(() => Array(9).fill(0));
            this.notes = savedState.notes || Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
            this.mistakes = savedState.mistakes || 0;
            this.hintsUsed = savedState.hintsUsed || 0;
            this.currentTime = savedState.currentTime || 0;
            this.startTime = savedState.startTime || Date.now();
            this.selectedCell = savedState.selectedCell || {row: -1, col: -1};
            this.selectedNumber = savedState.selectedNumber || 0;
            this.isNoteMode = savedState.isNoteMode || false;
            this.currentPuzzle = savedState.puzzle;
            this.currentSolution = savedState.solution;

            // 验证加载的数据
            if (!this.currentPuzzle || !this.currentSolution) {
                console.warn('保存的数据缺少题目或解决方案，重新生成...');
                const levelData = this.generator.generatePuzzle(this.currentLevel);
                this.currentPuzzle = levelData.puzzle;
                this.currentSolution = levelData.solution;
            }

            // 重新开始计时器
            this.startTimer();

            console.log(`✓ 关卡${level}状态加载成功 - 已填 ${this.playerGrid.flat().filter(cell => cell !== 0).length} 个格子`);
            return true;
        } catch (error) {
            console.error(`✗ 加载关卡${level}状态失败:`, error);
            return false;
        }
    }

    // 向后兼容：加载当前游戏状态（现在加载最新的有进度关卡）
    async loadCurrentState() {
        if (!window.sudokuGame || !window.sudokuGame.dataManager) {
            console.warn('无法加载游戏状态：DataManager不可用');
            return false;
        }

        try {
            console.log('正在查找最新的有进度关卡...');
            const savedState = await window.sudokuGame.dataManager.getCurrentGameState();
            if (!savedState) {
                console.log('✗ 没有找到任何保存的游戏状态');
                return false;
            }

            // 使用找到的最新关卡状态
            return this.loadLevelState(savedState.level);
        } catch (error) {
            console.error('✗ 加载游戏状态失败:', error);
            return false;
        }
    }

    // 检查是否有保存的游戏状态
    async hasSavedState() {
        if (!window.sudokuGame || !window.sudokuGame.dataManager) {
            return false;
        }

        try {
            const savedState = await window.sudokuGame.dataManager.getCurrentGameState();
            return savedState && savedState.inProgress;
        } catch (error) {
            console.error('检查保存状态失败:', error);
            return false;
        }
    }
}

// 导出类
window.GameLogic = GameLogic;
