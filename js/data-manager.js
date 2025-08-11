class DataManager {
    constructor() {
        this.dbName = 'SudokuGameDB';
        this.dbVersion = 1;
        this.db = null;
        this.initDB();
    }

    // 初始化IndexedDB数据库
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('数据库初始化失败');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('数据库初始化成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建游戏进度存储
                if (!db.objectStoreNames.contains('gameProgress')) {
                    const progressStore = db.createObjectStore('gameProgress', { keyPath: 'id' });
                    progressStore.createIndex('level', 'level', { unique: false });
                    progressStore.createIndex('completedAt', 'completedAt', { unique: false });
                }

                // 创建用户统计存储
                if (!db.objectStoreNames.contains('userStats')) {
                    db.createObjectStore('userStats', { keyPath: 'id' });
                }

                // 创建游戏设置存储
                if (!db.objectStoreNames.contains('gameSettings')) {
                    db.createObjectStore('gameSettings', { keyPath: 'id' });
                }

                // 创建成就存储
                if (!db.objectStoreNames.contains('achievements')) {
                    const achievementStore = db.createObjectStore('achievements', { keyPath: 'id' });
                    achievementStore.createIndex('unlockedAt', 'unlockedAt', { unique: false });
                }

                // 创建游戏历史存储
                if (!db.objectStoreNames.contains('gameHistory')) {
                    const historyStore = db.createObjectStore('gameHistory', { keyPath: 'id', autoIncrement: true });
                    historyStore.createIndex('level', 'level', { unique: false });
                    historyStore.createIndex('playedAt', 'playedAt', { unique: false });
                }
            };
        });
    }

    // 保存游戏进度
    async saveGameProgress(level, data) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameProgress'], 'readwrite');
            const store = transaction.objectStore('gameProgress');

            const progressData = {
                id: `level_${level}`,
                level: level,
                ...data,
                updatedAt: new Date().toISOString()
            };

            const request = store.put(progressData);

            request.onsuccess = () => {
                resolve(progressData);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 保存当前游戏状态（用于继续游戏功能）
    // 保存特定关卡的游戏状态
    async saveLevelState(level, gameState) {
        if (!this.db) await this.initDB();
        
        const levelKey = `level_${level}_state`;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameProgress'], 'readwrite');
            const store = transaction.objectStore('gameProgress');

            const stateData = {
                id: levelKey, // 🔥 关键修复：使用关卡特定的ID
                level: level,
                playerGrid: gameState.playerGrid,
                notes: gameState.notes ? this.serializeNotes(gameState.notes) : null,
                mistakes: gameState.mistakes,
                hintsUsed: gameState.hintsUsed,
                currentTime: gameState.currentTime,
                startTime: gameState.startTime,
                selectedCell: gameState.selectedCell,
                selectedNumber: gameState.selectedNumber,
                isNoteMode: gameState.isNoteMode,
                puzzle: gameState.puzzle,
                solution: gameState.solution,
                inProgress: true,
                savedAt: new Date().toISOString()
            };

            const request = store.put(stateData);

            request.onsuccess = () => {
                console.log(`✓ 关卡${level}状态已保存`);
                resolve(stateData);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 向后兼容的方法
    async saveCurrentGameState(gameState) {
        return this.saveLevelState(gameState.level, gameState);
    }

    // 获取特定关卡的游戏状态
    async getLevelState(level) {
        if (!this.db) await this.initDB();
        
        const levelKey = `level_${level}_state`;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameProgress'], 'readonly');
            const store = transaction.objectStore('gameProgress');

            const request = store.get(levelKey);

            request.onsuccess = () => {
                const result = request.result;
                if (result && result.inProgress) {
                    // 反序列化笔记
                    if (result.notes) {
                        result.notes = this.deserializeNotes(result.notes);
                    }
                    console.log(`✓ 找到关卡${level}的保存状态`);
                    resolve(result);
                } else {
                    console.log(`关卡${level}没有保存状态`);
                    resolve(null);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 向后兼容：获取当前游戏状态（现在查找最新的有进度关卡）
    async getCurrentGameState() {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameProgress'], 'readonly');
            const store = transaction.objectStore('gameProgress');

            // 获取所有记录
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result;
                
                // 找到所有有进度的关卡状态
                const levelStates = results.filter(item => 
                    item.id && item.id.startsWith('level_') && 
                    item.id.endsWith('_state') && 
                    item.inProgress
                );

                if (levelStates.length > 0) {
                    // 按最后保存时间排序，返回最新的
                    levelStates.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
                    const latestState = levelStates[0];
                    
                    // 反序列化笔记
                    if (latestState.notes) {
                        latestState.notes = this.deserializeNotes(latestState.notes);
                    }
                    
                    console.log(`找到最新的有进度关卡：关卡${latestState.level}`);
                    resolve(latestState);
                } else {
                    console.log('没有找到任何有进度的关卡');
                    resolve(null);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 清除特定关卡的游戏状态
    async clearLevelState(level) {
        if (!this.db) await this.initDB();
        
        const levelKey = `level_${level}_state`;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameProgress'], 'readwrite');
            const store = transaction.objectStore('gameProgress');

            const request = store.delete(levelKey);

            request.onsuccess = () => {
                console.log(`✓ 关卡${level}状态已清除`);
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 向后兼容：清除当前游戏状态（现在清除所有关卡状态）
    async clearCurrentGameState() {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameProgress'], 'readwrite');
            const store = transaction.objectStore('gameProgress');

            // 获取所有记录
            const getAllRequest = store.getAll();

            getAllRequest.onsuccess = () => {
                const results = getAllRequest.result;
                
                // 找到所有关卡状态记录
                const levelStateKeys = results
                    .filter(item => item.id && item.id.startsWith('level_') && item.id.endsWith('_state'))
                    .map(item => item.id);

                if (levelStateKeys.length === 0) {
                    resolve();
                    return;
                }

                let deletedCount = 0;
                const totalToDelete = levelStateKeys.length;

                levelStateKeys.forEach(key => {
                    const deleteRequest = store.delete(key);
                    
                    deleteRequest.onsuccess = () => {
                        deletedCount++;
                        if (deletedCount === totalToDelete) {
                            console.log(`✓ 已清除${totalToDelete}个关卡的保存状态`);
                            resolve();
                        }
                    };
                    
                    deleteRequest.onerror = () => {
                        reject(deleteRequest.error);
                    };
                });
            };

            getAllRequest.onerror = () => {
                reject(getAllRequest.error);
            };
        });
    }

    // 序列化笔记（将Set转换为Array）
    serializeNotes(notes) {
        try {
            if (!notes || !Array.isArray(notes)) {
                console.warn('笔记数据格式不正确，使用默认空数据');
                return Array(9).fill().map(() => Array(9).fill([]));
            }
            return notes.map(row => {
                if (!Array.isArray(row)) return Array(9).fill([]);
                return row.map(cell => {
                    if (cell && typeof cell.values === 'function') {
                        return Array.from(cell); // Set 类型
                    } else if (Array.isArray(cell)) {
                        return cell; // 已经是数组
                    }
                    return [];
                });
            });
        } catch (error) {
            console.error('序列化笔记失败:', error);
            return Array(9).fill().map(() => Array(9).fill([]));
        }
    }

    // 反序列化笔记（将Array转换为Set）
    deserializeNotes(serializedNotes) {
        try {
            if (!serializedNotes || !Array.isArray(serializedNotes)) {
                console.warn('反序列化笔记数据格式不正确，使用默认空数据');
                return Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
            }
            return serializedNotes.map(row => {
                if (!Array.isArray(row)) return Array(9).fill().map(() => new Set());
                return row.map(cell => {
                    if (Array.isArray(cell)) {
                        return new Set(cell);
                    }
                    return new Set();
                });
            });
        } catch (error) {
            console.error('反序列化笔记失败:', error);
            return Array(9).fill().map(() => Array(9).fill().map(() => new Set()));
        }
    }

    // 获取游戏进度
    async getGameProgress(level) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameProgress'], 'readonly');
            const store = transaction.objectStore('gameProgress');

            const request = store.get(`level_${level}`);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 获取所有完成的关卡
    async getAllCompletedLevels() {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameProgress'], 'readonly');
            const store = transaction.objectStore('gameProgress');

            const request = store.getAll();

            request.onsuccess = () => {
                const completed = request.result
                    .filter(item => item.completed)
                    .map(item => ({
                        level: item.level,
                        stars: item.stars,
                        time: item.time,
                        mistakes: item.mistakes,
                        completedAt: item.completedAt
                    }));
                resolve(completed);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 保存用户统计
    async saveUserStats(stats) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['userStats'], 'readwrite');
            const store = transaction.objectStore('userStats');

            const statsData = {
                id: 'user_stats',
                ...stats,
                updatedAt: new Date().toISOString()
            };

            const request = store.put(statsData);

            request.onsuccess = () => {
                resolve(statsData);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 获取用户统计
    async getUserStats() {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['userStats'], 'readonly');
            const store = transaction.objectStore('userStats');

            const request = store.get('user_stats');

            request.onsuccess = () => {
                resolve(request.result || {
                    id: 'user_stats',
                    totalGames: 0,
                    gamesWon: 0,
                    totalTime: 0,
                    bestTime: Infinity,
                    currentStreak: 0,
                    maxStreak: 0,
                    hintsUsed: 0,
                    mistakesMade: 0
                });
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 保存游戏设置
    async saveGameSettings(settings) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameSettings'], 'readwrite');
            const store = transaction.objectStore('gameSettings');

            const settingsData = {
                id: 'game_settings',
                ...settings,
                updatedAt: new Date().toISOString()
            };

            const request = store.put(settingsData);

            request.onsuccess = () => {
                resolve(settingsData);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 获取游戏设置
    async getGameSettings() {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameSettings'], 'readonly');
            const store = transaction.objectStore('gameSettings');

            const request = store.get('game_settings');

            request.onsuccess = () => {
                resolve(request.result || {
                    id: 'game_settings',
                    soundEnabled: true,
                    autoCheckErrors: true,
                    highlightNumbers: true,
                    theme: 'light',
                    difficulty: 'medium',
                    showTimer: true,
                    showMistakes: true
                });
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 解锁成就
    async unlockAchievement(achievementId, achievementData) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['achievements'], 'readwrite');
            const store = transaction.objectStore('achievements');

            const data = {
                id: achievementId,
                ...achievementData,
                unlockedAt: new Date().toISOString()
            };

            const request = store.put(data);

            request.onsuccess = () => {
                resolve(data);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 获取所有成就
    async getAllAchievements() {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['achievements'], 'readonly');
            const store = transaction.objectStore('achievements');

            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 记录游戏历史
    async recordGameHistory(gameData) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameHistory'], 'readwrite');
            const store = transaction.objectStore('gameHistory');

            const historyData = {
                ...gameData,
                playedAt: new Date().toISOString()
            };

            const request = store.add(historyData);

            request.onsuccess = () => {
                resolve({ id: request.result, ...historyData });
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 获取游戏历史
    async getGameHistory(limit = 50) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameHistory'], 'readonly');
            const store = transaction.objectStore('gameHistory');
            const index = store.index('playedAt');

            const request = index.openCursor(null, 'prev');
            const results = [];
            let count = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && count < limit) {
                    results.push(cursor.value);
                    count++;
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 获取关卡统计
    async getLevelStats(level) {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameHistory'], 'readonly');
            const store = transaction.objectStore('gameHistory');
            const index = store.index('level');

            const request = index.getAll(level);

            request.onsuccess = () => {
                const games = request.result || [];
                const completedGames = games.filter(game => game.completed);
                
                const stats = {
                    level: level,
                    totalAttempts: games.length,
                    completedAttempts: completedGames.length,
                    successRate: games.length > 0 ? (completedGames.length / games.length * 100).toFixed(1) : 0,
                    bestTime: completedGames.length > 0 ? Math.min(...completedGames.map(g => g.time)) : null,
                    averageTime: completedGames.length > 0 ? completedGames.reduce((sum, g) => sum + g.time, 0) / completedGames.length : null,
                    totalMistakes: games.reduce((sum, g) => sum + (g.mistakes || 0), 0),
                    totalHints: games.reduce((sum, g) => sum + (g.hintsUsed || 0), 0)
                };

                resolve(stats);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // 导出数据
    async exportData() {
        if (!this.db) await this.initDB();

        try {
            const [progress, stats, settings, achievements, history] = await Promise.all([
                this.getAllCompletedLevels(),
                this.getUserStats(),
                this.getGameSettings(),
                this.getAllAchievements(),
                this.getGameHistory(1000)
            ]);

            const exportData = {
                version: 1,
                exportedAt: new Date().toISOString(),
                gameProgress: progress,
                userStats: stats,
                gameSettings: settings,
                achievements: achievements,
                gameHistory: history
            };

            return exportData;
        } catch (error) {
            throw new Error(`导出数据失败: ${error.message}`);
        }
    }

    // 导入数据
    async importData(importData) {
        if (!this.db) await this.initDB();

        try {
            // 验证数据格式
            if (!importData.version || !importData.exportedAt) {
                throw new Error('无效的数据格式');
            }

            const transaction = this.db.transaction(['gameProgress', 'userStats', 'gameSettings', 'achievements', 'gameHistory'], 'readwrite');

            // 清空现有数据
            const stores = ['gameProgress', 'userStats', 'gameSettings', 'achievements', 'gameHistory'];
            await Promise.all(stores.map(storeName => {
                return new Promise((resolve, reject) => {
                    const request = transaction.objectStore(storeName).clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }));

            // 导入新数据
            const promises = [];

            // 导入游戏进度
            if (importData.gameProgress) {
                importData.gameProgress.forEach(progress => {
                    promises.push(this.saveGameProgress(progress.level, progress));
                });
            }

            // 导入用户统计
            if (importData.userStats) {
                promises.push(this.saveUserStats(importData.userStats));
            }

            // 导入游戏设置
            if (importData.gameSettings) {
                promises.push(this.saveGameSettings(importData.gameSettings));
            }

            // 导入成就
            if (importData.achievements) {
                importData.achievements.forEach(achievement => {
                    promises.push(this.unlockAchievement(achievement.id, achievement));
                });
            }

            // 导入游戏历史
            if (importData.gameHistory) {
                importData.gameHistory.forEach(history => {
                    promises.push(this.recordGameHistory(history));
                });
            }

            await Promise.all(promises);
            return { success: true, message: '数据导入成功' };

        } catch (error) {
            throw new Error(`导入数据失败: ${error.message}`);
        }
    }

    // 清空所有数据
    async clearAllData() {
        if (!this.db) await this.initDB();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['gameProgress', 'userStats', 'gameSettings', 'achievements', 'gameHistory'], 'readwrite');
            
            const stores = ['gameProgress', 'userStats', 'gameSettings', 'achievements', 'gameHistory'];
            const promises = stores.map(storeName => {
                return new Promise((resolve, reject) => {
                    const request = transaction.objectStore(storeName).clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            });

            Promise.all(promises)
                .then(() => resolve({ success: true, message: '所有数据已清空' }))
                .catch(error => reject(error));
        });
    }

    // 获取数据库大小估计
    async getStorageEstimate() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                return {
                    quota: estimate.quota,
                    usage: estimate.usage,
                    available: estimate.quota - estimate.usage,
                    percentage: ((estimate.usage / estimate.quota) * 100).toFixed(2)
                };
            } catch (error) {
                console.error('无法获取存储估计:', error);
                return null;
            }
        }
        return null;
    }

    // 数据库健康检查
    async healthCheck() {
        if (!this.db) {
            try {
                await this.initDB();
                return { status: 'healthy', message: '数据库连接正常' };
            } catch (error) {
                return { status: 'error', message: `数据库连接失败: ${error.message}` };
            }
        }

        try {
            // 测试读写操作
            await this.saveGameSettings({ testKey: 'testValue' });
            const settings = await this.getGameSettings();
            
            if (settings && settings.testKey === 'testValue') {
                return { status: 'healthy', message: '数据库功能正常' };
            } else {
                return { status: 'warning', message: '数据库读写异常' };
            }
        } catch (error) {
            return { status: 'error', message: `数据库操作失败: ${error.message}` };
        }
    }
}

// 导出类
window.DataManager = DataManager;
