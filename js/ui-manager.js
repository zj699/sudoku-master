class UIManager {
    constructor(gameLogic) {
        this.game = gameLogic;
        this.currentScreen = 'loading';
        this.sounds = {
            click: null,
            success: null,
            error: null,
            complete: null
        };
        this.settings = {
            soundEnabled: true,
            autoCheckErrors: true,
            highlightNumbers: true,
            theme: 'light'
        };
        this.audioContext = null;
        this.pendingAudioInit = false;
        
        this.initializeUI();
        this.loadSettings();
    }

    // 初始化UI
    initializeUI() {
        console.log('初始化UI开始');
        this.bindEvents();
        this.showScreen('loading');
        
        // 模拟加载时间
        setTimeout(() => {
            console.log('加载完成，切换到菜单');
            this.showScreen('menu');
            this.updateMenuStats().catch(err => {
                console.error('更新菜单统计失败:', err);
            });
        }, 1000); // 减少加载时间到1秒
        
        // 立即确保菜单是默认状态（防止其他代码干扰）
        setTimeout(() => {
            if (this.currentScreen !== 'menu') {
                console.log('强制切换到菜单, 当前屏幕:', this.currentScreen);
                this.showScreen('menu');
                this.updateMenuStats().catch(err => {
                    console.error('更新菜单统计失败:', err);
                });
            }
        }, 1500);
    }

    // 绑定事件
    bindEvents() {
        // 主菜单按钮
        document.getElementById('continueBtn')?.addEventListener('click', async () => {
            try {
                // 首先尝试加载保存的游戏状态
                const hasSavedState = await this.game.hasSavedState();
                if (hasSavedState) {
                    console.log('发现保存的游戏状态，继续游戏');
                    const loaded = await this.game.loadCurrentState();
                    if (loaded) {
                        this.showScreen('game');
                        this.updateGameDisplay();
                        return;
                    }
                }
                
                // 如果没有保存状态，则开始下一个未完成的关卡
                const progress = this.game.loadProgress();
                const level = progress ? progress.currentLevel : 1;
                console.log('没有保存状态，开始关卡', level);
                this.startLevel(level);
            } catch (error) {
                console.error('继续游戏失败:', error);
                // 出错时不要自动开始关卡，让用户手动选择
                alert('继续游戏失败，请手动选择关卡。\n错误：' + error.message);
            }
        });

        document.getElementById('levelSelectBtn')?.addEventListener('click', () => {
            this.showLevelSelect();
        });

        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('achievementsBtn')?.addEventListener('click', () => {
            this.showAchievements();
        });

        // 返回按钮 - 使用事件委托确保动态添加的按钮也能工作
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'backToMenu') {
                e.preventDefault();
                e.stopPropagation();
                console.log('返回菜单按钮点击, 当前屏幕:', this.currentScreen);
                this.showScreen('menu');
                this.updateMenuStats().catch(err => {
                    console.error('更新菜单统计失败:', err);
                });
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'backToMenuFromSettings') {
                e.preventDefault();
                e.stopPropagation();
                console.log('设置返回菜单按钮点击, 当前屏幕:', this.currentScreen);
                this.showScreen('menu');
            }
        });

        document.getElementById('backToLevels')?.addEventListener('click', () => {
            this.game.pauseGame();
            this.showLevelSelect();
        });

        // 游戏控制按钮
        document.getElementById('pauseBtn')?.addEventListener('click', () => {
            this.showPause();
        });

        document.getElementById('resumeBtn')?.addEventListener('click', () => {
            this.resumeGame();
        });

        document.getElementById('restartBtn')?.addEventListener('click', () => {
            this.restartLevel();
        });

        document.getElementById('quitBtn')?.addEventListener('click', () => {
            this.showLevelSelect();
        });

        document.getElementById('hintBtn')?.addEventListener('click', () => {
            this.useHint();
        });

        document.getElementById('noteBtn')?.addEventListener('click', () => {
            this.toggleNoteMode();
        });

        document.getElementById('eraseBtn')?.addEventListener('click', () => {
            this.eraseSelectedCell();
        });

        // 完成关卡按钮
        document.getElementById('nextLevelBtn')?.addEventListener('click', () => {
            this.nextLevel();
        });

        document.getElementById('retryLevelBtn')?.addEventListener('click', () => {
            this.restartLevel();
        });

        document.getElementById('backToMenuBtn')?.addEventListener('click', () => {
            this.showScreen('menu');
            this.updateMenuStats().catch(err => {
                console.error('更新菜单统计失败:', err);
            });
        });

        // 数字按钮
        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.num);
                this.selectNumber(num);
            });
        });

        // 难度标签切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchDifficultyTab(btn.dataset.difficulty);
            });
        });

        // 设置变更
        document.getElementById('soundToggle')?.addEventListener('change', (e) => {
            this.settings.soundEnabled = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('errorCheckToggle')?.addEventListener('change', (e) => {
            this.settings.autoCheckErrors = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('highlightToggle')?.addEventListener('change', (e) => {
            this.settings.highlightNumbers = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('themeSelect')?.addEventListener('change', (e) => {
            this.settings.theme = e.target.value;
            this.applyTheme(e.target.value);
            this.saveSettings();
        });

        document.getElementById('resetProgressBtn')?.addEventListener('click', async () => {
            // 第一次确认
            const firstConfirm = confirm(`⚠️ 确定要重置所有进度吗？

这将清除：
• 所有关卡的完成记录
• 游戏统计数据  
• 用户设置
• 成就记录
• 游戏历史

此操作不可撤销！`);
            
            if (!firstConfirm) {
                return;
            }
            
            // 第二次确认（更严格）
            const secondConfirm = confirm(`🔥 最后确认！

您即将删除所有游戏数据！

如果您真的要继续，请点击"确定"。
如果您不确定，请点击"取消"。

这是您的最后机会！`);
            
            if (secondConfirm) {
                try {
                    // 显示处理中的提示
                    this.showNotification('正在重置进度，请稍等...', 'info');
                    await this.resetProgress();
                } catch (error) {
                    console.error('重置进度失败:', error);
                    this.showNotification('重置失败: ' + error.message, 'error');
                }
            } else {
                this.showNotification('重置操作已取消', 'info');
            }
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });

        // 触摸事件优化
        this.addTouchOptimization();
    }

    // 添加触摸优化
    addTouchOptimization() {
        // 防止双击缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = new Date().getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // 更精确的触摸滚动控制
        document.addEventListener('touchmove', (e) => {
            if (this.currentScreen === 'game') {
                // 只阻止数独网格和数字键盘的滚动，允许游戏内容区域滚动
                const target = e.target.closest('#sudokuGrid, .number-pad');
                const gameContent = e.target.closest('.game-content');
                
                if (target && !gameContent) {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        // 确保游戏内容区域可以滚动
        const gameContentElements = document.querySelectorAll('.game-content');
        gameContentElements.forEach(element => {
            element.addEventListener('touchmove', (e) => {
                e.stopPropagation();
            }, { passive: true });
        });
    }

    // 键盘处理
    handleKeyboard(e) {
        if (this.currentScreen !== 'game') return;

        const key = e.key;
        
        // 数字键
        if (key >= '1' && key <= '9') {
            e.preventDefault();
            this.selectNumber(parseInt(key));
            return;
        }

        // 方向键
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            e.preventDefault();
            this.moveSelection(key);
            return;
        }

        // 其他快捷键
        switch (key) {
            case 'Enter':
                e.preventDefault();
                this.placeNumber();
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                this.eraseSelectedCell();
                break;
            case 'n':
            case 'N':
                e.preventDefault();
                this.toggleNoteMode();
                break;
            case 'h':
            case 'H':
                e.preventDefault();
                this.useHint();
                break;
            case ' ':
            case 'Escape':
                e.preventDefault();
                this.showPause();
                break;
        }
    }

    // 移动选择
    moveSelection(direction) {
        const {row, col} = this.game.selectedCell;
        let newRow = row, newCol = col;

        switch (direction) {
            case 'ArrowUp':
                newRow = Math.max(0, row - 1);
                break;
            case 'ArrowDown':
                newRow = Math.min(8, row + 1);
                break;
            case 'ArrowLeft':
                newCol = Math.max(0, col - 1);
                break;
            case 'ArrowRight':
                newCol = Math.min(8, col + 1);
                break;
        }

        if (newRow !== row || newCol !== col) {
            this.selectCell(newRow, newCol);
        }
    }

    // 显示屏幕
    showScreen(screenName) {
        console.log(`切换屏幕: ${this.currentScreen} -> ${screenName}`);
        
        // 隐藏所有屏幕
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // 显示目标屏幕
        const targetScreen = document.getElementById(screenName);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenName;
            console.log(`屏幕切换成功: ${screenName}`);
            
            // 调试：检查active的screen
            setTimeout(() => {
                const activeScreens = document.querySelectorAll('.screen.active');
                console.log(`当前active的屏幕数量: ${activeScreens.length}`);
                activeScreens.forEach(screen => {
                    console.log(`Active屏幕: ${screen.id}, display: ${getComputedStyle(screen).display}`);
                });
            }, 100);
        } else {
            console.error(`找不到目标屏幕: ${screenName}`);
        }

        this.playSound('click');
    }

    // 更新菜单统计
    async updateMenuStats() {
        const stats = await this.game.getStatistics();
        const progress = this.game.loadProgress();
        
        // 更新进度条
        const progressFill = document.getElementById('overallProgress');
        const progressText = document.getElementById('progressText');
        
        if (progressFill && progressText) {
            const percentage = (stats.completedLevels / 100) * 100;
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${stats.completedLevels}/100`;
        }

        // 更新统计数据
        const totalTimeEl = document.getElementById('totalTime');
        const bestTimeEl = document.getElementById('bestTime');
        
        if (totalTimeEl) totalTimeEl.textContent = stats.totalTime;
        if (bestTimeEl) bestTimeEl.textContent = stats.bestTime;

        // 检查并更新继续游戏按钮状态
        try {
            const continueBtn = document.getElementById('continueBtn');
            if (continueBtn) {
                const hasSavedState = await this.game.hasSavedState();
                if (hasSavedState) {
                    continueBtn.innerHTML = '继续游戏 <small style="color: #4CAF50;">●</small>';
                    continueBtn.title = '有未完成的游戏可以继续';
                } else {
                    continueBtn.innerHTML = '继续游戏';
                    continueBtn.title = '开始新关卡';
                }
            }
        } catch (error) {
            console.error('更新继续按钮状态失败:', error);
        }
    }

    // 显示关卡选择
    showLevelSelect() {
        this.showScreen('levelSelect');
        this.generateLevelGrid().catch(err => {
            console.error('生成关卡网格失败:', err);
        });
    }

    // 生成关卡网格
    async generateLevelGrid() {
        const grid = document.getElementById('levelsGrid');
        if (!grid) return;

        const completedLevels = await this.game.getCompletedLevels();
        const currentLevel = this.game.currentLevel;

        grid.innerHTML = '';

        // 根据当前选择的难度标签显示关卡
        const activeTab = document.querySelector('.tab-btn.active');
        const difficulty = activeTab ? activeTab.dataset.difficulty : 'easy';
        
        const levelRanges = {
            easy: [1, 25],
            medium: [26, 50],
            hard: [51, 75],
            expert: [76, 100]
        };

        const [start, end] = levelRanges[difficulty];

        for (let level = start; level <= end; level++) {
            const levelBtn = document.createElement('button');
            levelBtn.className = 'level-btn';
            levelBtn.textContent = level;

            // 设置状态 - 所有关卡解锁
            if (completedLevels.includes(level)) {
                levelBtn.classList.add('completed');
                // 添加星星显示
                const stars = this.getLevelStars(level);
                const starsEl = document.createElement('div');
                starsEl.className = 'stars';
                starsEl.innerHTML = '★'.repeat(stars) + '☆'.repeat(3 - stars);
                levelBtn.appendChild(starsEl);
            } else if (level === currentLevel) {
                levelBtn.classList.add('current');
            } else {
                // 移除锁定状态，所有关卡都可选择
                levelBtn.classList.add('available');
            }

            levelBtn.addEventListener('click', () => {
                // 所有关卡都可点击，移除disabled检查
                this.startLevel(level);
            });

            grid.appendChild(levelBtn);
        }
    }

    // 获取关卡星数
    getLevelStars(level) {
        // 🔥 修复：基于关卡号生成固定星数，不使用随机
        // 应该从保存的数据中获取实际星数，这里用固定算法代替随机
        return ((level * 7) % 3) + 1; // 基于关卡号的固定算法，结果为1-3
    }

    // 切换难度标签
    switchDifficultyTab(difficulty) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`[data-difficulty="${difficulty}"]`).classList.add('active');
        this.generateLevelGrid().catch(err => {
            console.error('生成关卡网格失败:', err);
        });
    }

    // 开始关卡
    async startLevel(level) {
        this.showScreen('game');
        
        // 🔥 关键修复：检查特定关卡的保存状态
        try {
            const savedState = await window.sudokuGame?.dataManager?.getLevelState(level);
            
            // 如果该关卡有保存状态，询问用户是否继续还是重新开始
            if (savedState && savedState.inProgress) {
                const filledCells = savedState.playerGrid ? savedState.playerGrid.flat().filter(n => n !== 0).length : 0;
                const shouldContinue = confirm(
                    `检测到第${level}关有未完成的游戏状态\n` +
                    `已填入 ${filledCells} 个格子\n` +
                    `保存时间: ${new Date(savedState.savedAt).toLocaleString()}\n\n` +
                    `点击"确定"继续之前的游戏\n` +
                    `点击"取消"重新开始该关卡`
                );
                
                if (shouldContinue) {
                    console.log(`用户选择继续关卡${level}的保存状态`);
                    const loaded = await this.game.loadLevelState(level);
                    if (loaded) {
                        this.updateGameDisplay();
                        console.log(`✓ 关卡${level}状态加载成功，跳过初始化`);
                        return;
                    }
                } else {
                    console.log(`用户选择重新开始关卡${level}`);
                    // 清除该关卡的保存状态
                    await window.sudokuGame.dataManager.clearLevelState(level);
                }
            }
        } catch (error) {
            console.warn('检查保存状态时出错，继续正常初始化:', error);
        }
        
        // 正常初始化关卡
        console.log(`正常初始化关卡${level}...`);
        const levelData = this.game.initializeLevel(level);
        
        // 更新游戏头部信息
        document.getElementById('currentLevel').textContent = `第${level}关`;
        document.getElementById('difficultyType').textContent = levelData.type;
        
        // 生成数独网格
        this.generateSudokuGrid();
        
        // 重置UI状态
        this.resetGameUI();

        // 保存初始游戏状态
        setTimeout(() => {
            this.game.saveCurrentState().catch(err => {
                console.error('保存游戏状态失败:', err);
            });
        }, 1000);
    }

    // 更新游戏显示（用于加载保存的状态后）
    updateGameDisplay() {
        console.log('开始更新游戏显示...');
        
        // 更新游戏头部信息
        document.getElementById('currentLevel').textContent = `第${this.game.currentLevel}关`;
        document.getElementById('mistakeCount').textContent = `错误: ${this.game.mistakes}/${this.game.maxMistakes}`;
        
        // 获取数独类型（从保存状态中恢复或重新生成）
        let difficultyType = '标准9x9';
        if (this.game.currentSolution) {
            const generator = this.game.generator || new SudokuGenerator();
            difficultyType = generator.getSudokuType(this.game.currentLevel);
        }
        document.getElementById('difficultyType').textContent = difficultyType;
        
        // 重新生成网格以确保DOM元素存在
        console.log('重新生成网格DOM...');
        this.generateSudokuGrid();
        
        // 等待DOM更新后再更新内容
        setTimeout(() => {
            console.log('更新网格内容...');
            this.updateGrid();
            this.updateHighlights();
            
            // 更新选中状态
            if (this.game.selectedCell.row >= 0 && this.game.selectedCell.col >= 0) {
                this.selectCell(this.game.selectedCell.row, this.game.selectedCell.col);
            }
            
            // 更新笔记模式状态
            const noteBtn = document.getElementById('noteBtn');
            if (noteBtn) {
                if (this.game.isNoteMode) {
                    noteBtn.classList.add('active');
                } else {
                    noteBtn.classList.remove('active');
                }
            }
            
            // 更新提示按钮
            this.updateHintButton();
            
            console.log('✓ 游戏显示更新完成');
        }, 100);
    }

    // 生成数独网格
    generateSudokuGrid() {
        const grid = document.getElementById('sudokuGrid');
        if (!grid) return;

        grid.innerHTML = '';

        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('button');
                cell.className = 'sudoku-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                const value = this.game.playerGrid[row][col];
                if (value > 0) {
                    cell.textContent = value;
                    if (this.game.currentPuzzle[row][col] > 0) {
                        cell.classList.add('given');
                    }
                }

                // 添加笔记容器
                const notesContainer = document.createElement('div');
                notesContainer.className = 'notes';
                cell.appendChild(notesContainer);

                cell.addEventListener('click', () => {
                    this.selectCell(row, col);
                });

                grid.appendChild(cell);
            }
        }
    }

    // 重置游戏UI状态
    resetGameUI() {
        this.game.selectedCell = {row: -1, col: -1};
        this.game.selectedNumber = 0;
        this.game.isNoteMode = false;
        
        document.getElementById('mistakeCount').textContent = `错误: 0/3`;
        
        const noteBtn = document.getElementById('noteBtn');
        if (noteBtn) {
            noteBtn.classList.remove('active');
        }
        
        this.updateNumberPad();
        this.updateGrid();
    }

    // 选择格子
    selectCell(row, col) {
        const success = this.game.selectCell(row, col);
        
        if (success) {
            this.updateCellSelection();
            this.updateHighlights();
            
            // 如果既有选择的格子又有选择的数字，提示用户可以放置
            if (this.game.selectedNumber > 0) {
                this.showPlacementHint();
            }
        }
        
        this.playSound('click');
    }

    // 选择数字
    selectNumber(number) {
        // 如果点击的是已选中的数字，执行放置操作
        if (this.game.selectedNumber === number && this.game.selectedCell.row >= 0) {
            this.placeNumber();
            return;
        }
        
        this.game.selectNumber(number);
        this.updateNumberPad();
        this.updateHighlights();
        
        // 如果有选择的格子，提示用户可以放置
        if (this.game.selectedCell.row >= 0) {
            this.showPlacementHint();
        }
        
        this.playSound('click');
    }

    // 显示放置提示
    showPlacementHint() {
        // 在选中的格子上显示预览数字
        const {row, col} = this.game.selectedCell;
        const number = this.game.selectedNumber;
        
        if (row >= 0 && col >= 0 && number > 0) {
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell && this.game.currentPuzzle[row][col] === 0) {
                // 检查是否违反规则
                const validation = this.game.isValidPlacement(row, col, number);
                if (validation.valid) {
                    cell.classList.add('preview-valid');
                    cell.setAttribute('data-preview', number);
                } else {
                    cell.classList.add('preview-invalid');
                    cell.setAttribute('data-preview', number);
                    // 高亮冲突的格子
                    this.highlightConflictCell(validation.conflictCell);
                }
            }
        }
    }

    // 清除放置预览
    clearPlacementPreview() {
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            cell.classList.remove('preview-valid', 'preview-invalid');
            cell.removeAttribute('data-preview');
        });
        
        document.querySelectorAll('.conflict-highlight').forEach(cell => {
            cell.classList.remove('conflict-highlight');
        });
    }

    // 高亮冲突格子
    highlightConflictCell(conflictCell) {
        if (conflictCell) {
            const cell = document.querySelector(`[data-row="${conflictCell.row}"][data-col="${conflictCell.col}"]`);
            if (cell) {
                cell.classList.add('conflict-highlight');
            }
        }
    }

    // 放置数字
    placeNumber() {
        const {row, col} = this.game.selectedCell;
        const number = this.game.selectedNumber;
        
        if (row < 0 || col < 0 || number === 0) return;

        // 清除预览效果
        this.clearPlacementPreview();

        const result = this.game.placeNumber(row, col, number);
        
        if (result.success) {
            if (result.complete) {
                this.showLevelComplete(this.game.completeGame());
                this.playSound('complete');
            } else {
                // 根据是否是正确答案给出不同反馈
                if (result.correctAnswer) {
                    this.playSound('success');
                } else {
                    this.playSound('click'); // 中性音效，表示放置成功但不一定是正确答案
                }
                
                // 延迟保存游戏状态，避免频繁操作
                setTimeout(() => {
                    this.game.saveCurrentState().catch(err => {
                        console.error('保存游戏状态失败:', err);
                    });
                }, 500);
            }
            
            // 清除选择状态，允许用户继续操作
            this.game.selectedNumber = 0;
            this.updateNumberPad();
        } else if (result.reason === 'rule_violation') {
            // 显示规则违反提示
            this.showRuleViolation(result);
            this.playSound('error');
        } else if (result.reason === 'given') {
            this.showNotification('不能修改题目给定的数字', 'error');
            this.playSound('error');
        }
        
        this.updateGrid();
        this.updateHighlights();
    }

    // 显示规则违反提示
    showRuleViolation(result) {
        // 显示错误消息
        this.showNotification(result.message, 'error');
        
        // 高亮冲突的格子
        if (result.conflictCell) {
            const conflictCell = document.querySelector(`[data-row="${result.conflictCell.row}"][data-col="${result.conflictCell.col}"]`);
            if (conflictCell) {
                conflictCell.classList.add('conflict-highlight');
                setTimeout(() => {
                    conflictCell.classList.remove('conflict-highlight');
                }, 2000);
            }
        }
    }

    // 切换笔记模式
    toggleNoteMode() {
        const isNoteMode = this.game.toggleNoteMode();
        const noteBtn = document.getElementById('noteBtn');
        
        if (noteBtn) {
            if (isNoteMode) {
                noteBtn.classList.add('active');
            } else {
                noteBtn.classList.remove('active');
            }
        }
        
        this.playSound('click');
    }

    // 擦除选中格子
    eraseSelectedCell() {
        const {row, col} = this.game.selectedCell;
        if (row < 0 || col < 0) return;

        const result = this.game.eraseCell(row, col);
        if (result.success) {
            this.updateGrid();
            this.updateHighlights();
            this.playSound('click');
            
            // 延迟保存游戏状态
            setTimeout(() => {
                this.game.saveCurrentState().catch(err => {
                    console.error('保存游戏状态失败:', err);
                });
            }, 300);
        }
    }

    // 使用提示
    useHint() {
        const result = this.game.getHint();
        
        if (result.success) {
            this.updateGrid();
            this.updateHintButton();
            
            if (result.complete) {
                this.showLevelComplete(this.game.completeGame());
                this.playSound('complete');
            } else {
                this.showHintUsed(result.hint);
                this.playSound('success');
                
                // 延迟保存游戏状态
                setTimeout(() => {
                    this.game.saveCurrentState().catch(err => {
                        console.error('保存游戏状态失败:', err);
                    });
                }, 500);
            }
        } else {
            this.showHintError(result.reason);
            this.playSound('error');
        }
    }

    // 更新网格显示
    updateGrid() {
        const cells = document.querySelectorAll('.sudoku-cell');
        
        cells.forEach(cell => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            // 检查游戏状态是否有效
            if (!this.game.playerGrid || !this.game.notes) {
                return;
            }
            
            const value = this.game.playerGrid[row][col];
            const notes = this.game.notes[row][col];
            
            // 清除之前的状态
            cell.classList.remove('error', 'hint');
            
            // 确保笔记容器存在
            let notesContainer = cell.querySelector('.notes');
            if (!notesContainer) {
                notesContainer = document.createElement('div');
                notesContainer.className = 'notes';
                cell.appendChild(notesContainer);
            }
            
            if (value > 0) {
                // 显示数字，清空笔记
                cell.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.remove();
                    }
                });
                cell.insertBefore(document.createTextNode(value), notesContainer);
                notesContainer.innerHTML = '';
            } else if (notes && notes.size > 0) {
                // 清除数字文本，显示笔记
                cell.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.remove();
                    }
                });
                
                notesContainer.innerHTML = '';
                for (let i = 1; i <= 9; i++) {
                    const noteSpan = document.createElement('span');
                    noteSpan.textContent = notes.has(i) ? i : '';
                    notesContainer.appendChild(noteSpan);
                }
            } else {
                // 清空所有内容
                cell.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.remove();
                    }
                });
                notesContainer.innerHTML = '';
            }
        });
        
        // 检查错误
        if (this.settings.autoCheckErrors && this.game.validateCurrentState) {
            try {
                const errors = this.game.validateCurrentState();
                errors.forEach(({row, col}) => {
                    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (cell) {
                        cell.classList.add('error');
                    }
                });
            } catch (error) {
                console.error('验证当前状态失败:', error);
            }
        }
    }

    // 更新格子选择状态
    updateCellSelection() {
        // 清除所有选择状态和预览
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            cell.classList.remove('selected');
        });
        this.clearPlacementPreview();
        
        const {row, col} = this.game.selectedCell;
        if (row >= 0 && col >= 0) {
            const selectedCell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (selectedCell) {
                selectedCell.classList.add('selected');
                
                // 如果有选中的数字，显示预览
                if (this.game.selectedNumber > 0) {
                    this.showPlacementHint();
                }
            }
        }
    }

    // 更新高亮显示
    updateHighlights() {
        if (!this.settings.highlightNumbers) return;
        
        document.querySelectorAll('.sudoku-cell').forEach(cell => {
            cell.classList.remove('highlighted');
        });
        
        // 检查游戏状态和选中状态
        if (!this.game || !this.game.selectedCell) {
            return;
        }
        
        const {row, col} = this.game.selectedCell;
        
        // 确保有效的选中位置
        if (row < 0 || col < 0) {
            return;
        }
        
        try {
            const relatedCells = this.game.getRelatedCells(row, col);
            
            relatedCells.forEach(({row: r, col: c}) => {
                const cell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('highlighted');
                }
            });
        } catch (error) {
            console.error('更新高亮显示失败:', error);
        }
    }

    // 更新数字键盘
    updateNumberPad() {
        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        if (this.game.selectedNumber > 0) {
            const selectedBtn = document.querySelector(`[data-num="${this.game.selectedNumber}"]`);
            if (selectedBtn) {
                selectedBtn.classList.add('selected');
            }
        }
    }

    // 更新错误计数
    updateMistakeCount() {
        const mistakeEl = document.getElementById('mistakeCount');
        if (mistakeEl) {
            mistakeEl.textContent = `错误: ${this.game.mistakes}/${this.game.maxMistakes}`;
        }
    }

    // 更新提示按钮
    updateHintButton() {
        const hintBtn = document.getElementById('hintBtn');
        if (hintBtn) {
            const remaining = this.game.maxHints - this.game.hintsUsed;
            hintBtn.textContent = `提示 (${remaining})`;
            
            if (remaining === 0) {
                hintBtn.disabled = true;
                hintBtn.classList.add('disabled');
            }
        }
    }

    // 显示错误动画
    showMistake(row, col) {
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.add('error');
            setTimeout(() => {
                cell.classList.remove('error');
            }, 1000);
        }
    }

    // 显示提示使用
    showHintUsed(hint) {
        const cell = document.querySelector(`[data-row="${hint.row}"][data-col="${hint.col}"]`);
        if (cell) {
            cell.classList.add('hint');
            setTimeout(() => {
                cell.classList.remove('hint');
            }, 2000);
        }
    }

    // 显示提示错误
    showHintError(reason) {
        let message;
        switch (reason) {
            case 'no_hints':
                message = '提示次数已用完';
                break;
            case 'no_empty_cells':
                message = '没有空格需要提示';
                break;
            default:
                message = '无法提供提示';
        }
        
        this.showNotification(message, 'error');
    }

    // 显示通知
    showNotification(message, type = 'info') {
        // 简单的通知实现
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#f44336' : '#4caf50'};
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // 显示暂停界面
    showPause() {
        this.game.pauseGame();
        this.showScreen('pause');
    }

    // 恢复游戏
    resumeGame() {
        this.game.pauseGame();
        this.showScreen('game');
    }

    // 重启关卡
    restartLevel() {
        this.game.resetGame();
        this.resetGameUI();
        this.showScreen('game');
    }

    // 下一关
    nextLevel() {
        if (this.game.currentLevel < 100) {
            this.startLevel(this.game.currentLevel + 1);
        } else {
            this.showAllLevelsComplete();
        }
    }

    // 显示关卡完成
    showLevelComplete(result) {
        document.getElementById('completionTime').textContent = this.game.getFormattedTime();
        document.getElementById('completionMistakes').textContent = result.mistakes;
        
        // 显示星星
        const starsEl = document.getElementById('starsEarned');
        if (starsEl) {
            starsEl.innerHTML = '';
            for (let i = 1; i <= 3; i++) {
                const star = document.createElement('span');
                star.className = 'star';
                star.textContent = '★';
                if (i > result.stars) {
                    star.classList.add('inactive');
                }
                starsEl.appendChild(star);
            }
        }
        
        // 禁用下一关按钮如果是最后一关
        const nextBtn = document.getElementById('nextLevelBtn');
        if (nextBtn) {
            if (this.game.currentLevel >= 100) {
                nextBtn.textContent = '完成所有关卡!';
                nextBtn.onclick = () => this.showAllLevelsComplete();
            }
        }
        
        this.showScreen('levelComplete');
    }

    // 显示游戏失败
    showGameOver() {
        this.showNotification('错误次数过多，游戏结束！', 'error');
        setTimeout(() => {
            this.showLevelSelect();
        }, 2000);
    }

    // 显示所有关卡完成
    showAllLevelsComplete() {
        this.showNotification('恭喜完成所有100关！您是真正的数独大师！', 'success');
        setTimeout(() => {
            this.showScreen('menu');
            this.updateMenuStats().catch(err => {
                console.error('更新菜单统计失败:', err);
            });
        }, 3000);
    }

    // 显示设置
    showSettings() {
        this.showScreen('settings');
        this.updateSettingsUI();
    }

    // 更新设置UI
    updateSettingsUI() {
        document.getElementById('soundToggle').checked = this.settings.soundEnabled;
        document.getElementById('errorCheckToggle').checked = this.settings.autoCheckErrors;
        document.getElementById('highlightToggle').checked = this.settings.highlightNumbers;
        document.getElementById('themeSelect').value = this.settings.theme;
    }

    // 显示成就
    showAchievements() {
        // 简化实现，显示通知
        const achievements = this.game.getAchievements();
        const unlockedCount = achievements.filter(a => a.unlocked).length;
        this.showNotification(`已解锁 ${unlockedCount}/${achievements.length} 项成就`, 'info');
    }

    // 应用主题
    applyTheme(theme) {
        document.body.className = theme;
    }

    // 播放声音
    playSound(type) {
        if (!this.settings.soundEnabled) return;
        
        // 简化的声音实现
        const frequencies = {
            click: 800,
            success: 1000,
            error: 400,
            complete: 1200
        };
        
        // 只在用户有过交互后才创建音频上下文
        if (this.audioContext) {
            this.createSound(frequencies[type] || 800);
        } else if ('AudioContext' in window || 'webkitAudioContext' in window) {
            // 延迟创建音频上下文，等待用户交互
            if (!this.pendingAudioInit) {
                this.pendingAudioInit = true;
                document.addEventListener('click', () => {
                    this.initAudioContext();
                    this.createSound(frequencies[type] || 800);
                }, { once: true });
            }
        }
    }

    // 初始化音频上下文
    initAudioContext() {
        if (!this.audioContext && ('AudioContext' in window || 'webkitAudioContext' in window)) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('音频上下文已初始化');
            } catch (error) {
                console.error('音频上下文初始化失败:', error);
            }
        }
    }

    // 创建声音
    createSound(frequency) {
        if (!this.audioContext) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        } catch (error) {
            console.error('播放声音失败:', error);
        }
    }

    // 保存设置
    saveSettings() {
        localStorage.setItem('sudoku_settings', JSON.stringify(this.settings));
    }

    // 加载设置
    loadSettings() {
        const saved = localStorage.getItem('sudoku_settings');
        if (saved) {
            try {
                this.settings = {...this.settings, ...JSON.parse(saved)};
                this.applyTheme(this.settings.theme);
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
    }

    // 重置进度
    async resetProgress() {
        try {
            // 清除localStorage
            localStorage.removeItem('sudoku_progress');
            
            // 清除IndexedDB中的所有数据
            if (window.sudokuGame && window.sudokuGame.dataManager) {
                const result = await window.sudokuGame.dataManager.clearAllData();
                console.log('IndexedDB数据清除结果:', result);
            }
            
            // 重置游戏状态
            this.game.currentLevel = 1;
            this.game.gameStats = {
                totalTime: 0,
                gamesPlayed: 0,
                gamesWon: 0,
                bestTime: Infinity,
                currentStreak: 0,
                maxStreak: 0
            };
            
            // 重置UI设置为默认值
            this.settings = {
                soundEnabled: true,
                autoCheckErrors: true,
                highlightNumbers: true,
                theme: 'light'
            };
            
            // 保存默认设置
            this.saveSettings();
            
            // 应用默认主题
            this.applyTheme('light');
            
            // 更新设置界面显示
            this.updateSettingsUI();
            
            // 清除当前游戏状态（如果正在游戏中）
            if (this.currentScreen === 'game') {
                this.showScreen('menu');
            }
            
            // 更新UI显示
            await this.updateMenuStats();
            
            this.showNotification('✓ 所有进度已成功重置', 'success');
            
        } catch (error) {
            console.error('重置进度失败:', error);
            this.showNotification('⚠ 重置进度时出现错误: ' + error.message, 'error');
        }
    }
}

// 导出类
window.UIManager = UIManager;
