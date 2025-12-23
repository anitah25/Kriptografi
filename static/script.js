// S-Box Analysis Dashboard - Main JavaScript
class SBoxDashboard {
    constructor() {
        // Global variable to store current S-box
        this.currentSBox = null;
        this.isLoaded = false;
        
        // Initialize the dashboard
        this.init();
    }

    // Initialize event listeners and setup
    init() {
        this.setupEventListeners();
        this.initializeGrid();
        this.populateAffineMatrices();
        this.updateStatus('No S-box loaded');
    }

    // Setup all event listeners
    setupEventListeners() {
        // File upload handler
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });

        // Generate random S-box
        document.getElementById('generateRandomSbox').addEventListener('click', () => {
            this.generateRandomSBox();
        });

        // Load standard AES S-box
        document.getElementById('loadStandardSbox').addEventListener('click', () => {
            this.loadStandardAESSBox();
        });

        // Generate Affine S-box
        document.getElementById('generateAffineSbox').addEventListener('click', () => {
            this.generateAffineSBox();
        });

        // Clear S-box
        document.getElementById('clearSbox').addEventListener('click', () => {
            this.clearSBox();
        });

        // Analysis event listeners
        document.getElementById('runAnalysis').addEventListener('click', () => {
            this.runAnalysis();
        });

        document.getElementById('exportAnalysis').addEventListener('click', () => {
            this.exportAnalysis();
        });

        document.getElementById('clearAnalysis').addEventListener('click', () => {
            this.clearAnalysisResults();
        });
    }

    // Handle file upload (Excel/CSV)
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileInfo = document.getElementById('fileInfo');
        fileInfo.textContent = `Loading ${file.name}...`;
        fileInfo.classList.add('show');

        try {
            let sboxData;
            
            if (file.name.toLowerCase().endsWith('.csv')) {
                sboxData = await this.parseCSVFile(file);
            } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
                sboxData = await this.parseExcelFile(file);
            } else {
                throw new Error('Unsupported file format. Please use CSV or Excel files.');
            }

            this.currentSBox = sboxData;
            console.log('File uploaded - S-box loaded:', sboxData.length, 'values, first few:', sboxData.slice(0, 10));
            this.renderSBoxGrid(sboxData);
            this.updateStatus(`Loaded from ${file.name} (${sboxData.length} values)`);
            fileInfo.textContent = `✓ Successfully loaded ${file.name}`;
            fileInfo.classList.add('success');

            // Save to localStorage
            this.saveSBoxToStorage(sboxData, `upload_${file.name}`);

        } catch (error) {
            console.error('File parsing error:', error);
            fileInfo.textContent = `✗ Error: ${error.message}`;
            fileInfo.classList.add('error');
            this.updateStatus('Error loading file');
        }

        // Reset file input
        event.target.value = '';
    }

    // Parse CSV file into S-box array
    async parseCSVFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const values = [];
                    
                    // Split by lines and then by commas
                    const lines = text.split(/\r?\n/);
                    
                    for (const line of lines) {
                        if (line.trim()) {
                            const rowValues = line.split(',').map(val => val.trim());
                            for (const val of rowValues) {
                                if (val) {
                                    const num = this.parseValue(val);
                                    if (num !== null) {
                                        values.push(num);
                                    }
                                }
                            }
                        }
                    }

                    if (values.length !== 256) {
                        reject(new Error(`Expected 256 values, found ${values.length}`));
                        return;
                    }

                    this.validateSBoxValues(values);
                    resolve(values);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read CSV file'));
            reader.readAsText(file);
        });
    }

    // Parse Excel file using SheetJS
    async parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Get the first worksheet
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // Convert to array of arrays
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    // Flatten the array and extract values
                    const values = [];
                    for (const row of jsonData) {
                        for (const cell of row) {
                            if (cell !== null && cell !== undefined && cell !== '') {
                                const num = this.parseValue(cell);
                                if (num !== null) {
                                    values.push(num);
                                }
                            }
                        }
                    }

                    if (values.length !== 256) {
                        reject(new Error(`Expected 256 values, found ${values.length}`));
                        return;
                    }

                    this.validateSBoxValues(values);
                    resolve(values);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read Excel file'));
            reader.readAsArrayBuffer(file);
        });
    }

    // Parse individual value (handles hex and decimal)
    parseValue(value) {
        if (typeof value === 'number') {
            return Math.round(value);
        }
        
        const str = value.toString().trim();
        if (!str) return null;
        
        let num;
        
        // Try hex parsing first (with or without 0x prefix)
        if (str.toLowerCase().startsWith('0x')) {
            num = parseInt(str, 16);
        } else if (/^[0-9a-f]+$/i.test(str) && str.length <= 2) {
            num = parseInt(str, 16);
        } else {
            num = parseInt(str, 10);
        }
        
        return isNaN(num) ? null : num;
    }

    // Validate S-box values
    validateSBoxValues(values) {
        console.log('Validating S-box values, length:', values.length);
        console.log('First 10 values:', values.slice(0, 10));
        console.log('Last 10 values:', values.slice(-10));
        
        // Check length
        if (values.length !== 256) {
            throw new Error(`S-box must contain exactly 256 values, found ${values.length}`);
        }
        
        // Check range and uniqueness
        const seen = new Set();
        for (let i = 0; i < values.length; i++) {
            const val = values[i];
            
            if (!Number.isInteger(val) || val < 0 || val > 255) {
                console.error(`Invalid value at position ${i}: ${val}`);
                throw new Error(`Invalid value at position ${i}: ${val}. Must be integer 0-255.`);
            }
            
            if (seen.has(val)) {
                console.error(`Duplicate value ${val} found at position ${i}`);
                throw new Error(`Duplicate value ${val} at position ${i}. S-box must be a permutation (all values 0-255 exactly once).`);
            }
            
            seen.add(val);
        }
        
        // Check if all values 0-255 are present
        const missingValues = [];
        for (let i = 0; i < 256; i++) {
            if (!seen.has(i)) {
                missingValues.push(i);
            }
        }
        
        if (missingValues.length > 0) {
            console.error('Missing values:', missingValues);
            throw new Error(`S-box is missing values: ${missingValues.slice(0, 10).join(', ')}${missingValues.length > 10 ? '...' : ''}. S-box must contain all values 0-255.`);
        }
        
        console.log('S-box validation passed! Valid permutation detected.');
    }

    // Generate S-Box using Affine Transformation (AES Construction)
    populateAffineMatrices() {
        const select = document.getElementById('affineMatrixSelect');
        if (!select) return;
        
        select.innerHTML = '';
        this.affineMatrices = []; // Store the seeds
        
        let count = 0;
        for (let i = 1; i < 256; i++) {
            if (this.isMatrixInvertible(i)) {
                count++;
                this.affineMatrices.push(i);
                const option = document.createElement('option');
                option.value = i;
                // Format as "K1: 0x01 (00000001)"
                const hex = i.toString(16).toUpperCase().padStart(2, '0');
                const bin = i.toString(2).padStart(8, '0');
                option.textContent = `K${count}: 0x${hex} (${bin})`;
                select.appendChild(option);
            }
        }
        
        // Default to K1
        if (select.options.length > 0) {
            select.selectedIndex = 0;
        }
    }

    isMatrixInvertible(seed) {
        // Create 8x8 matrix from seed (circulant with Rotate Right)
        let matrix = [];
        let row = seed;
        for (let i = 0; i < 8; i++) {
            matrix.push(row);
            // Rotate right for next row (Paper's method)
            row = ((row >>> 1) | (row << 7)) & 0xFF;
        }
        
        // Gaussian elimination over GF(2)
        let n = 8;
        let m = [...matrix]; // Copy
        
        for (let i = 0; i < n; i++) {
            // Find pivot
            let pivot = -1;
            for (let j = i; j < n; j++) {
                if ((m[j] >> i) & 1) { // Check bit i (LSB aligned with column i)
                    pivot = j;
                    break;
                }
            }
            
            if (pivot === -1) return false; // Singular
            
            // Swap rows
            [m[i], m[pivot]] = [m[pivot], m[i]];
            
            // Eliminate
            for (let j = 0; j < n; j++) {
                if (i !== j && ((m[j] >> i) & 1)) {
                    m[j] ^= m[i];
                }
            }
        }
        
        return true;
    }

    generateAffineSBox() {
        try {
            const select = document.getElementById('affineMatrixSelect');
            const seed = parseInt(select.value);
            
            const constantInput = document.getElementById('affineConstant');
            const constant = parseInt(constantInput.value, 16);
            
            if (isNaN(seed)) {
                alert('Please select an affine matrix first.');
                return;
            }
            
            if (isNaN(constant)) {
                alert('Invalid additive constant. Please enter a hex value.');
                return;
            }

            const sbox = new Array(256);
            
            for (let i = 0; i < 256; i++) {
                // 1. Multiplicative Inverse in GF(2^8)
                let inverse = this.gf28Inverse(i);
                
                // 2. Affine Transformation with selected matrix and constant
                sbox[i] = this.affineTransform(inverse, seed, constant);
            }
            
            this.currentSBox = sbox;
            this.renderSBoxGrid(sbox);
            
            const kIndex = this.affineMatrices.indexOf(seed) + 1;
            const constHex = constant.toString(16).toUpperCase().padStart(2, '0');
            this.updateStatus(`Generated using Affine Matrix K${kIndex} + 0x${constHex}`);
            this.saveSBoxToStorage(sbox, `affine_K${kIndex}_${constHex}`);
            
        } catch (error) {
            console.error('Error generating affine S-box:', error);
            alert('Error generating S-box');
        }
    }

    // Calculate multiplicative inverse in GF(2^8)
    gf28Inverse(b) {
        if (b === 0) return 0;
        // Using exponentiation: a^-1 = a^254 in GF(2^8)
        return this.gf28Pow(b, 254);
    }

    // GF(2^8) multiplication
    gf28Mul(a, b) {
        let p = 0;
        for (let i = 0; i < 8; i++) {
            if ((b & 1) !== 0) {
                p ^= a;
            }
            let hiBitSet = (a & 0x80) !== 0;
            a = (a << 1) & 0xFF;
            if (hiBitSet) {
                a ^= 0x1B; // x^8 + x^4 + x^3 + x + 1 reduced
            }
            b >>= 1;
        }
        return p & 0xFF;
    }

    // GF(2^8) exponentiation
    gf28Pow(base, exp) {
        let res = 1;
        while (exp > 0) {
            if ((exp & 1) !== 0) {
                res = this.gf28Mul(res, base);
            }
            base = this.gf28Mul(base, base);
            exp >>= 1;
        }
        return res;
    }

    // Bit reverse an 8-bit value
    bitReverse(b) {
        let result = 0;
        for (let i = 0; i < 8; i++) {
            if (b & (1 << i)) {
                result |= (1 << (7 - i));
            }
        }
        return result;
    }

    // Affine Transformation
    affineTransform(b, seed, constant = 0x63) {
        // The paper uses matrix notation where column 0 is LEFTMOST
        // But binary integers store bit 0 as RIGHTMOST
        // So we need to bit-reverse the input for correct multiplication
        let bRev = this.bitReverse(b);
        
        let result = 0;
        let row = seed; // Row 0
        
        for (let i = 0; i < 8; i++) {
            // Calculate parity of (row & bRev)
            let product = row & bRev;
            let parity = 0;
            while (product) {
                parity ^= (product & 1);
                product >>= 1;
            }
            
            if (parity) {
                result |= (1 << i); // Set bit i
            }
            
            // Rotate row right for next bit
            row = ((row >>> 1) | (row << 7)) & 0xFF;
        }
        
        // XOR with constant
        return (result ^ constant) & 0xFF;
    }

    // Generate random S-box
    generateRandomSBox() {
        // Create array with values 0-255
        const sbox = Array.from({ length: 256 }, (_, i) => i);
        
        // Fisher-Yates shuffle
        for (let i = sbox.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sbox[i], sbox[j]] = [sbox[j], sbox[i]];
        }
        
        this.currentSBox = sbox;
        this.renderSBoxGrid(sbox);
        this.updateStatus('Generated random S-box');
        
        // Save to localStorage
        this.saveSBoxToStorage(sbox, 'random_' + Date.now());
    }

    // Load standard AES S-box
    loadStandardAESSBox() {
        // Standard AES S-box
        const standardSBox = [
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
        
        this.currentSBox = standardSBox;
        console.log('Standard AES S-box loaded, first few values:', standardSBox.slice(0, 10));
        this.renderSBoxGrid(standardSBox);
        this.updateStatus('Loaded standard AES S-box');
        
        // Save to localStorage
        this.saveSBoxToStorage(standardSBox, 'standard_aes');
    }

    // Clear current S-box
    clearSBox() {
        this.currentSBox = null;
        this.initializeGrid();
        this.updateStatus('No S-box loaded');
        
        // Clear file info
        const fileInfo = document.getElementById('fileInfo');
        fileInfo.classList.remove('show', 'success', 'error');
        fileInfo.textContent = '';
        
        // Hide heatmap legend
        const legend = document.getElementById('heatmapLegend');
        if (legend) {
            legend.style.display = 'none';
        }
        
        // Remove from localStorage
        localStorage.removeItem('currentSBox');
        
        // Show toast
        if (window.showToast) {
            window.showToast('S-Box cleared', 'info');
        }
    }

    // Initialize empty 16x16 grid
    initializeGrid() {
        const grid = document.getElementById('sboxGrid');
        // Clear all content including text nodes
        while (grid.firstChild) {
            grid.removeChild(grid.firstChild);
        }
        
        // Create exactly 256 cells (16x16)
        for (let i = 0; i < 256; i++) {
            const cell = this.createCell('--', 'empty');
            cell.setAttribute('data-index', i);
            grid.appendChild(cell);
        }
    }

    // Create a grid cell element
    createCell(content, type) {
        const cell = document.createElement('div');
        cell.className = `grid-cell ${type}`;
        cell.textContent = content;
        return cell;
    }

    // Render S-box array into 16x16 grid with heatmap coloring
    renderSBoxGrid(sboxArray) {
        console.log('renderSBoxGrid called with array length:', sboxArray ? sboxArray.length : 'null');
        console.log('First 10 values to render:', sboxArray ? sboxArray.slice(0, 10) : 'null');
        
        if (!sboxArray || sboxArray.length !== 256) {
            console.error('Invalid S-box array');
            return;
        }
        
        const grid = document.getElementById('sboxGrid');
        const dataCells = grid.querySelectorAll('.grid-cell.data, .grid-cell.empty');
        
        console.log('Found grid cells:', dataCells.length);
        
        // Update each data cell with heatmap coloring
        dataCells.forEach((cell, index) => {
            const value = sboxArray[index];
            cell.textContent = value.toString(16).padStart(2, '0').toUpperCase();
            cell.className = 'grid-cell data';
            cell.setAttribute('data-value', value);
            
            // Apply heatmap coloring based on value
            const heatmapColor = this.getHeatmapColor(value);
            cell.style.backgroundColor = heatmapColor.bg;
            cell.style.color = heatmapColor.text;
            
            // Add tooltip with decimal and hex values
            cell.title = `Index: ${index} (0x${index.toString(16).padStart(2, '0')}) → Value: ${value} (0x${value.toString(16).padStart(2, '0')})`;
            
            // Add click handler for cell details
            cell.onclick = () => this.showCellDetails(index, value);
        });
        
        this.isLoaded = true;
        console.log('Grid rendering completed, isLoaded:', this.isLoaded);
        
        // Show heatmap legend
        const legend = document.getElementById('heatmapLegend');
        if (legend) {
            legend.style.display = 'flex';
        }
        
        // Show toast notification
        if (window.showToast) {
            window.showToast('S-Box loaded successfully!', 'success');
        }
    }
    
    // Generate heatmap color based on S-box value (0-255)
    getHeatmapColor(value) {
        // Normalize value to 0-1
        const normalized = value / 255;
        
        // Color gradient: Blue (low) -> Green (mid) -> Yellow -> Red (high)
        let r, g, b;
        
        if (normalized < 0.25) {
            // Blue to Cyan
            const t = normalized / 0.25;
            r = Math.round(240 + (224 - 240) * t);
            g = Math.round(248 + (242 - 248) * t);
            b = Math.round(255 + (246 - 255) * t);
        } else if (normalized < 0.5) {
            // Cyan to Green
            const t = (normalized - 0.25) / 0.25;
            r = Math.round(224 + (220 - 224) * t);
            g = Math.round(242 + (252 - 242) * t);
            b = Math.round(246 + (231 - 246) * t);
        } else if (normalized < 0.75) {
            // Green to Yellow/Orange
            const t = (normalized - 0.5) / 0.25;
            r = Math.round(220 + (254 - 220) * t);
            g = Math.round(252 + (240 - 252) * t);
            b = Math.round(231 + (217 - 231) * t);
        } else {
            // Yellow/Orange to Red/Pink
            const t = (normalized - 0.75) / 0.25;
            r = Math.round(254 + (254 - 254) * t);
            g = Math.round(240 + (215 - 240) * t);
            b = Math.round(217 + (215 - 217) * t);
        }
        
        // Determine text color based on background brightness
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const textColor = brightness > 128 ? '#1e293b' : '#ffffff';
        
        return {
            bg: `rgb(${r}, ${g}, ${b})`,
            text: textColor
        };
    }

    // Show cell details (optional feature)
    showCellDetails(index, value) {
        const row = Math.floor(index / 16);
        const col = index % 16;
        
        alert(`S-Box Details:
Position: Row ${row}, Col ${col} (Index: ${index})
Input: 0x${index.toString(16).padStart(2, '0')} (${index})
Output: 0x${value.toString(16).padStart(2, '0')} (${value})`);
    }

    // Update status display
    updateStatus(message) {
        document.getElementById('sboxStatus').textContent = message;
    }

    // Save S-box to localStorage
    saveSBoxToStorage(sboxArray, name) {
        try {
            const data = {
                sbox: sboxArray,
                name: name,
                timestamp: Date.now(),
                size: sboxArray.length
            };
            localStorage.setItem('currentSBox', JSON.stringify(data));
        } catch (error) {
            console.warn('Could not save to localStorage:', error);
        }
    }

    // Load S-box from localStorage
    loadSBoxFromStorage() {
        try {
            const data = localStorage.getItem('currentSBox');
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.sbox && parsed.sbox.length === 256) {
                    this.currentSBox = parsed.sbox;
                    this.renderSBoxGrid(parsed.sbox);
                    this.updateStatus(`Restored: ${parsed.name}`);
                    return true;
                }
            }
        } catch (error) {
            console.warn('Could not load from localStorage:', error);
        }
        return false;
    }

    // Export current S-box to various formats
    exportSBox(format = 'csv') {
        if (!this.currentSBox) {
            alert('No S-box loaded to export');
            return;
        }
        
        let content = '';
        let filename = `sbox_${Date.now()}`;
        let mimeType = 'text/plain';
        
        switch (format.toLowerCase()) {
            case 'csv':
                // Export as CSV (16x16 grid)
                for (let row = 0; row < 16; row++) {
                    const rowData = [];
                    for (let col = 0; col < 16; col++) {
                        const index = row * 16 + col;
                        rowData.push(this.currentSBox[index].toString(16).padStart(2, '0').toUpperCase());
                    }
                    content += rowData.join(',') + '\n';
                }
                filename += '.csv';
                mimeType = 'text/csv';
                break;
                
            case 'json':
                content = JSON.stringify({
                    name: 'Exported S-Box',
                    size: 256,
                    format: 'decimal',
                    exported: new Date().toISOString(),
                    sbox: this.currentSBox
                }, null, 2);
                filename += '.json';
                mimeType = 'application/json';
                break;
                
            case 'hex':
                // Export as space-separated hex values
                content = this.currentSBox.map(val => 
                    val.toString(16).padStart(2, '0').toUpperCase()
                ).join(' ');
                filename += '.txt';
                break;
        }
        
        // Create and trigger download
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Get current S-box (for external access)
    getCurrentSBox() {
        return this.currentSBox ? [...this.currentSBox] : null;
    }

    // Validate if S-box is a proper permutation
    isValidPermutation() {
        if (!this.currentSBox || this.currentSBox.length !== 256) {
            return false;
        }
        
        const seen = new Set();
        for (const value of this.currentSBox) {
            if (seen.has(value)) {
                return false; // Duplicate found
            }
            seen.add(value);
        }
        
        return seen.size === 256; // All values 0-255 present
    }

    // Get basic S-box statistics
    getStatistics() {
        if (!this.currentSBox) return null;
        
        const sbox = this.currentSBox;
        const stats = {
            size: sbox.length,
            min: Math.min(...sbox),
            max: Math.max(...sbox),
            isPermutation: this.isValidPermutation(),
            uniqueValues: new Set(sbox).size,
            duplicates: sbox.length - new Set(sbox).size
        };
        
        return stats;
    }

    // Run cryptographic analysis
    async runAnalysis() {
        if (!this.currentSBox) {
            if (window.showToast) {
                window.showToast('Please load an S-box before running analysis', 'warning');
            } else {
                alert('Please load an S-box before running analysis');
            }
            return;
        }

        try {
            // Update status to analyzing
            const statusEl = document.getElementById('analysisStatus');
            statusEl.innerHTML = '<span class="loading-spinner"></span> Running cryptographic analysis... This may take a moment.';
            statusEl.className = 'analysis-status analyzing';

            // Create analyzer instance
            const analyzer = new SBoxAnalyzer(this.currentSBox);
            
            // Run full analysis
            const results = await analyzer.runFullAnalysis();
            
            // Generate summary
            const summary = analyzer.generateSummary(results);
            
            // Display results
            this.displayAnalysisResults(results, summary);
            
            // Update status
            statusEl.innerHTML = '✅ Analysis complete!';
            statusEl.className = 'analysis-status complete';
            
            // Store results for export
            this.analysisResults = { results, summary };
            
            // Show toast notification
            if (window.showToast) {
                window.showToast('Analysis completed successfully!', 'success');
            }
            
            console.log('Analysis Results:', results);
            
        } catch (error) {
            console.error('Analysis error:', error);
            
            const statusEl = document.getElementById('analysisStatus');
            statusEl.textContent = `Analysis failed: ${error.message}`;
            statusEl.className = 'analysis-status error';
        }
    }

    // Display analysis results in the UI
    displayAnalysisResults(results, summary) {
        // Show results section
        document.getElementById('analysisResults').style.display = 'block';
        
        // Update individual values with color coding
        this.updateResultValue('bijectivityValue', results.bijectivity ? 'Yes' : 'No', (val) => val === 'Yes');
        this.updateResultValue('nlValue', results.nonlinearity, (val) => val >= 100);
        this.updateResultValue('sacValue', results.sac.score.toFixed(4), (val) => Math.abs(val - 0.5) <= 0.05);
        this.updateResultValue('bicNlValue', results.bicNL.minNonlinearity, (val) => val >= 100);
        this.updateResultValue('bicSacValue', results.bicSAC.averageSAC.toFixed(4), (val) => Math.abs(val - 0.5) <= 0.05);
        this.updateResultValue('lapValue', results.lap.maxLAP.toFixed(4), (val) => val <= 0.0625);
        this.updateResultValue('dapValue', results.dap.maxDAP.toFixed(6), (val) => val <= 0.016); // 4/256 approx
        this.updateResultValue('duValue', results.differentialUniformity, (val) => val <= 4);
        this.updateResultValue('adValue', results.algebraicDegree, (val) => val >= 7);
        this.updateResultValue('toValue', results.transparencyOrder ? results.transparencyOrder.toFixed(2) : 'N/A', () => true);
        this.updateResultValue('ciValue', results.correlationImmunity, (val) => val >= 1);
        
        // Display security summary
        this.displaySecuritySummary(summary);
    }

    // Update result value with color coding
    updateResultValue(elementId, value, isGoodFunction) {
        const element = document.getElementById(elementId);
        element.textContent = value;
        
        // Apply color coding based on quality
        element.className = 'result-value';
        
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            if (isGoodFunction(numValue)) {
                element.classList.add('good');
            } else if (numValue > 0) {
                element.classList.add('warning');
            } else {
                element.classList.add('poor');
            }
        }
    }

    // Display security summary
    displaySecuritySummary(summary) {
        const summaryEl = document.getElementById('securitySummary');
        
        summaryEl.innerHTML = `
            <h3>Security Assessment</h3>
            <div class="security-level ${summary.securityLevel.toLowerCase()}">${summary.securityLevel} Security</div>
            
            <div class="security-points">
                <div class="strengths">
                    <h4>Strengths</h4>
                    <ul class="security-list">
                        ${summary.strengths.map(strength => `<li>${strength}</li>`).join('')}
                    </ul>
                    ${summary.strengths.length === 0 ? '<p style="color: #718096; font-style: italic;">No notable strengths identified</p>' : ''}
                </div>
                
                <div class="weaknesses">
                    <h4>Weaknesses</h4>
                    <ul class="security-list">
                        ${summary.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                    </ul>
                    ${summary.weaknesses.length === 0 ? '<p style="color: #718096; font-style: italic;">No critical weaknesses identified</p>' : ''}
                </div>
            </div>
        `;
    }

    // Export analysis results
    exportAnalysis() {
        if (!this.analysisResults) {
            alert('No analysis results to export. Please run analysis first.');
            return;
        }

        const exportData = {
            timestamp: new Date().toISOString(),
            sbox: this.currentSBox,
            analysis: this.analysisResults.results,
            summary: this.analysisResults.summary
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sbox-analysis-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Clear analysis results
    clearAnalysisResults() {
        document.getElementById('analysisResults').style.display = 'none';
        document.getElementById('analysisStatus').textContent = 'No analysis performed yet';
        document.getElementById('analysisStatus').className = 'analysis-status';
        this.analysisResults = null;
    }

    // Get basic S-box statistics
    getStatistics() {
        if (!this.currentSBox) return null;
        
        const sbox = this.currentSBox;
        const stats = {
            size: sbox.length,
            min: Math.min(...sbox),
            max: Math.max(...sbox),
            isPermutation: this.isValidPermutation(),
            uniqueValues: new Set(sbox).size,
            duplicates: sbox.length - new Set(sbox).size
        };
        
        return stats;
    }
}

// AES Simulation Controller Extension
class AESSimulationController {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.visualizer = null;
        this.stepHistory = [];
        this.currentStepIndex = -1;
        this.isSimulationActive = false;
        this.setupSimulationEventListeners();
    }

    setupSimulationEventListeners() {
        // Mode switching buttons
        document.getElementById('mode-text').addEventListener('click', () => {
            this.switchInputMode('text');
        });
        
        document.getElementById('mode-hex').addEventListener('click', () => {
            this.switchInputMode('hex');
        });

        // Text input event listeners
        document.getElementById('plaintext-text').addEventListener('input', (e) => {
            this.updateTextPreview();
        });
        
        document.getElementById('key-text').addEventListener('input', (e) => {
            this.updateTextPreview();
        });

        // Simulation control buttons
        document.getElementById('sim-start').addEventListener('click', () => {
            this.startSimulation();
        });
        
        document.getElementById('sim-next').addEventListener('click', () => {
            this.nextStep();
        });
        
        document.getElementById('sim-prev').addEventListener('click', () => {
            this.previousStep();
        });
        
        document.getElementById('sim-reset').addEventListener('click', () => {
            this.resetSimulation();
        });

        // Input validation for hex fields
        document.getElementById('plaintext-input').addEventListener('input', (e) => {
            this.validateHexInput(e.target, 16);
        });
        
        document.getElementById('key-input').addEventListener('input', (e) => {
            this.validateHexInput(e.target, 16);
        });

        // Encryption result buttons
        document.getElementById('copy-ciphertext').addEventListener('click', () => {
            this.copyCiphertext();
        });
        
        document.getElementById('start-decryption').addEventListener('click', () => {
            this.switchToDecryptionMode();
        });
        
        document.getElementById('save-result').addEventListener('click', () => {
            this.saveEncryptionResult();
        });

        // Decryption control buttons
        document.getElementById('decrypt-start').addEventListener('click', () => {
            this.startDecryption();
        });
        
        document.getElementById('decrypt-reset').addEventListener('click', () => {
            this.resetDecryption();
        });
        
        document.getElementById('switch-to-encrypt').addEventListener('click', () => {
            this.switchToEncryptionMode();
        });

        // Decryption input validation
        document.getElementById('ciphertext-input').addEventListener('input', (e) => {
            this.validateHexInput(e.target, 16);
        });
        
        document.getElementById('decrypt-key-input').addEventListener('input', (e) => {
            this.validateHexInput(e.target, 16);
        });
    }

    // Switch input mode between text and hex
    switchInputMode(mode) {
        const textMode = document.getElementById('text-mode-inputs');
        const hexMode = document.getElementById('hex-mode-inputs');
        const textBtn = document.getElementById('mode-text');
        const hexBtn = document.getElementById('mode-hex');
        const preview = document.getElementById('conversion-preview');
        
        if (mode === 'text') {
            textMode.style.display = 'block';
            hexMode.style.display = 'none';
            textBtn.classList.add('active');
            hexBtn.classList.remove('active');
            preview.style.display = 'block';
            this.updateTextPreview();
        } else {
            textMode.style.display = 'none';
            hexMode.style.display = 'block';
            textBtn.classList.remove('active');
            hexBtn.classList.add('active');
            preview.style.display = 'none';
        }
    }

    // Convert text string to hex bytes (padded to 16 bytes)
    textToHex(text) {
        const encoder = new TextEncoder();
        let bytes = Array.from(encoder.encode(text));
        
        // Pad or truncate to exactly 16 bytes
        if (bytes.length > 16) {
            bytes = bytes.slice(0, 16);
        } else {
            while (bytes.length < 16) {
                bytes.push(0); // Null padding
            }
        }
        
        return bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
    }

    // Update preview when text input changes
    updateTextPreview() {
        const plaintextText = document.getElementById('plaintext-text').value;
        const keyText = document.getElementById('key-text').value;
        
        const plaintextHex = this.textToHex(plaintextText);
        const keyHex = this.textToHex(keyText);
        
        document.getElementById('preview-plaintext').textContent = plaintextHex;
        document.getElementById('preview-key').textContent = keyHex;
    }

    // Get current input values (auto-detect mode)
    getCurrentInputs() {
        const isTextMode = document.getElementById('mode-text').classList.contains('active');
        
        if (isTextMode) {
            const plaintextText = document.getElementById('plaintext-text').value || 'Hello World!';
            const keyText = document.getElementById('key-text').value || 'MySecretKey123';
            
            return {
                plaintext: this.textToHex(plaintextText),
                key: this.textToHex(keyText)
            };
        } else {
            return {
                plaintext: document.getElementById('plaintext-input').value.trim() || '32 43 f6 a8 88 5a 30 8d 31 31 98 a2 e0 37 07 34',
                key: document.getElementById('key-input').value.trim() || '2b 7e 15 16 28 ae d2 a6 ab f7 15 88 09 cf 4f 3c'
            };
        }
    }

    // Validate hex input fields
    validateHexInput(input, expectedBytes) {
        let value = input.value.replace(/[^0-9a-fA-F\s]/g, '');
        const bytes = value.split(/\s+/).filter(b => b.length > 0);
        
        // Add spaces for readability
        value = bytes.join(' ');
        input.value = value;
        
        // Check if we have the right number of bytes
        const isValid = bytes.length === expectedBytes && bytes.every(b => b.length === 2);
        input.style.borderColor = isValid || value === '' ? '#dee2e6' : '#dc3545';
    }

    // Parse hex string to byte array (universal method)
    parseHexString(hexString) {
        if (!hexString || typeof hexString !== 'string') return null;
        
        const value = hexString.trim();
        if (!value) return null;
        
        const bytes = value.split(/\s+/).filter(b => b.length > 0);
        if (bytes.length !== 16) {
            throw new Error('Must provide exactly 16 hex bytes');
        }
        
        return bytes.map(b => {
            const parsed = parseInt(b, 16);
            if (isNaN(parsed) || parsed < 0 || parsed > 255) {
                throw new Error(`Invalid hex byte: ${b}`);
            }
            return parsed;
        });
    }

    // Parse hex string to byte array (legacy method for hex inputs)
    parseHexInput(input) {
        return this.parseHexString(input.value);
    }

    // Start simulation
    startSimulation() {
        try {
            // Get input values based on current mode
            const inputs = this.getCurrentInputs();
            
            const plaintext = this.parseHexString(inputs.plaintext);
            const key = this.parseHexString(inputs.key);
            
            if (!plaintext || !key) {
                alert('Please enter valid plaintext and key');
                return;
            }

            // Create visualizer with current S-box (if loaded)
            const customSBox = this.dashboard.currentSBox;
            console.log('Dashboard currentSBox:', customSBox ? `Array length: ${customSBox.length}, first few values: [${customSBox.slice(0, 10).join(', ')}...]` : 'null');
            this.visualizer = new AESVisualizer(customSBox);
            
            // Initialize encryption
            const result = this.visualizer.initializeEncryption(plaintext, key);
            
            // Reset simulation state
            this.stepHistory = [result];
            this.currentStepIndex = 0;
            this.isSimulationActive = true;
            
            // Update UI
            this.updateSimulationDisplay(result);
            this.updateSBoxIndicator();
            this.updateControlButtons();
            
            console.log('AES Simulation started');
            
        } catch (error) {
            alert(`Error starting simulation: ${error.message}`);
        }
    }

    // Advance to next step
    nextStep() {
        if (!this.visualizer || this.visualizer.getStatus().isComplete) {
            return;
        }

        try {
            const result = this.visualizer.nextStep();
            this.stepHistory.push(result);
            this.currentStepIndex++;
            
            this.updateSimulationDisplay(result);
            this.updateControlButtons();
            
            // Check if encryption is complete
            if (this.visualizer.getStatus().isComplete) {
                this.showEncryptionResult();
            }
            
            // Special highlight for SubBytes operation
            if (result.operation && result.operation.includes('SubBytes')) {
                this.highlightSubBytesOperation();
            }
            
        } catch (error) {
            console.error('Error in next step:', error);
            alert(`Error: ${error.message}`);
        }
    }

    // Go back to previous step
    previousStep() {
        if (this.currentStepIndex <= 0) return;
        
        this.currentStepIndex--;
        const result = this.stepHistory[this.currentStepIndex];
        
        this.updateSimulationDisplay(result);
        this.updateControlButtons();
    }

    // Reset simulation
    resetSimulation() {
        this.visualizer = null;
        this.stepHistory = [];
        this.currentStepIndex = -1;
        this.isSimulationActive = false;
        
        // Reset UI
        this.clearStateMatrix();
        this.updateOperationDisplay('Ready to Start', '-', '0%');
        this.updateSBoxIndicator();
        this.clearStepHistory();
        this.updateControlButtons();
    }

    // Update simulation display
    updateSimulationDisplay(result) {
        this.updateStateMatrix(result.stateHex);
        this.updateOperationDisplay(result.operation, result.round, this.visualizer.getStatus().progress);
        this.addToStepHistory(result);
    }

    // Update state matrix visualization
    updateStateMatrix(stateHex) {
        const cells = document.querySelectorAll('.matrix-cell');
        
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const cellIndex = row * 4 + col;
                const cell = cells[cellIndex];
                
                if (cell && stateHex && stateHex[row] && stateHex[row][col]) {
                    cell.textContent = stateHex[row][col];
                    cell.classList.remove('changed', 'subbytes-highlight');
                }
            }
        }
    }

    // Highlight cells that changed
    highlightChangedCells() {
        const cells = document.querySelectorAll('.matrix-cell');
        cells.forEach(cell => {
            cell.classList.add('changed');
            setTimeout(() => cell.classList.remove('changed'), 500);
        });
    }

    // Special highlight for SubBytes operation
    highlightSubBytesOperation() {
        const cells = document.querySelectorAll('.matrix-cell');
        cells.forEach(cell => {
            cell.classList.add('subbytes-highlight');
            setTimeout(() => cell.classList.remove('subbytes-highlight'), 1000);
        });
    }

    // Update operation display
    updateOperationDisplay(operation, round, progress) {
        document.getElementById('current-operation').textContent = operation;
        document.getElementById('current-round').textContent = `Round: ${round}`;
        document.getElementById('operation-progress').textContent = `Progress: ${progress}%`;
    }

    // Update S-box indicator
    updateSBoxIndicator() {
        const typeElement = document.getElementById('sbox-type');
        if (this.dashboard.currentSBox) {
            console.log('S-box indicator: Using custom S-box, length:', this.dashboard.currentSBox.length);
            typeElement.textContent = 'Custom S-box';
            typeElement.className = 'indicator-type custom';
        } else {
            console.log('S-box indicator: Using standard AES S-box');
            typeElement.textContent = 'Standard AES';
            typeElement.className = 'indicator-type';
        }
    }

    // Add step to history
    addToStepHistory(result) {
        const historyList = document.getElementById('history-list');
        const historyItem = document.createElement('div');
        historyItem.className = `history-item ${result.operation === 'SubBytes' ? 'subbytes' : ''} current`;
        historyItem.textContent = `${result.operation} - Round ${result.round}`;
        
        // Remove 'current' class from other items
        document.querySelectorAll('.history-item').forEach(item => {
            item.classList.remove('current');
        });
        
        historyList.appendChild(historyItem);
        historyItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Clear step history
    clearStepHistory() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '<div class="history-item">No steps yet</div>';
    }

    // Clear state matrix
    clearStateMatrix() {
        const cells = document.querySelectorAll('.matrix-cell');
        cells.forEach(cell => {
            cell.textContent = '00';
            cell.classList.remove('changed', 'subbytes-highlight');
        });
    }

    // Update control buttons state
    updateControlButtons() {
        const startBtn = document.getElementById('sim-start');
        const nextBtn = document.getElementById('sim-next');
        const prevBtn = document.getElementById('sim-prev');
        
        if (this.isSimulationActive) {
            startBtn.disabled = true;
            nextBtn.disabled = this.visualizer ? this.visualizer.getStatus().isComplete : true;
            prevBtn.disabled = this.currentStepIndex <= 0;
        } else {
            startBtn.disabled = false;
            nextBtn.disabled = true;
            prevBtn.disabled = true;
        }
    }

    // Show encryption result when encryption is complete
    showEncryptionResult() {
        const inputs = this.getCurrentInputs();
        const isTextMode = document.getElementById('mode-text').classList.contains('active');
        const startTime = Date.now(); // In real implementation, track from start
        
        // Get final encrypted state
        const finalState = this.visualizer.exportState();
        const ciphertext = finalState.stateString;
        
        // Store for potential decryption
        this.lastEncryptionResult = {
            originalInputs: inputs,
            isTextMode: isTextMode,
            ciphertext: ciphertext,
            plaintextHex: inputs.plaintext,
            keyHex: inputs.key,
            timestamp: new Date().toISOString()
        };
        
        // Show results section
        const resultsSection = document.getElementById('encryption-results');
        resultsSection.style.display = 'block';
        
        // Update result displays
        if (isTextMode) {
            const originalText = document.getElementById('plaintext-text').value || 'Hello World!';
            document.getElementById('original-text').textContent = originalText;
        } else {
            document.getElementById('original-text').textContent = '(Hex input)';
        }
        
        document.getElementById('plaintext-hex').textContent = inputs.plaintext;
        document.getElementById('key-hex').textContent = inputs.key;
        document.getElementById('ciphertext-hex').textContent = ciphertext;
        document.getElementById('encryption-time').textContent = `< 1 second`;
    }

    // Copy ciphertext to clipboard
    copyCiphertext() {
        const ciphertext = document.getElementById('ciphertext-hex').textContent;
        navigator.clipboard.writeText(ciphertext).then(() => {
            const button = document.getElementById('copy-ciphertext');
            const originalText = button.textContent;
            button.textContent = '✅ Copied!';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy ciphertext. Please copy manually.');
        });
    }

    // Switch to decryption mode
    switchToDecryptionMode() {
        const decryptionSection = document.getElementById('decryption-section');
        decryptionSection.style.display = 'block';
        
        // Pre-fill with last encryption result if available
        if (this.lastEncryptionResult) {
            document.getElementById('ciphertext-input').value = this.lastEncryptionResult.ciphertext;
            document.getElementById('decrypt-key-input').value = this.lastEncryptionResult.keyHex;
        }
        
        // Scroll to decryption section
        decryptionSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Switch back to encryption mode
    switchToEncryptionMode() {
        const decryptionSection = document.getElementById('decryption-section');
        decryptionSection.style.display = 'none';
        
        const encryptionSection = document.getElementById('simulation-section');
        encryptionSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Start decryption process
    startDecryption() {
        try {
            const ciphertextHex = document.getElementById('ciphertext-input').value.trim();
            const keyHex = document.getElementById('decrypt-key-input').value.trim();
            
            if (!ciphertextHex || !keyHex) {
                alert('Please enter both ciphertext and key for decryption');
                return;
            }
            
            const ciphertext = this.parseHexString(ciphertextHex);
            const key = this.parseHexString(keyHex);
            
            if (!ciphertext || !key) {
                alert('Please enter valid hex values for ciphertext and key');
                return;
            }
            
            // Create new visualizer instance for decryption
            const customSBox = this.dashboard.currentSBox;
            const decryptVisualizer = new AESVisualizer(customSBox);
            
            // Perform complete decryption
            const startTime = Date.now();
            const decryptResult = decryptVisualizer.completeDecryption(ciphertext, key);
            const endTime = Date.now();
            
            // Show decryption result
            this.showDecryptionResult({
                ciphertextHex: ciphertextHex,
                decryptedHex: decryptResult.plaintextHex,
                decryptedText: decryptResult.plaintextText,
                decryptionTime: `${endTime - startTime} ms`
            });
            
        } catch (error) {
            console.error('Decryption error:', error);
            alert(`Error during decryption: ${error.message}`);
        }
    }

    // Show decryption result
    showDecryptionResult(result) {
        const resultSection = document.getElementById('decryption-result');
        resultSection.style.display = 'block';
        
        document.getElementById('decrypt-ciphertext-hex').textContent = result.ciphertextHex;
        document.getElementById('decrypted-hex').textContent = result.decryptedHex;
        document.getElementById('decrypted-text').textContent = result.decryptedText || '(Binary data)';
        document.getElementById('decryption-time').textContent = result.decryptionTime;
    }

    // Reset decryption form
    resetDecryption() {
        document.getElementById('ciphertext-input').value = '';
        document.getElementById('decrypt-key-input').value = '';
        document.getElementById('decryption-result').style.display = 'none';
    }

    // Save encryption result to file
    saveEncryptionResult() {
        if (!this.lastEncryptionResult) {
            alert('No encryption result to save');
            return;
        }
        
        const result = this.lastEncryptionResult;
        const data = {
            timestamp: result.timestamp,
            originalInputs: result.originalInputs,
            isTextMode: result.isTextMode,
            encryption: {
                plaintext: result.plaintextHex,
                key: result.keyHex,
                ciphertext: result.ciphertext
            },
            sboxType: this.dashboard.currentSBox ? 'custom' : 'standard'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aes-encryption-result-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Test encryption with explicit logging
}

// Initialize dashboard when DOM is loaded
let dashboard;
let simulationController;

document.addEventListener('DOMContentLoaded', () => {
    dashboard = new SBoxDashboard();
    simulationController = new AESSimulationController(dashboard);
    
    // Try to restore previous S-box from localStorage
    dashboard.loadSBoxFromStorage();
    
    console.log('S-Box Dashboard and AES Simulation initialized');
});

// Export utility functions for console access
window.sboxUtils = {
    export: (format) => dashboard.exportSBox(format),
    getCurrentSBox: () => dashboard.getCurrentSBox(),
    getStats: () => dashboard.getStatistics(),
    clear: () => dashboard.clearSBox(),
    generateRandom: () => dashboard.generateRandomSBox(),
    loadStandard: () => dashboard.loadStandardAESSBox(),
    runAnalysis: () => dashboard.runAnalysis(),
    exportAnalysis: () => dashboard.exportAnalysis(),
    clearAnalysis: () => dashboard.clearAnalysisResults()
};
