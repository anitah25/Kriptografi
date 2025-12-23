// S-Box Cryptographic Analysis Engine
// Implements comprehensive cryptographic property analysis for 8-bit S-boxes

class SBoxAnalyzer {
    constructor(sboxArray) {
        if (!sboxArray || sboxArray.length !== 256) {
            throw new Error('S-box must be an array of exactly 256 values');
        }
        
        this.sbox = [...sboxArray]; // Create copy to avoid mutation
        this.n = 8; // Input/output size in bits
        this.size = 256; // 2^n
        
        // Precomputed values for optimization
        this.hammingWeights = this.precomputeHammingWeights();
        this.booleanFunctions = null; // Lazy initialization
        this.linearApproxTable = null; // Lazy initialization
        this.differenceTable = null; // Lazy initialization
    }

    // Precompute Hamming weights for all 8-bit values
    precomputeHammingWeights() {
        const weights = new Array(256);
        for (let i = 0; i < 256; i++) {
            weights[i] = this.hammingWeight(i);
        }
        return weights;
    }

    // Calculate Hamming weight (number of 1s in binary representation)
    hammingWeight(n) {
        let weight = 0;
        while (n) {
            weight += n & 1;
            n >>= 1;
        }
        return weight;
    }

    // Get Boolean function for specific output bit
    getBooleanFunction(outputBit) {
        if (!this.booleanFunctions) {
            this.booleanFunctions = Array(8).fill(null);
        }
        
        if (!this.booleanFunctions[outputBit]) {
            const truthTable = new Array(256);
            for (let i = 0; i < 256; i++) {
                truthTable[i] = (this.sbox[i] >> outputBit) & 1;
            }
            this.booleanFunctions[outputBit] = truthTable;
        }
        
        return this.booleanFunctions[outputBit];
    }

    // Walsh-Hadamard Transform for Boolean function
    walshHadamardTransform(truthTable) {
        const n = this.n;
        const size = 1 << n;
        const walsh = new Array(size);
        
        for (let w = 0; w < size; w++) {
            let sum = 0;
            for (let x = 0; x < size; x++) {
                const dotProduct = this.hammingWeights[x & w] & 1;
                sum += Math.pow(-1, truthTable[x] ^ dotProduct);
            }
            walsh[w] = sum;
        }
        
        return walsh;
    }

    // 1. Non-Linearity (NL)
    calculateNonlinearity() {
        let minNonlinearity = Infinity;
        
        for (let bit = 0; bit < this.n; bit++) {
            const truthTable = this.getBooleanFunction(bit);
            const walsh = this.walshHadamardTransform(truthTable);
            
            // Find maximum absolute Walsh coefficient (excluding W(0))
            let maxWalsh = 0;
            for (let i = 1; i < walsh.length; i++) {
                maxWalsh = Math.max(maxWalsh, Math.abs(walsh[i]));
            }
            
            // Nonlinearity = 2^(n-1) - max|Walsh|/2
            const nonlinearity = (1 << (this.n - 1)) - (maxWalsh / 2);
            minNonlinearity = Math.min(minNonlinearity, nonlinearity);
        }
        
        return minNonlinearity;
    }

