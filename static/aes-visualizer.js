// AES Step-by-Step Encryption Visualizer
// Allows injection of custom S-box and step-by-step encryption visualization

class AESVisualizer {
    constructor(customSBox = null) {
        // Use custom S-box if provided, otherwise use standard AES S-box
        this.sbox = customSBox || this.getStandardAESSBox();
        
        // Debug logging
        console.log('AESVisualizer initialized with S-box:', 
            customSBox ? `Custom S-box, length: ${customSBox.length}, first few: [${customSBox.slice(0, 10).join(', ')}...]` 
                      : 'Standard AES S-box');
        
        // AES parameters
        this.Nb = 4; // Number of columns (32-bit words) in State (always 4 for AES)
        this.Nk = 4; // Number of 32-bit words in key (4 for AES-128)
        this.Nr = 10; // Number of rounds (10 for AES-128)
        
        // Current encryption state
        this.state = null; // 4x4 state matrix
        this.roundKeys = null; // Expanded round keys
        this.currentRound = 0;
        this.currentStep = 'initial'; // 'initial', 'addroundkey', 'subbytes', 'shiftrows', 'mixcolumns'
        this.stepHistory = [];
        this.isComplete = false;
        
        // MixColumns constant matrix
        this.mixMatrix = [
            [0x02, 0x03, 0x01, 0x01],
            [0x01, 0x02, 0x03, 0x01],
            [0x01, 0x01, 0x02, 0x03],
            [0x03, 0x01, 0x01, 0x02]
        ];
    }

    // Standard AES S-box for fallback
    getStandardAESSBox() {
        return [
            0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
            0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
            0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
            0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
            0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
            0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
            0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
            0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
            0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
            0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
            0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
            0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
            0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
            0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
            0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
            0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
        ];
    }

    // Initialize encryption with plaintext and key
    initializeEncryption(plaintext, key) {
        // Reset state
        this.currentRound = 0;
        this.currentStep = 'initial';
        this.stepHistory = [];
        this.isComplete = false;
        
        // Validate inputs
        if (plaintext.length !== 16) {
            throw new Error('Plaintext must be exactly 16 bytes');
        }
        if (key.length !== 16) {
            throw new Error('Key must be exactly 16 bytes (AES-128)');
        }
        
        // Convert plaintext to 4x4 state matrix (column-major order)
        this.state = this.bytesToState(plaintext);
        
        // Generate round keys
        this.roundKeys = this.keyExpansion(key);
        
        // Record initial state
        this.recordStep('Initial State', this.cloneState());
        
        return {
            operation: 'Initialization Complete',
            round: this.currentRound,
            step: this.currentStep,
            state: this.cloneState(),
            stateHex: this.stateToHexGrid(this.state),
            description: 'Plaintext loaded into 4x4 state matrix (column-major order)'
        };
    }

    // Advance to next step in encryption
    nextStep() {
        if (this.isComplete) {
            return {
                operation: 'Encryption Complete',
                round: this.currentRound,
                step: this.currentStep,
                state: this.cloneState(),
                stateHex: this.stateToHexGrid(this.state),
                description: 'AES encryption is complete'
            };
        }

        let stepResult = {};

        switch (this.currentStep) {
            case 'initial':
                // Initial AddRoundKey (Round 0)
                stepResult = this.performAddRoundKey();
                this.currentRound++;
                this.currentStep = 'subbytes';
                break;
                
            case 'subbytes':
                stepResult = this.performSubBytes();
                this.currentStep = 'shiftrows';
                break;
                
            case 'shiftrows':
                stepResult = this.performShiftRows();
                if (this.currentRound < this.Nr) {
                    this.currentStep = 'mixcolumns';
                } else {
                    // Last round - skip MixColumns
                    this.currentStep = 'addroundkey';
                }
                break;
                
            case 'mixcolumns':
                stepResult = this.performMixColumns();
                this.currentStep = 'addroundkey';
                break;
                
            case 'addroundkey':
                stepResult = this.performAddRoundKey();
                if (this.currentRound < this.Nr) {
                    this.currentRound++;
                    this.currentStep = 'subbytes';
                } else {
                    this.isComplete = true;
                    stepResult.description = 'AES encryption completed successfully';
                }
                break;
        }

        return stepResult;
    }

