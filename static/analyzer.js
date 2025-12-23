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
        // Convert 0/1 truth table to 1/-1 for WHT
        // If input is already 1/-1 (or similar), this might need adjustment.
        // The Python code uses: f.append(1 if bit_val == 0 else -1)
        // My JS code usually passes 0/1.
        // Let's check getBooleanFunction. It returns 0/1.
        // The Python code converts 0 -> 1, 1 -> -1.
        // My JS WHT implementation:
        // sum += Math.pow(-1, truthTable[x] ^ dotProduct);
        // This assumes truthTable[x] is 0 or 1.
        // If truthTable[x] is 0, (-1)^(0^d) = (-1)^d.
        // If truthTable[x] is 1, (-1)^(1^d) = -(-1)^d.
        // This is equivalent to (1 - 2*truthTable[x]) * (-1)^d.
        // Which is (1 if 0 else -1) * (-1)^d.
        // So the logic is consistent.
        
        const walsh = new Array(size);
        
        // Fast Walsh-Hadamard Transform (FWHT) implementation
        // The previous implementation was O(N^2), this is O(N log N)
        const f = new Array(size);
        for(let i=0; i<size; i++) {
            // Convert 0/1 to 1/-1
            // If truthTable contains 0/1:
            f[i] = truthTable[i] === 0 ? 1 : -1;
        }
        
        // Iterative FWHT
        let h = 1;
        while (h < size) {
            for (let i = 0; i < size; i += h * 2) {
                for (let j = i; j < i + h; j++) {
                    const x = f[j];
                    const y = f[j + h];
                    f[j] = x + y;
                    f[j + h] = x - y;
                }
            }
            h *= 2;
        }
        
        return f;
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
        let totalSac = 0;
        let count = 0;
        
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
                
                // For average calculation (matching Python logic)
                // Python: total_sac += hw(diff). count += 8.
                // Here we iterate output bits. hw(diff) is sum of flips across output bits.
                // So flipCount contributes to total_sac.
                totalSac += flipCount;
                count += this.size; 
            }
        }
        
        // Python returns total_sac / (8 * 256 * 8)
        // Here totalSac is sum of all bit flips.
        // count is 8 * 8 * 256.
        // So average is totalSac / count.
        
        return {
            matrix: sacMatrix,
            score: totalSac / count, // Average SAC probability
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
    // Calculates average SAC of the XOR sum of any two output bits
    calculateBIC_SAC() {
        let totalSacXor = 0;
        let countXor = 0;
        
        for (let i = 0; i < this.n; i++) {
            for (let j = i + 1; j < this.n; j++) {
                let currentSacSum = 0;
                let currentCount = 0;
                
                for (let k = 0; k < this.n; k++) { // Input bit to flip
                    for (let x = 0; x < this.size; x++) {
                        const xFlipped = x ^ (1 << k);
                        const y1 = this.sbox[x];
                        const y2 = this.sbox[xFlipped];
                        
                        const b1_i = (y1 >> i) & 1;
                        const b1_j = (y1 >> j) & 1;
                        const h1 = b1_i ^ b1_j;
                        
                        const b2_i = (y2 >> i) & 1;
                        const b2_j = (y2 >> j) & 1;
                        const h2 = b2_i ^ b2_j;
                        
                        if (h1 !== h2) {
                            currentSacSum++;
                        }
                        currentCount++;
                    }
                }
                
                totalSacXor += (currentSacSum / currentCount);
                countXor++;
            }
        }
        
        return {
            averageSAC: totalSacXor / countXor
        };
    }

    // 5. Linear Approximation Probability (LAP)
    calculateLAP() {
        let maxBias = 0;
        
        // Iterate over all non-zero output masks b
        for (let b = 1; b < this.size; b++) {
            const f = new Array(this.size);
            for (let x = 0; x < this.size; x++) {
                const val = this.sbox[x];
                // Dot product of b and val
                let dotProd = 0;
                let temp = b & val;
                while (temp) {
                    dotProd ^= (temp & 1);
                    temp >>= 1;
                }
                f[x] = dotProd === 0 ? 0 : 1;
            }
            
            const wht = this.walshHadamardTransform(f);
            
            for (let i = 0; i < this.size; i++) {
                maxBias = Math.max(maxBias, Math.abs(wht[i]));
            }
        }
        
        // LAP = (max_bias / 2^(n-1))^2
        const maxLAP = Math.pow(maxBias / (1 << (this.n - 1)), 2);
        
        return {
            maxBias: maxBias,
            maxLAP: maxLAP
        };
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
        const n = this.n;
        const M = this.size;
        let maxTO = -Infinity;
        
        const sumAbsWhtBeta = new Array(M).fill(0);
        
        // Precompute sum of absolute WHT values
        for (let a = 1; a < M; a++) {
            const f = new Array(M);
            for (let x = 0; x < M; x++) {
                const val = this.sbox[x];
                let dotProd = 0;
                let temp = a & val;
                while (temp) {
                    dotProd ^= (temp & 1);
                    temp >>= 1;
                }
                f[x] = dotProd === 0 ? 0 : 1;
            }
            
            const wht = this.walshHadamardTransform(f);
            
            for (let beta = 1; beta < M; beta++) {
                sumAbsWhtBeta[beta] += Math.abs(wht[beta]);
            }
        }
        
        const factor = 1.0 / (M * (M - 1));
        
        for (let beta = 1; beta < M; beta++) {
            const wtBeta = this.hammingWeights[beta];
            const term = n - 2 * wtBeta - factor * sumAbsWhtBeta[beta];
            if (term > maxTO) {
                maxTO = term;
            }
        }
        
        return maxTO;
    }

    // 10. Correlation Immunity (CI)
    calculateCorrelationImmunity() {
        let maxCI = 0;
        
        // Check each output bit function
        // The CI of the S-box is the minimum CI of its component functions
        let minComponentCI = this.n;

        for (let bit = 0; bit < this.n; bit++) {
            const truthTable = this.getBooleanFunction(bit);
            const walsh = this.walshHadamardTransform(truthTable);
            
            let ci = 0;
            // Check orders 1 up to n
            for (let m = 1; m <= this.n; m++) {
                let allZero = true;
                
                // Check all masks with weight m
                for (let mask = 1; mask < this.size; mask++) {
                    if (this.hammingWeights[mask] === m) {
                        if (walsh[mask] !== 0) {
                            allZero = false;
                            break;
                        }
                    }
                }
                
                if (allZero) {
                    ci = m;
                } else {
                    break; // If it fails for weight m, it can't be CI m
                }
            }
            
            minComponentCI = Math.min(minComponentCI, ci);
        }
        
        return minComponentCI;
    }

    // 11. Bijectivity (Permutation Check)
    calculateBijectivity() {
        if (!this.sbox || this.sbox.length !== 256) {
            return false;
        }
        const seen = new Set(this.sbox);
        return seen.size === 256;
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
        return this.calculateBijectivity();
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
            
            // 1. Bijectivity
            console.log('Calculating Bijectivity...');
            results.bijectivity = this.calculateBijectivity();

            // 2. Non-linearity
            console.log('Calculating Non-linearity...');
            results.nonlinearity = this.calculateNonlinearity();
            
            // 3. SAC
            console.log('Calculating SAC...');
            results.sac = this.calculateSAC();
            
            // 4. BIC-NL
            console.log('Calculating BIC-NL...');
            results.bicNL = this.calculateBIC_NL();

            // 5. BIC-SAC
            console.log('Calculating BIC-SAC...');
            results.bicSAC = this.calculateBIC_SAC();
            
            // 6. LAP
            console.log('Calculating LAP...');
            results.lap = this.calculateLAP();
            
            // 7. DAP
            console.log('Calculating DAP...');
            results.dap = this.calculateDAP();

            // 8. Differential Uniformity
            console.log('Calculating Differential Uniformity...');
            results.differentialUniformity = this.calculateDifferentialUniformity();
            
            // 9. Algebraic Degree
            console.log('Calculating Algebraic Degree...');
            results.algebraicDegree = this.calculateAlgebraicDegree();
            
            // 10. Transparency Order (computationally intensive)
            console.log('Calculating Transparency Order...');
            results.transparencyOrder = await this.calculateTransparencyOrderAsync();

            // 11. Correlation Immunity
            console.log('Calculating Correlation Immunity...');
            results.correlationImmunity = this.calculateCorrelationImmunity();
            
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