    // 2. Strict Avalanche Criterion (SAC)
    calculateSAC() {
        const sacMatrix = Array(this.n).fill().map(() => Array(this.n).fill(0));
        
        for (let inputBit = 0; inputBit < this.n; inputBit++) {
            for (let outputBit = 0; outputBit < this.n; outputBit++) {
                let flipCount = 0;
                
                for (let x = 0; x < this.size; x++) {
                    const flippedX = x ^ (1 << inputBit);
                    const y1 = this.sbox[x];
                    const y2 = this.sbox[flippedX];
                    
                    if (((y1 >> outputBit) & 1) !== ((y2 >> outputBit) & 1)) {
                        flipCount++;
                    }
                }
                
                sacMatrix[inputBit][outputBit] = flipCount / this.size;
            }
        }
        
        // Calculate SAC score (deviation from ideal 0.5)
        let sacScore = 0;
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                sacScore += Math.abs(sacMatrix[i][j] - 0.5);
            }
        }
        
        return {
            matrix: sacMatrix,
            score: sacScore / (this.n * this.n),
            maxDeviation: Math.max(...sacMatrix.flat().map(x => Math.abs(x - 0.5)))
        };
    }

    // 3. Bit Independence Criterion - Nonlinearity (BIC-NL)
    calculateBIC_NL() {
        const correlations = [];
        
        for (let bit1 = 0; bit1 < this.n; bit1++) {
            for (let bit2 = bit1 + 1; bit2 < this.n; bit2++) {
                const f1 = this.getBooleanFunction(bit1);
                const f2 = this.getBooleanFunction(bit2);
                
                // Create combined function f1 ⊕ f2
                const combined = new Array(this.size);
                for (let x = 0; x < this.size; x++) {
                    combined[x] = f1[x] ^ f2[x];
                }
                
                // Calculate nonlinearity of combined function
                const walsh = this.walshHadamardTransform(combined);
                let maxWalsh = 0;
                for (let i = 1; i < walsh.length; i++) {
                    maxWalsh = Math.max(maxWalsh, Math.abs(walsh[i]));
                }
                
                const nonlinearity = (1 << (this.n - 1)) - (maxWalsh / 2);
                correlations.push(nonlinearity);
            }
        }
        
        return {
            minNonlinearity: Math.min(...correlations),
            averageNonlinearity: correlations.reduce((a, b) => a + b, 0) / correlations.length,
            correlations: correlations
        };
    }

    // 4. Bit Independence Criterion - SAC (BIC-SAC)
    calculateBIC_SAC() {
        const correlations = [];
        
        for (let bit1 = 0; bit1 < this.n; bit1++) {
            for (let bit2 = bit1 + 1; bit2 < this.n; bit2++) {
                let correlation = 0;
                
                for (let x = 0; x < this.size; x++) {
                    const y = this.sbox[x];
                    const bit1Val = (y >> bit1) & 1;
                    const bit2Val = (y >> bit2) & 1;
                    correlation += (2 * bit1Val - 1) * (2 * bit2Val - 1);
                }
                
                correlations.push(Math.abs(correlation / this.size));
            }
        }
        
        return {
            maxCorrelation: Math.max(...correlations),
            averageCorrelation: correlations.reduce((a, b) => a + b, 0) / correlations.length,
            correlations: correlations
        };
    }

    // 5. Linear Approximation Probability (LAP)
    calculateLAP() {
        if (!this.linearApproxTable) {
            this.buildLinearApproximationTable();
        }
        
        let maxBias = 0;
        
        // Find maximum bias (excluding zero input/output masks)
        for (let a = 0; a < this.size; a++) {
            for (let b = 0; b < this.size; b++) {
                if (a !== 0 || b !== 0) {
                    maxBias = Math.max(maxBias, Math.abs(this.linearApproxTable[a][b]));
                }
            }
        }
        
        // LAP = (max_bias / 2^(n-1))^2
        const maxLAP = Math.pow(maxBias / (1 << (this.n - 1)), 2);
        
        return {
            maxBias: maxBias,
            maxLAP: maxLAP,
            table: this.linearApproxTable
        };
    }

    // Build Linear Approximation Table
    buildLinearApproximationTable() {
        this.linearApproxTable = Array(this.size).fill().map(() => Array(this.size).fill(0));
        
        for (let a = 0; a < this.size; a++) {
            for (let b = 0; b < this.size; b++) {
                let count = 0;
                
                for (let x = 0; x < this.size; x++) {
                    const inputParity = this.hammingWeights[a & x] & 1;
                    const outputParity = this.hammingWeights[b & this.sbox[x]] & 1;
                    
                    if (inputParity === outputParity) {
                        count++;
                    }
                }
                
                this.linearApproxTable[a][b] = count - (this.size / 2); // Bias
            }
        }
    }

    // 6. Differential Approximation Probability (DAP)
    calculateDAP() {
        if (!this.differenceTable) {
            this.buildDifferenceDistributionTable();
        }
        
        let maxDiff = 0;
        
        // Find maximum differential (excluding zero input difference)
        for (let i = 1; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                maxDiff = Math.max(maxDiff, this.differenceTable[i][j]);
            }
        }
        
        // DAP = max_diff / 2^n
        const maxDAP = maxDiff / this.size;
        
        return {
            maxDifferential: maxDiff,
            maxDAP: maxDAP,
            table: this.differenceTable
        };
    }

    // Build Difference Distribution Table
    buildDifferenceDistributionTable() {
        this.differenceTable = Array(this.size).fill().map(() => Array(this.size).fill(0));
        
        for (let x1 = 0; x1 < this.size; x1++) {
            for (let x2 = 0; x2 < this.size; x2++) {
                const inputDiff = x1 ^ x2;
                const outputDiff = this.sbox[x1] ^ this.sbox[x2];
                this.differenceTable[inputDiff][outputDiff]++;
            }
        }
    }

    // 7. Differential Uniformity (DU)
    calculateDifferentialUniformity() {
        const dap = this.calculateDAP();
        return dap.maxDifferential;
    }

    // 8. Algebraic Degree (AD)
    calculateAlgebraicDegree() {
        let maxDegree = 0;
        
        for (let bit = 0; bit < this.n; bit++) {
            const truthTable = this.getBooleanFunction(bit);
            const degree = this.calculateBooleanFunctionDegree(truthTable);
            maxDegree = Math.max(maxDegree, degree);
        }
        
        return maxDegree;
    }

    // Calculate algebraic degree of a Boolean function using ANF
    calculateBooleanFunctionDegree(truthTable) {
        const anf = this.computeANF(truthTable);
        let maxDegree = 0;
        
        for (let term = 0; term < this.size; term++) {
            if (anf[term] === 1) {
                const degree = this.hammingWeights[term];
                maxDegree = Math.max(maxDegree, degree);
            }
        }
        
        return maxDegree;
    }

    // Compute Algebraic Normal Form using Möbius transform
    computeANF(truthTable) {
        const anf = [...truthTable];
        
        for (let i = 0; i < this.n; i++) {
            for (let mask = 0; mask < this.size; mask++) {
                if ((mask >> i) & 1) {
                    anf[mask] ^= anf[mask ^ (1 << i)];
                }
            }
        }
        
        return anf;
    }

    // 9. Transparency Order (TO) - Critical implementation for 8-bit S-boxes
    calculateTransparencyOrder() {
        let maxOrder = 0;
        
        // For each pair of distinct input bits
        for (let i = 0; i < this.n; i++) {
            for (let j = i + 1; j < this.n; j++) {
                // For each subset of output bits
                for (let outputMask = 1; outputMask < this.size; outputMask++) {
                    const order = this.computeTransparencyOrderForMask(i, j, outputMask);
                    maxOrder = Math.max(maxOrder, order);
                }
            }
        }
        
        return maxOrder;
    }

    // Compute transparency order for specific input bits and output mask
    computeTransparencyOrderForMask(inputBit1, inputBit2, outputMask) {
        const contingencyTable = Array(4).fill().map(() => Array(256).fill(0));
        
        // Build contingency table
        for (let x = 0; x < this.size; x++) {
            const bit1 = (x >> inputBit1) & 1;
            const bit2 = (x >> inputBit2) & 1;
            const index = (bit1 << 1) | bit2; // 00, 01, 10, 11
            
            const output = this.sbox[x];
            const maskedOutput = this.hammingWeights[output & outputMask] & 1;
            
            contingencyTable[index][maskedOutput]++;
        }
        
        // Calculate transparency order using chi-squared statistic
        let chiSquared = 0;
        const expected = this.size / 8; // Expected frequency for each cell
        
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 2; j++) {
                const observed = contingencyTable[i][j];
                if (expected > 0) {
                    chiSquared += Math.pow(observed - expected, 2) / expected;
                }
            }
        }
        
        // Transparency order is related to chi-squared value
        // Higher chi-squared indicates higher transparency order
        return Math.sqrt(chiSquared);
    }

    // 10. Correlation Immunity (CI)
    calculateCorrelationImmunity() {
        let maxCI = 0;
        
        for (let bit = 0; bit < this.n; bit++) {
            const truthTable = this.getBooleanFunction(bit);
            const walsh = this.walshHadamardTransform(truthTable);
            
            // Find highest weight input for which Walsh coefficient is zero
            let ci = 0;
            for (let weight = 1; weight <= this.n; weight++) {
                let hasZeroWalsh = false;
                
                for (let mask = 0; mask < this.size; mask++) {
                    if (this.hammingWeights[mask] === weight && walsh[mask] === 0) {
                        hasZeroWalsh = true;
                        break;
                    }
                }
                
                if (hasZeroWalsh) {
                    ci = weight;
                } else {
                    break;
                }
            }
            
            maxCI = Math.max(maxCI, ci);
        }
        
        return maxCI;
    }

    // Helper method to check if S-box is balanced
    isBalanced() {
        const counts = Array(this.size).fill(0);
        for (const value of this.sbox) {
            counts[value]++;
        }
        return counts.every(count => count === 1);
    }

    // Helper method to check if S-box is a bijection
    isBijection() {
        const seen = new Set(this.sbox);
        return seen.size === this.size;
    }

    // Main analysis function - returns all cryptographic properties
    async runFullAnalysis() {
        const results = {
            timestamp: new Date().toISOString(),
            sboxProperties: {
                size: this.size,
                isBalanced: this.isBalanced(),
                isBijection: this.isBijection()
            }
        };

        try {
            // Basic properties (fast)
            console.log('Calculating basic properties...');
            
            // Non-linearity
            console.log('Calculating Non-linearity...');
            results.nonlinearity = this.calculateNonlinearity();
            
            // SAC
            console.log('Calculating SAC...');
            results.sac = this.calculateSAC();
            
            // Differential Uniformity
            console.log('Calculating Differential Uniformity...');
            results.differentialUniformity = this.calculateDifferentialUniformity();
            
            // Algebraic Degree
            console.log('Calculating Algebraic Degree...');
            results.algebraicDegree = this.calculateAlgebraicDegree();
            
            // Linear Approximation Probability
            console.log('Calculating LAP...');
            results.lap = this.calculateLAP();
            
            // Differential Approximation Probability
            console.log('Calculating DAP...');
            results.dap = this.calculateDAP();
            
            // BIC properties
            console.log('Calculating BIC-NL...');
            results.bicNL = this.calculateBIC_NL();
            
            console.log('Calculating BIC-SAC...');
            results.bicSAC = this.calculateBIC_SAC();
            
            // Correlation Immunity
            console.log('Calculating Correlation Immunity...');
            results.correlationImmunity = this.calculateCorrelationImmunity();
            
            // Transparency Order (computationally intensive)
            console.log('Calculating Transparency Order...');
            results.transparencyOrder = await this.calculateTransparencyOrderAsync();
            
            console.log('Analysis complete!');
            
        } catch (error) {
            console.error('Error during analysis:', error);
            results.error = error.message;
        }
        
        return results;
    }

    // Asynchronous version of transparency order calculation
    async calculateTransparencyOrderAsync() {
        return new Promise((resolve) => {
            // Use setTimeout to make it non-blocking
            setTimeout(() => {
                try {
                    const to = this.calculateTransparencyOrder();
                    resolve(to);
                } catch (error) {
                    console.error('Error calculating transparency order:', error);
                    resolve(null);
                }
            }, 0);
        });
    }

    // Generate summary report
    generateSummary(results) {
        const summary = {
            securityLevel: 'Unknown',
            recommendations: [],
            strengths: [],
            weaknesses: []
        };
        
        // Evaluate security based on standard criteria
        if (results.nonlinearity >= 100) {
            summary.strengths.push('High nonlinearity (≥100)');
        } else {
            summary.weaknesses.push(`Low nonlinearity (${results.nonlinearity})`);
        }
        
        if (results.differentialUniformity <= 4) {
            summary.strengths.push('Good differential uniformity (≤4)');
        } else {
            summary.weaknesses.push(`High differential uniformity (${results.differentialUniformity})`);
        }
        
        if (results.lap.maxBias <= 32) {
            summary.strengths.push('Good linear resistance');
        } else {
            summary.weaknesses.push('Vulnerable to linear cryptanalysis');
        }
        
        if (results.sac.score <= 0.1) {
            summary.strengths.push('Satisfies SAC criterion');
        } else {
            summary.weaknesses.push('Poor avalanche properties');
        }
        
        // Overall security assessment
        if (summary.weaknesses.length === 0) {
            summary.securityLevel = 'High';
        } else if (summary.weaknesses.length <= 2) {
            summary.securityLevel = 'Medium';
        } else {
            summary.securityLevel = 'Low';
        }
        
        return summary;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SBoxAnalyzer;
} else if (typeof window !== 'undefined') {
    window.SBoxAnalyzer = SBoxAnalyzer;
}
