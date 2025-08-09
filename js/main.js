// 主程序入口
class SudokuGame {
    constructor() {
        this.gameLogic = null;
        this.uiManager = null;
        this.dataManager = null;
        this.isInitialized = false;
        this.version = '1.0.0';
        
        this.init();
    }

    // 初始化游戏
    async init() {
        try {
            // 显示加载屏幕
            this.showLoadingScreen();
            
            // 初始化数据管理器
            this.dataManager = new DataManager();
            await this.dataManager.initDB();
            
            // 初始化游戏逻辑
            this.gameLogic = new GameLogic();
            
            // 加载保存的数据
            await this.loadGameData();
            
            // 初始化UI管理器
            this.uiManager = new UIManager(this.gameLogic);
            
            // 检查成就
            this.checkAchievements();
            
            // 设置全局错误处理
            this.setupErrorHandling();
            
            // 设置性能监控
            this.setupPerformanceMonitoring();
            
            this.isInitialized = true;
            console.log('数独游戏初始化完成');
            
        } catch (error) {
            console.error('游戏初始化失败:', error);
            this.showErrorMessage('游戏初始化失败，请刷新页面重试');
        }
    }

    // 显示加载屏幕
    showLoadingScreen() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.add('active');
        }
    }

    // 加载游戏数据
    async loadGameData() {
        try {
            // 加载用户统计
            const userStats = await this.dataManager.getUserStats();
            if (userStats) {
                this.gameLogic.gameStats = {
                    ...this.gameLogic.gameStats,
                    ...userStats
                };
            }

            // 加载游戏设置
            const gameSettings = await this.dataManager.getGameSettings();
            if (gameSettings) {
                this.gameLogic.settings = {
                    ...this.gameLogic.settings,
                    ...gameSettings
                };
            }

            // 加载已完成的关卡
            const completedLevels = await this.dataManager.getAllCompletedLevels();
            if (completedLevels && completedLevels.length > 0) {
                const maxLevel = Math.max(...completedLevels.map(l => l.level));
                this.gameLogic.currentLevel = Math.min(maxLevel + 1, 100);
            }

            console.log('游戏数据加载完成');
            
        } catch (error) {
            console.error('加载游戏数据失败:', error);
            // 使用默认设置继续
        }
    }

    // 保存游戏数据
    async saveGameData() {
        if (!this.isInitialized) return;

        try {
            // 保存用户统计
            await this.dataManager.saveUserStats(this.gameLogic.gameStats);

            // 保存游戏设置
            if (this.uiManager) {
                await this.dataManager.saveGameSettings(this.uiManager.settings);
            }

            console.log('游戏数据保存完成');
            
        } catch (error) {
            console.error('保存游戏数据失败:', error);
        }
    }

    // 完成关卡时的数据处理
    async onLevelComplete(levelData) {
        try {
            // 保存关卡进度
            await this.dataManager.saveGameProgress(levelData.level, {
                completed: true,
                stars: levelData.stars,
                time: levelData.time,
                mistakes: levelData.mistakes,
                hintsUsed: levelData.hintsUsed,
                completedAt: new Date().toISOString()
            });

            // 记录游戏历史
            await this.dataManager.recordGameHistory({
                level: levelData.level,
                completed: true,
                time: levelData.time,
                mistakes: levelData.mistakes,
                hintsUsed: levelData.hintsUsed,
                stars: levelData.stars
            });

            // 保存用户统计
            await this.saveGameData();

            // 检查新解锁的成就
            await this.checkNewAchievements(levelData);

            console.log(`关卡 ${levelData.level} 完成数据已保存`);
            
        } catch (error) {
            console.error('保存关卡完成数据失败:', error);
        }
    }

    // 检查成就
    async checkAchievements() {
        try {
            const achievements = this.gameLogic.getAchievements();
            const unlockedAchievements = await this.dataManager.getAllAchievements();
            const unlockedIds = new Set(unlockedAchievements.map(a => a.id));

            // 检查新解锁的成就
            for (let achievement of achievements) {
                if (achievement.unlocked && !unlockedIds.has(achievement.id)) {
                    await this.dataManager.unlockAchievement(achievement.id, {
                        name: achievement.name,
                        description: achievement.description
                    });
                    
                    // 显示成就解锁通知
                    this.showAchievementUnlocked(achievement);
                }
            }
            
        } catch (error) {
            console.error('检查成就失败:', error);
        }
    }

    // 检查新解锁的成就
    async checkNewAchievements(levelData) {
        const stats = this.gameLogic.gameStats;
        const newAchievements = [];

        // 第一次胜利成就
        if (stats.gamesWon === 1) {
            newAchievements.push({
                id: 'first_win',
                name: '初战告捷',
                description: '完成第一个关卡'
            });
        }

        // 速度成就
        if (levelData.time <= 180000 && levelData.level <= 25) {
            newAchievements.push({
                id: 'speed_demon',
                name: '速度恶魔',
                description: '在3分钟内完成一个简单关卡'
            });
        }

        // 完美主义者成就
        if (stats.currentStreak >= 10 && stats.gamesWon >= 10) {
            newAchievements.push({
                id: 'perfectionist',
                name: '完美主义者',
                description: '无错误完成10个关卡'
            });
        }

        // 解锁新成就
        for (let achievement of newAchievements) {
            try {
                await this.dataManager.unlockAchievement(achievement.id, achievement);
                this.showAchievementUnlocked(achievement);
            } catch (error) {
                console.error('解锁成就失败:', error);
            }
        }
    }

    // 显示成就解锁通知
    showAchievementUnlocked(achievement) {
        // 创建成就通知元素
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-icon">🏆</div>
                <div class="achievement-text">
                    <h4>成就解锁!</h4>
                    <p><strong>${achievement.name}</strong></p>
                    <p>${achievement.description}</p>
                </div>
            </div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10001;
            min-width: 300px;
            animation: slideInRight 0.5s ease-out;
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .achievement-content {
                display: flex;
                align-items: center;
            }
            .achievement-icon {
                font-size: 2em;
                margin-right: 15px;
            }
            .achievement-text h4 {
                margin: 0 0 5px 0;
                color: #fff;
            }
            .achievement-text p {
                margin: 2px 0;
                font-size: 0.9em;
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // 播放成就音效
        if (this.uiManager) {
            this.uiManager.playSound('complete');
        }

        // 5秒后自动移除
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease-in reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }

    // 设置错误处理
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
            this.reportError(event.error, 'javascript');
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);
            this.reportError(event.reason, 'promise');
        });
    }

    // 错误报告
    reportError(error, type) {
        // 处理null或undefined错误
        if (!error) {
            console.warn('收到null或undefined错误');
            return;
        }

        const errorInfo = {
            message: error.message || error.toString() || '未知错误',
            stack: error.stack || '无堆栈信息',
            type: type || 'unknown',
            timestamp: new Date().toISOString(),
            version: this.version,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        console.error('错误报告:', errorInfo);

        // 在开发环境中显示错误信息
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
            this.showErrorMessage(`错误: ${errorInfo.message}`);
        }
    }

    // 显示错误信息
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f44336;
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 80%;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;

        document.body.appendChild(errorDiv);

        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // 性能监控
    setupPerformanceMonitoring() {
        // 监控页面加载性能
        window.addEventListener('load', () => {
            if ('performance' in window) {
                const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
                console.log(`页面加载时间: ${loadTime}ms`);

                // 记录性能数据
                this.recordPerformanceMetric('page_load_time', loadTime);
            }
        });

        // 监控内存使用
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                const memoryUsage = {
                    used: memory.usedJSHeapSize,
                    total: memory.totalJSHeapSize,
                    limit: memory.jsHeapSizeLimit
                };

                // 如果内存使用超过限制的80%，发出警告
                if (memoryUsage.used / memoryUsage.limit > 0.8) {
                    console.warn('内存使用率过高:', memoryUsage);
                }
            }, 30000); // 每30秒检查一次
        }
    }

    // 记录性能指标
    recordPerformanceMetric(name, value) {
        const metrics = JSON.parse(localStorage.getItem('performance_metrics') || '[]');
        metrics.push({
            name,
            value,
            timestamp: new Date().toISOString()
        });

        // 只保留最近100条记录
        if (metrics.length > 100) {
            metrics.splice(0, metrics.length - 100);
        }

        localStorage.setItem('performance_metrics', JSON.stringify(metrics));
    }

    // 获取游戏统计
    async getGameStatistics() {
        try {
            const [userStats, completedLevels, achievements, gameHistory] = await Promise.all([
                this.dataManager.getUserStats(),
                this.dataManager.getAllCompletedLevels(),
                this.dataManager.getAllAchievements(),
                this.dataManager.getGameHistory(100)
            ]);

            return {
                userStats,
                completedLevels: completedLevels.length,
                totalAchievements: achievements.length,
                recentGames: gameHistory.slice(0, 10),
                version: this.version,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('获取游戏统计失败:', error);
            return null;
        }
    }

    // 导出游戏数据
    async exportGameData() {
        try {
            const data = await this.dataManager.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `sudoku_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('游戏数据导出完成');
            return true;
        } catch (error) {
            console.error('导出游戏数据失败:', error);
            return false;
        }
    }

    // 导入游戏数据
    async importGameData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            await this.dataManager.importData(data);
            
            // 重新加载游戏数据
            await this.loadGameData();
            
            // 刷新UI
            if (this.uiManager) {
                this.uiManager.updateMenuStats();
            }

            console.log('游戏数据导入完成');
            return true;
        } catch (error) {
            console.error('导入游戏数据失败:', error);
            return false;
        }
    }

    // 清理和销毁
    destroy() {
        // 保存数据
        this.saveGameData();

        // 清理定时器
        if (this.gameLogic) {
            this.gameLogic.stopTimer();
        }

        // 清理事件监听器
        // (实际应用中应该保存所有添加的监听器引用并在此处移除)

        console.log('游戏已销毁');
    }
}

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    window.sudokuGame = new SudokuGame();
});

// 页面卸载前保存数据
window.addEventListener('beforeunload', () => {
    if (window.sudokuGame) {
        window.sudokuGame.saveGameData();
    }
});

// PWA 支持 - 只在HTTPS或localhost环境下注册
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// 全局函数，供其他脚本调用
window.SudokuGameAPI = {
    getGame: () => window.sudokuGame,
    getStatistics: () => window.sudokuGame?.getGameStatistics(),
    exportData: () => window.sudokuGame?.exportGameData(),
    importData: (file) => window.sudokuGame?.importGameData(file),
    getVersion: () => window.sudokuGame?.version || '1.0.0'
};