    // AddRoundKey operation
    performAddRoundKey() {
        const roundKey = this.getRoundKey(this.currentRound);
        
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                this.state[row][col] ^= roundKey[row][col];
            }
        }
        
        const result = {
            operation: 'AddRoundKey',
            round: this.currentRound,
            step: 'addroundkey',
            state: this.cloneState(),
            stateHex: this.stateToHexGrid(this.state),
            roundKey: this.stateToHexGrid(roundKey),
            description: `XOR state with round ${this.currentRound} key`
        };
        
        this.recordStep(`Round ${this.currentRound} - AddRoundKey`, this.cloneState());
        return result;
    }

    // SubBytes operation (uses injected S-box)
    performSubBytes() {
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                this.state[row][col] = this.sbox[this.state[row][col]];
            }
        }
        
        const result = {
            operation: 'SubBytes',
            round: this.currentRound,
            step: 'subbytes',
            state: this.cloneState(),
            stateHex: this.stateToHexGrid(this.state),
            description: `Apply S-box substitution to each byte (using ${this.isCustomSBox() ? 'custom' : 'standard'} S-box)`
        };
        
        this.recordStep(`Round ${this.currentRound} - SubBytes`, this.cloneState());
        return result;
    }

    // ShiftRows operation
    performShiftRows() {
        const newState = this.createEmptyState();
        
        // Row 0: no shift
        for (let col = 0; col < 4; col++) {
            newState[0][col] = this.state[0][col];
        }
        
        // Row 1: shift left by 1
        for (let col = 0; col < 4; col++) {
            newState[1][col] = this.state[1][(col + 1) % 4];
        }
        
        // Row 2: shift left by 2
        for (let col = 0; col < 4; col++) {
            newState[2][col] = this.state[2][(col + 2) % 4];
        }
        
        // Row 3: shift left by 3
        for (let col = 0; col < 4; col++) {
            newState[3][col] = this.state[3][(col + 3) % 4];
        }
        
        this.state = newState;
        
        const result = {
            operation: 'ShiftRows',
            round: this.currentRound,
            step: 'shiftrows',
            state: this.cloneState(),
            stateHex: this.stateToHexGrid(this.state),
            description: 'Cyclically shift rows: row 0 (no shift), row 1 (left 1), row 2 (left 2), row 3 (left 3)'
        };
        
        this.recordStep(`Round ${this.currentRound} - ShiftRows`, this.cloneState());
        return result;
    }

    // MixColumns operation
    performMixColumns() {
        const newState = this.createEmptyState();
        
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                newState[row][col] = 
                    this.galoisMultiply(this.mixMatrix[row][0], this.state[0][col]) ^
                    this.galoisMultiply(this.mixMatrix[row][1], this.state[1][col]) ^
                    this.galoisMultiply(this.mixMatrix[row][2], this.state[2][col]) ^
                    this.galoisMultiply(this.mixMatrix[row][3], this.state[3][col]);
            }
        }
        
        this.state = newState;
        
        const result = {
            operation: 'MixColumns',
            round: this.currentRound,
            step: 'mixcolumns',
            state: this.cloneState(),
            stateHex: this.stateToHexGrid(this.state),
            description: 'Matrix multiplication in GF(2^8) with fixed polynomial matrix'
        };
        
        this.recordStep(`Round ${this.currentRound} - MixColumns`, this.cloneState());
        return result;
    }

    // Galois Field multiplication in GF(2^8)
    galoisMultiply(a, b) {
        let result = 0;
        for (let i = 0; i < 8; i++) {
            if (b & 1) {
                result ^= a;
            }
            const carry = a & 0x80;
            a <<= 1;
            if (carry) {
                a ^= 0x1B; // AES irreducible polynomial
            }
            b >>= 1;
        }
        return result & 0xFF;
    }

    // Key expansion for AES-128
    keyExpansion(key) {
        const expandedKey = new Array(this.Nb * (this.Nr + 1) * 4);
        
        // Copy original key
        for (let i = 0; i < key.length; i++) {
            expandedKey[i] = key[i];
        }
        
        // Expand key
        for (let i = this.Nk; i < this.Nb * (this.Nr + 1); i++) {
            let temp = [
                expandedKey[(i - 1) * 4],
                expandedKey[(i - 1) * 4 + 1],
                expandedKey[(i - 1) * 4 + 2],
                expandedKey[(i - 1) * 4 + 3]
            ];
            
            if (i % this.Nk === 0) {
                // RotWord
                const t = temp[0];
                temp[0] = temp[1];
                temp[1] = temp[2];
                temp[2] = temp[3];
                temp[3] = t;
                
                // SubWord
                temp[0] = this.sbox[temp[0]];
                temp[1] = this.sbox[temp[1]];
                temp[2] = this.sbox[temp[2]];
                temp[3] = this.sbox[temp[3]];
                
                // XOR with Rcon
                temp[0] ^= this.getRcon(Math.floor(i / this.Nk));
            }
            
            expandedKey[i * 4] = expandedKey[(i - this.Nk) * 4] ^ temp[0];
            expandedKey[i * 4 + 1] = expandedKey[(i - this.Nk) * 4 + 1] ^ temp[1];
            expandedKey[i * 4 + 2] = expandedKey[(i - this.Nk) * 4 + 2] ^ temp[2];
            expandedKey[i * 4 + 3] = expandedKey[(i - this.Nk) * 4 + 3] ^ temp[3];
        }
        
        return expandedKey;
    }

    // Get round constant for key expansion
    getRcon(round) {
        const rcon = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1B, 0x36];
        return rcon[round - 1] || 0x00;
    }

    // Get round key as 4x4 matrix
    getRoundKey(round) {
        const roundKey = this.createEmptyState();
        const start = round * 16;
        
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                roundKey[row][col] = this.roundKeys[start + col * 4 + row];
            }
        }
        
        return roundKey;
    }

    // Generate inverse S-box for decryption
    generateInverseSBox() {
        console.log('Generating inverse S-box...');
        console.log('Current S-box first 10 values:', this.sbox.slice(0, 10));
        
        const inverseSBox = new Array(256);
        const usedValues = new Set();
        
        // Check if S-box is a valid permutation
        for (let i = 0; i < 256; i++) {
            const value = this.sbox[i];
            
            if (value === undefined || value === null) {
                console.error(`S-box has undefined value at index ${i}`);
                return null;
            }
            
            if (value < 0 || value > 255) {
                console.error(`S-box has invalid value ${value} at index ${i}`);
                return null;
            }
            
            if (usedValues.has(value)) {
                console.error(`S-box has duplicate value ${value} at index ${i}`);
                return null;
            }
            
            usedValues.add(value);
            inverseSBox[value] = i;
        }
        
        // Check if all values 0-255 are present
        if (usedValues.size !== 256) {
            console.error(`S-box is not a valid permutation. Missing values:`, 
                Array.from({length: 256}, (_, i) => i).filter(i => !usedValues.has(i)));
            return null;
        }
        
        console.log('Inverse S-box generated successfully');
        console.log('Inverse S-box first 10 values:', inverseSBox.slice(0, 10));
        return inverseSBox;
    }

    // Initialize decryption with ciphertext and key
    initializeDecryption(ciphertext, key) {
        // Reset state
        this.currentRound = this.Nr;
        this.currentStep = 'initial';
        this.stepHistory = [];
        this.isComplete = false;
        this.isDecryption = true;
        
        // Validate inputs
        if (ciphertext.length !== 16) {
            throw new Error('Ciphertext must be exactly 16 bytes');
        }
        if (key.length !== 16) {
            throw new Error('Key must be exactly 16 bytes (AES-128)');
        }
        
        // Convert ciphertext to 4x4 state matrix (column-major order)
        this.state = this.bytesToState(ciphertext);
        
        // Generate round keys (same as encryption)
        this.roundKeys = this.keyExpansion(key);
        
        // Generate inverse S-box
        this.inverseSBox = this.generateInverseSBox();
        
        // Check if inverse S-box generation failed
        if (!this.inverseSBox) {
            throw new Error('Cannot generate inverse S-box. The S-box must be a valid permutation (contain all values 0-255 exactly once).');
        }
        
        // Record initial state
        this.recordStep('Initial Ciphertext', this.cloneState());
        
        return {
            operation: 'Decryption Initialization Complete',
            round: this.currentRound,
            step: this.currentStep,
            state: this.cloneState(),
            stateHex: this.stateToHexGrid(this.state),
            description: 'Ciphertext loaded into 4x4 state matrix for decryption'
        };
    }

    // Advance to next step in decryption
    nextDecryptionStep() {
        if (this.isComplete) {
            return {
                operation: 'Decryption Complete',
                round: this.currentRound,
                step: this.currentStep,
                state: this.cloneState(),
                stateHex: this.stateToHexGrid(this.state),
                description: 'AES decryption is complete',
                plaintext: this.stateToBytes(this.state)
            };
        }

        let result;

        // Decryption follows reverse order of encryption
        switch (this.currentStep) {
            case 'initial':
                // Start with AddRoundKey using the last round key (Round 10)
                result = this.performDecryptAddRoundKey();
                this.currentStep = 'invshiftrows';
                break;

            case 'invshiftrows':
                result = this.performInvShiftRows();
                this.currentStep = 'invsubbytes';
                break;

            case 'invsubbytes':
                result = this.performInvSubBytes();
                this.currentRound--;
                
                if (this.currentRound > 0) {
                    this.currentStep = 'invaddroundkey';
                } else {
                    // Final AddRoundKey with original key (round 0)
                    result = this.performDecryptAddRoundKey();
                    this.isComplete = true;
                    result.description = 'AES decryption completed successfully';
                }
                break;

            case 'invaddroundkey':
                result = this.performDecryptAddRoundKey();
                this.currentStep = 'invmixcolumns';
                break;

            case 'invmixcolumns':
                result = this.performInvMixColumns();
                this.currentStep = 'invshiftrows';
                break;

            default:
                this.isComplete = true;
                return this.nextDecryptionStep();
        }

        this.recordStep(result.operation, this.cloneState());
        return result;
    }

    // Inverse SubBytes operation
    performInvSubBytes() {
        if (!this.inverseSBox) {
            throw new Error('Inverse S-box not available for decryption');
        }
        
        const newState = this.cloneState();
        
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const currentValue = this.state[r][c];
                if (currentValue === undefined || this.inverseSBox[currentValue] === undefined) {
                    console.error(`performInvSubBytes: Cannot find inverse for value ${currentValue} at state[${r}][${c}]`);
                    throw new Error(`Inverse S-box lookup failed for value ${currentValue}`);
                }
                newState[r][c] = this.inverseSBox[currentValue];
            }
        }
        
        this.state = newState;
        
        return {
            operation: `Inverse SubBytes (Round ${this.currentRound})`,
            round: this.currentRound,
            step: this.currentStep,
            state: this.cloneState(),
            stateHex: this.stateToHexGrid(this.state),
            description: 'Applied inverse S-box substitution to each byte in the state matrix'
        };
    }

    // Inverse ShiftRows operation
    performInvShiftRows() {
        const newState = this.cloneState();
        
        // Inverse shift rows (shift right instead of left)
        // Row 0: no shift
        // Row 1: shift right by 1
        newState[1] = [this.state[1][3], this.state[1][0], this.state[1][1], this.state[1][2]];
        // Row 2: shift right by 2
        newState[2] = [this.state[2][2], this.state[2][3], this.state[2][0], this.state[2][1]];
        // Row 3: shift right by 3
        newState[3] = [this.state[3][1], this.state[3][2], this.state[3][3], this.state[3][0]];
        
        this.state = newState;
        
        return {
            operation: `Inverse ShiftRows (Round ${this.currentRound})`,
            round: this.currentRound,
            step: this.currentStep,
            state: this.cloneState(),
            stateHex: this.stateToHexGrid(this.state),
            description: 'Shifted rows right: row 0→0, row 1→1, row 2→2, row 3→3'
        };
    }

    // Inverse MixColumns operation
    performInvMixColumns() {
        const newState = this.cloneState();
        
        // Inverse MixColumns matrix
        const invMixMatrix = [
            [0x0e, 0x0b, 0x0d, 0x09],
            [0x09, 0x0e, 0x0b, 0x0d],
            [0x0d, 0x09, 0x0e, 0x0b],
            [0x0b, 0x0d, 0x09, 0x0e]
        ];
        
        for (let c = 0; c < 4; c++) {
            const column = [this.state[0][c], this.state[1][c], this.state[2][c], this.state[3][c]];
            
            for (let r = 0; r < 4; r++) {
                newState[r][c] = 
                    this.galoisMultiply(invMixMatrix[r][0], column[0]) ^
                    this.galoisMultiply(invMixMatrix[r][1], column[1]) ^
                    this.galoisMultiply(invMixMatrix[r][2], column[2]) ^
                    this.galoisMultiply(invMixMatrix[r][3], column[3]);
            }
        }
        
        this.state = newState;
        
        return {
            operation: `Inverse MixColumns (Round ${this.currentRound})`,
            round: this.currentRound,
            step: this.currentStep,
            state: this.cloneState(),
            stateHex: this.stateToHexGrid(this.state),
            description: 'Applied inverse MixColumns transformation to each column'
        };
    }

    // Decryption AddRoundKey (same as encryption)
    performDecryptAddRoundKey() {
        const newState = this.cloneState();
        const roundKey = this.getRoundKey(this.currentRound);
        
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                newState[r][c] = this.state[r][c] ^ roundKey[r][c];
            }
        }
        
        this.state = newState;
        
        const operation = this.currentRound === this.Nr ? 
            'Initial AddRoundKey (Decryption)' : 
            `AddRoundKey (Round ${this.currentRound})`;
        
        return {
            operation: operation,
            round: this.currentRound,
            step: this.currentStep,
            state: this.cloneState(),
            stateHex: this.stateToHexGrid(this.state),
            description: `XORed state with round key ${this.currentRound}`
        };
    }

    // Convert decrypted state back to text
    decryptedStateToText() {
        if (!this.state) return '';
        
        const bytes = this.stateToBytes(this.state);
        const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
        
        try {
            // Convert bytes to text and remove null padding
            let text = decoder.decode(new Uint8Array(bytes));
            return text.replace(/\0+$/, ''); // Remove trailing null bytes
        } catch (e) {
            // If UTF-8 decoding fails, return hex representation
            return bytes.map(b => String.fromCharCode(b)).join('').replace(/\0+$/, '');
        }
    }

    // Complete decryption process in one go
    completeDecryption(ciphertext, key) {
        this.initializeDecryption(ciphertext, key);
        
        const steps = [];
        while (!this.isComplete) {
            const step = this.nextDecryptionStep();
            steps.push(step);
        }
        
        return {
            steps: steps,
            plaintext: this.stateToBytes(this.state),
            plaintextHex: this.stateToHexString(this.state),
            plaintextText: this.decryptedStateToText()
        };
    }

    // Utility functions
    bytesToState(bytes) {
        const state = this.createEmptyState();
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                state[row][col] = bytes[col * 4 + row];
            }
        }
        return state;
    }

    stateToBytes(state) {
        if (!state) {
            console.error('stateToBytes: state is null/undefined');
            return new Array(16).fill(0);
        }
        
        const bytes = new Array(16);
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 4; row++) {
                if (!state[row] || state[row][col] === undefined) {
                    console.error(`stateToBytes: state[${row}][${col}] is undefined`);
                    bytes[col * 4 + row] = 0;
                } else {
                    bytes[col * 4 + row] = state[row][col];
                }
            }
        }
        return bytes;
    }

    createEmptyState() {
        return Array(4).fill().map(() => Array(4).fill(0));
    }

    cloneState() {
        return this.state.map(row => [...row]);
    }

    recordStep(description, state) {
        this.stepHistory.push({
            step: this.stepHistory.length + 1,
            description: description,
            state: state.map(row => [...row]),
            timestamp: Date.now()
        });
    }

    // Format state as hex grid for frontend display
    stateToHexGrid(state) {
        return state.map(row => 
            row.map(byte => 
                byte.toString(16).padStart(2, '0').toUpperCase()
            )
        );
    }

    // Format state as single hex string
    stateToHexString(state) {
        if (!state) {
            console.error('stateToHexString: state is null/undefined');
            return 'ERROR: No state';
        }
        
        try {
            const bytes = this.stateToBytes(state);
            return bytes
                .map(byte => {
                    if (byte === undefined || byte === null) {
                        console.error('stateToHexString: found undefined/null byte');
                        return 'XX';
                    }
                    return byte.toString(16).padStart(2, '0').toUpperCase();
                })
                .join(' ');
        } catch (error) {
            console.error('stateToHexString error:', error);
            return 'ERROR: ' + error.message;
        }
    }

    // Check if using custom S-box
    isCustomSBox() {
        const standardSBox = this.getStandardAESSBox();
        return JSON.stringify(this.sbox) !== JSON.stringify(standardSBox);
    }

    // Get current encryption status
    getStatus() {
        return {
            round: this.currentRound,
            step: this.currentStep,
            totalRounds: this.Nr,
            isComplete: this.isComplete,
            progress: this.calculateProgress(),
            nextOperation: this.getNextOperation(),
            usingCustomSBox: this.isCustomSBox()
        };
    }

    // Calculate progress percentage
    calculateProgress() {
        if (this.isComplete) return 100;
        
        // Total operations: Initial AddRoundKey + 9 full rounds + final round
        // Full round: SubBytes, ShiftRows, MixColumns, AddRoundKey (4 ops)
        // Final round: SubBytes, ShiftRows, AddRoundKey (3 ops)
        // Total: 1 + (9 * 4) + 3 = 40 operations
        
        const totalOperations = 1 + (this.Nr - 1) * 4 + 3;
        let currentOperation = 1; // Initial AddRoundKey
        
        if (this.currentRound > 0) {
            currentOperation += (this.currentRound - 1) * 4;
            
            switch (this.currentStep) {
                case 'subbytes': currentOperation += 1; break;
                case 'shiftrows': currentOperation += 2; break;
                case 'mixcolumns': currentOperation += 3; break;
                case 'addroundkey': currentOperation += 4; break;
            }
        }
        
        return Math.round((currentOperation / totalOperations) * 100);
    }

    // Get description of next operation
    getNextOperation() {
        if (this.isComplete) return 'Encryption Complete';
        
        switch (this.currentStep) {
            case 'initial': return 'AddRoundKey (Initial)';
            case 'addroundkey': 
                if (this.currentRound < this.Nr) return 'SubBytes';
                return 'Encryption Complete';
            case 'subbytes': return 'ShiftRows';
            case 'shiftrows': 
                if (this.currentRound < this.Nr - 1) return 'MixColumns';
                return 'AddRoundKey (Final)';
            case 'mixcolumns': return 'AddRoundKey';
            default: return 'Unknown';
        }
    }

    // Get complete step history
    getStepHistory() {
        return this.stepHistory;
    }

    // Reset encryption to beginning
    reset() {
        this.state = null;
        this.roundKeys = null;
        this.currentRound = 0;
        this.currentStep = 'initial';
        this.stepHistory = [];
        this.isComplete = false;
    }

    // Update S-box (allows changing during visualization)
    updateSBox(newSBox) {
        if (!newSBox || newSBox.length !== 256) {
            throw new Error('S-box must be an array of exactly 256 values');
        }
        this.sbox = [...newSBox];
    }

    // Export current state for debugging
    exportState() {
        return {
            state: this.state,
            round: this.currentRound,
            step: this.currentStep,
            isComplete: this.isComplete,
            sboxType: this.isCustomSBox() ? 'custom' : 'standard',
            stateHex: this.state ? this.stateToHexGrid(this.state) : null,
            stateString: this.state ? this.stateToHexString(this.state) : null
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AESVisualizer;
} else if (typeof window !== 'undefined') {
    window.AESVisualizer = AESVisualizer;
}
