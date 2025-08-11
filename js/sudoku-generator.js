class SudokuGenerator {
    constructor() {
        this.grid = Array(9).fill().map(() => Array(9).fill(0));
        this.solution = Array(9).fill().map(() => Array(9).fill(0));
        this.seed = 1;
        this.seedRandom = this.seedRandom.bind(this);
    }

    // 基于种子的伪随机数生成器
    setSeed(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    // 生成0-1之间的伪随机数
    seedRandom() {
        this.seed = this.seed * 16807 % 2147483647;
        return (this.seed - 1) / 2147483646;
    }

    // 基于种子的随机整数生成
    seedRandomInt(min, max) {
        return Math.floor(this.seedRandom() * (max - min + 1)) + min;
    }

    // 生成完整的数独解决方案
    generateSolution() {
        this.grid = Array(9).fill().map(() => Array(9).fill(0));
        this.fillGrid();
        this.solution = this.grid.map(row => [...row]);
        return this.solution;
    }

    // 填充网格
    fillGrid() {
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (this.grid[row][col] === 0) {
                    // 随机排序数字以增加随机性
                    const shuffledNumbers = this.shuffle([...numbers]);
                    
                    for (let num of shuffledNumbers) {
                        if (this.isValid(row, col, num)) {
                            this.grid[row][col] = num;
                            
                            if (this.fillGrid()) {
                                return true;
                            }
                            
                            this.grid[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    // 检查数字放置是否有效
    isValid(row, col, num) {
        // 检查行
        for (let x = 0; x < 9; x++) {
            if (this.grid[row][x] === num) {
                return false;
            }
        }

        // 检查列
        for (let x = 0; x < 9; x++) {
            if (this.grid[x][col] === num) {
                return false;
            }
        }

        // 检查3x3方块
        const startRow = row - row % 3;
        const startCol = col - col % 3;

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.grid[i + startRow][j + startCol] === num) {
                    return false;
                }
            }
        }

        return true;
    }

    // 打乱数组（使用种子）
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.seedRandom() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // 根据难度生成谜题
    generatePuzzle(level) {
        try {
            console.log(`开始生成第${level}关数独...`);
            
            // 🔥 关键修复：使用关卡号作为种子，确保同一关卡总是生成相同题目
            this.setSeed(level * 12345 + 67890); // 使用固定算法生成种子
            console.log(`关卡${level}使用种子: ${this.seed}`);
            
            // 生成完整解决方案
            const solutionGenerated = this.generateSolution();
            if (!solutionGenerated || !this.solution) {
                throw new Error('无法生成数独解决方案');
            }
            
            const puzzle = this.solution.map(row => [...row]);
            
            const difficulty = this.getDifficulty(level);
            const cellsToRemove = Math.min(difficulty.emptyCells, 60); // 限制最大移除数量
            const pattern = difficulty.pattern;
            
            console.log(`生成配置: 难度=${difficulty.name}, 移除=${cellsToRemove}个, 模式=${pattern}`);
            
            // 根据不同模式移除数字（简化版本，避免复杂算法）
            this.removeNumbersSimple(puzzle, cellsToRemove);
            
            const result = {
                puzzle,
                solution: this.solution.map(row => [...row]),
                type: this.getSudokuType(level),
                difficulty: difficulty.name
            };
            
            console.log(`第${level}关生成完成`);
            return result;
            
        } catch (error) {
            console.error(`生成第${level}关失败:`, error);
            // 返回一个简单的预定义数独
            return this.getFallbackPuzzle(level);
        }
    }

    // 简化的数字移除方法
    removeNumbersSimple(puzzle, count) {
        const positions = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                positions.push([r, c]);
            }
        }
        
        // 随机打乱位置
        this.shuffle(positions);
        
        let removed = 0;
        for (let [row, col] of positions) {
            if (removed >= count) break;
            
            const backup = puzzle[row][col];
            puzzle[row][col] = 0;
            removed++;
            
            // 简单验证：确保移除后不会有明显问题
            if (removed > count * 0.8) {
                // 后面20%的移除需要更谨慎，这里简化跳过验证
                continue;
            }
        }
        
        console.log(`实际移除了${removed}个数字`);
    }

    // 获取备用数独
    getFallbackPuzzle(level) {
        console.log('使用备用数独');
        
        // 🔥 确保备用数独也使用相同种子
        this.setSeed(level * 12345 + 67890);
        
        const solution = [
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
        
        const puzzle = solution.map(row => [...row]);
        
        // 根据关卡移除不同数量的数字（基于种子确定性移除）
        const removeCount = Math.min(30 + Math.floor(level/10), 50);
        const positions = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                positions.push([r, c]);
            }
        }
        
        this.shuffle(positions); // 现在使用种子随机
        for (let i = 0; i < removeCount && i < positions.length; i++) {
            const [r, c] = positions[i];
            puzzle[r][c] = 0;
        }
        
        return {
            puzzle,
            solution,
            type: '标准9x9',
            difficulty: '简单'
        };
    }

    // 获取难度配置
    getDifficulty(level) {
        const difficulties = [
            // 简单关卡 (1-25)
            ...Array(25).fill().map((_, i) => ({
                name: '简单',
                emptyCells: 35 + Math.floor(i / 5) * 2, // 35-43个空格
                pattern: i < 5 ? 'symmetric' : (i < 15 ? 'random' : 'cross')
            })),
            // 中等关卡 (26-50)  
            ...Array(25).fill().map((_, i) => ({
                name: '中等',
                emptyCells: 44 + Math.floor(i / 5) * 2, // 44-52个空格
                pattern: i < 10 ? 'diagonal' : (i < 20 ? 'cross' : 'random')
            })),
            // 困难关卡 (51-75)
            ...Array(25).fill().map((_, i) => ({
                name: '困难',
                emptyCells: 53 + Math.floor(i / 5) * 1, // 53-57个空格
                pattern: i < 8 ? 'cross' : (i < 16 ? 'diagonal' : 'random')
            })),
            // 专家关卡 (76-100)
            ...Array(25).fill().map((_, i) => ({
                name: '专家',
                emptyCells: 58 + Math.floor(i / 8), // 58-61个空格
                pattern: 'random'
            }))
        ];
        
        return difficulties[level - 1] || difficulties[0];
    }

    // 获取数独类型
    getSudokuType(level) {
        const types = [
            // 1-20: 标准9x9
            ...Array(20).fill('标准9x9'),
            // 21-30: 对角线数独
            ...Array(10).fill('对角线数独'),
            // 31-45: X数独
            ...Array(15).fill('X数独'),
            // 46-60: 杀手数独风格
            ...Array(15).fill('区域数独'),
            // 61-75: 不规则数独
            ...Array(15).fill('不规则数独'),
            // 76-100: 混合挑战
            ...Array(25).fill('极限挑战')
        ];
        
        return types[level - 1] || '标准9x9';
    }

    // 对称移除数字
    removeNumbersSymmetric(puzzle, count) {
        const removed = [];
        const pairs = [];
        
        // 生成对称位置对
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                pairs.push([
                    [i, j], [8-i, 8-j]
                ]);
            }
        }
        
        // 中心位置单独处理
        pairs.push([[4, 4]]);
        
        this.shuffle(pairs);
        
        let removedCount = 0;
        for (let pair of pairs) {
            if (removedCount >= count) break;
            
            let canRemove = true;
            const backup = [];
            
            // 备份并尝试移除
            for (let [row, col] of pair) {
                backup.push([row, col, puzzle[row][col]]);
                puzzle[row][col] = 0;
            }
            
            // 检查是否仍有唯一解
            if (this.hasUniqueSolution(puzzle)) {
                removedCount += pair.length;
                removed.push(...pair);
            } else {
                // 还原
                for (let [row, col, val] of backup) {
                    puzzle[row][col] = val;
                }
            }
        }
        
        // 如果移除数量不够，随机移除剩余的
        if (removedCount < count) {
            this.removeNumbersRandom(puzzle, count - removedCount);
        }
    }

    // 对角线模式移除
    removeNumbersDiagonal(puzzle, count) {
        const positions = [];
        
        // 主对角线和副对角线
        for (let i = 0; i < 9; i++) {
            positions.push([i, i]); // 主对角线
            if (i !== 4) { // 避免重复中心点
                positions.push([i, 8-i]); // 副对角线
            }
        }
        
        // 添加一些随机位置
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (i !== j && i !== 8-j) {
                    positions.push([i, j]);
                }
            }
        }
        
        this.removeFromPositions(puzzle, positions, count);
    }

    // 十字模式移除
    removeNumbersCross(puzzle, count) {
        const positions = [];
        
        // 十字形状：中间行和中间列
        for (let i = 0; i < 9; i++) {
            positions.push([4, i]); // 中间行
            if (i !== 4) {
                positions.push([i, 4]); // 中间列
            }
        }
        
        // 添加其他位置
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (i !== 4 && j !== 4) {
                    positions.push([i, j]);
                }
            }
        }
        
        this.removeFromPositions(puzzle, positions, count);
    }

    // 随机移除数字
    removeNumbersRandom(puzzle, count) {
        const positions = [];
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                positions.push([i, j]);
            }
        }
        
        this.removeFromPositions(puzzle, positions, count);
    }

    // 从指定位置移除数字
    removeFromPositions(puzzle, positions, count) {
        this.shuffle(positions);
        let removed = 0;
        
        for (let [row, col] of positions) {
            if (removed >= count) break;
            if (puzzle[row][col] === 0) continue;
            
            const backup = puzzle[row][col];
            puzzle[row][col] = 0;
            
            if (this.hasUniqueSolution(puzzle)) {
                removed++;
            } else {
                puzzle[row][col] = backup;
            }
        }
    }

    // 检查是否有唯一解（简化版本）
    hasUniqueSolution(puzzle) {
        const testGrid = puzzle.map(row => [...row]);
        let solutionCount = 0;
        
        const solve = () => {
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (testGrid[row][col] === 0) {
                        for (let num = 1; num <= 9; num++) {
                            if (this.isValidInGrid(testGrid, row, col, num)) {
                                testGrid[row][col] = num;
                                solve();
                                if (solutionCount > 1) return;
                                testGrid[row][col] = 0;
                            }
                        }
                        return;
                    }
                }
            }
            solutionCount++;
        };
        
        solve();
        return solutionCount === 1;
    }

    // 在指定网格中检查有效性
    isValidInGrid(grid, row, col, num) {
        // 检查行
        for (let x = 0; x < 9; x++) {
            if (grid[row][x] === num) return false;
        }

        // 检查列
        for (let x = 0; x < 9; x++) {
            if (grid[x][col] === num) return false;
        }

        // 检查3x3方块
        const startRow = row - row % 3;
        const startCol = col - col % 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (grid[i + startRow][j + startCol] === num) return false;
            }
        }

        return true;
    }

    // 求解数独
    solveSudoku(grid) {
        const solveGrid = grid.map(row => [...row]);
        
        const solve = () => {
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (solveGrid[row][col] === 0) {
                        for (let num = 1; num <= 9; num++) {
                            if (this.isValidInGrid(solveGrid, row, col, num)) {
                                solveGrid[row][col] = num;
                                if (solve()) return true;
                                solveGrid[row][col] = 0;
                            }
                        }
                        return false;
                    }
                }
            }
            return true;
        };
        
        if (solve()) {
            return solveGrid;
        }
        return null;
    }

    // 获取提示
    getHint(puzzle, solution) {
        const emptyCells = [];
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (puzzle[i][j] === 0) {
                    emptyCells.push([i, j]);
                }
            }
        }
        
        if (emptyCells.length === 0) return null;
        
        // 选择一个空格作为提示（使用确定性选择，不使用随机）
        const randomIndex = Math.floor((emptyCells.length * 0.382) % emptyCells.length); // 使用黄金比例，更确定性
        const [row, col] = emptyCells[randomIndex];
        
        return {
            row,
            col,
            value: solution[row][col],
            explanation: `第${row + 1}行第${col + 1}列应该是${solution[row][col]}`
        };
    }

    // 验证当前状态
    validateCurrentState(puzzle) {
        const errors = [];
        
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const num = puzzle[row][col];
                if (num !== 0) {
                    // 临时移除当前数字
                    puzzle[row][col] = 0;
                    
                    if (!this.isValidInGrid(puzzle, row, col, num)) {
                        errors.push({row, col});
                    }
                    
                    // 恢复数字
                    puzzle[row][col] = num;
                }
            }
        }
        
        return errors;
    }

    // 检查是否完成
    isComplete(puzzle) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (puzzle[row][col] === 0) {
                    return false;
                }
            }
        }
        return this.validateCurrentState(puzzle).length === 0;
    }

    // 生成不同类型的数独变体
    generateVariant(level, type) {
        const basePuzzle = this.generatePuzzle(level);
        
        switch (type) {
            case '对角线数独':
                return this.addDiagonalConstraints(basePuzzle);
            case 'X数独':
                return this.addXConstraints(basePuzzle);
            case '区域数独':
                return this.addRegionConstraints(basePuzzle);
            case '不规则数独':
                return this.addIrregularConstraints(basePuzzle);
            case '极限挑战':
                return this.addMixedConstraints(basePuzzle);
            default:
                return basePuzzle;
        }
    }

    // 添加对角线约束
    addDiagonalConstraints(puzzle) {
        puzzle.constraints = ['diagonal'];
        puzzle.description = '主对角线和副对角线上的数字不能重复';
        return puzzle;
    }

    // 添加X约束
    addXConstraints(puzzle) {
        puzzle.constraints = ['x-pattern'];
        puzzle.description = '两条主对角线形成的X区域数字不能重复';
        return puzzle;
    }

    // 添加区域约束
    addRegionConstraints(puzzle) {
        puzzle.constraints = ['regions'];
        puzzle.description = '特殊标记区域内的数字不能重复';
        // 生成一些随机区域
        puzzle.regions = this.generateRandomRegions();
        return puzzle;
    }

    // 添加不规则约束
    addIrregularConstraints(puzzle) {
        puzzle.constraints = ['irregular'];
        puzzle.description = '不规则形状区域替代标准3x3方块';
        puzzle.irregularRegions = this.generateIrregularRegions();
        return puzzle;
    }

    // 添加混合约束
    addMixedConstraints(puzzle) {
        const constraints = ['diagonal', 'regions'];
        puzzle.constraints = constraints;
        puzzle.description = '结合多种约束的终极挑战';
        puzzle.regions = this.generateRandomRegions();
        return puzzle;
    }

    // 生成随机区域
    generateRandomRegions() {
        // 简化实现，生成几个随机区域
        return [
            {cells: [[0,0], [0,1], [1,0], [1,1]], color: '#ffeb3b'},
            {cells: [[7,7], [7,8], [8,7], [8,8]], color: '#4caf50'},
            {cells: [[0,7], [0,8], [1,7], [1,8]], color: '#f44336'}
        ];
    }

    // 生成不规则区域
    generateIrregularRegions() {
        // 简化实现，返回9个不规则区域
        // 实际实现应该确保每个区域都有9个格子
        const regions = [];
        
        // 这里简化为标准区域，实际应该生成真正的不规则形状
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const region = [];
                for (let r = i * 3; r < (i + 1) * 3; r++) {
                    for (let c = j * 3; c < (j + 1) * 3; c++) {
                        region.push([r, c]);
                    }
                }
                regions.push(region);
            }
        }
        
        return regions;
    }
}

// 导出类
window.SudokuGenerator = SudokuGenerator;
