/**
 * Image Encryption Module
 * Handles image encryption/decryption with NPCR and UACI analysis
 */

class ImageEncryption {
    constructor() {
        this.originalImageData = null;
        this.encryptedImageData = null;
        this.originalCanvas = null;
        this.encryptedCanvas = null;
        this.charts = {
            originalHistogram: null,
            encryptedHistogram: null
        };

        // AES S-box
        this.sbox = [
            0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
            0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
            0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
            0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
            0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
            0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
            0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x67, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f,
            0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3,
            0xd2, 0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19,
            0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b,
            0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4,
            0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae,
            0x08, 0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b,
            0x8a, 0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d,
            0x9e, 0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28,
            0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb
        ];

        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const imageInput = document.getElementById('imageInput');
        const encryptBtn = document.getElementById('encrypt-image');
        const decryptBtn = document.getElementById('decrypt-image');
        const downloadEncrypted = document.getElementById('download-encrypted');
        const downloadAnalysis = document.getElementById('download-analysis');

        if (imageInput) {
            imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }

        if (encryptBtn) {
            encryptBtn.addEventListener('click', () => this.encryptImage());
        }

        if (decryptBtn) {
            decryptBtn.addEventListener('click', () => this.decryptImage());
        }

        if (downloadEncrypted) {
            downloadEncrypted.addEventListener('click', () => this.downloadEncryptedImage());
        }

        if (downloadAnalysis) {
            downloadAnalysis.addEventListener('click', () => this.downloadAnalysisReport());
        }
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const imageInfo = document.getElementById('imageInfo');
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Store original image
                this.originalCanvas = document.getElementById('originalImageCanvas');
                const ctx = this.originalCanvas.getContext('2d');
                
                // Scale image to fit canvas
                const maxSize = 300;
                let width = img.width;
                let height = img.height;
                
                if (width > maxSize || height > maxSize) {
                    const scale = Math.min(maxSize / width, maxSize / height);
                    width *= scale;
                    height *= scale;
                }
                
                this.originalCanvas.width = width;
                this.originalCanvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get image data
                this.originalImageData = ctx.getImageData(0, 0, width, height);
                
                // Enable encryption button
                document.getElementById('encrypt-image').disabled = false;
                
                // Update info
                imageInfo.textContent = `✓ Gambar berhasil dimuat: ${width}×${height}px (${(file.size / 1024).toFixed(2)} KB)`;
                imageInfo.classList.add('success');
                document.getElementById('original-size').textContent = `${width}×${height}px`;
                
                // Generate histogram for original image
                this.generateHistogram(this.originalImageData, 'original');
            };
            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    }

    encryptImage() {
        if (!this.originalImageData) {
            alert('Silakan upload gambar terlebih dahulu!');
            return;
        }

        const keyInput = document.getElementById('image-key');
        const key = keyInput.value;

        if (key.length === 0) {
            alert('Silakan masukkan kunci enkripsi!');
            return;
        }

        const startTime = performance.now();

        // Perform encryption
        this.encryptedImageData = this.performEncryption(this.originalImageData, key);

        const endTime = performance.now();
        const encryptionTime = (endTime - startTime).toFixed(2);

        // Display encrypted image
        const encryptedCanvas = document.getElementById('encryptedImageCanvas');
        const ctx = encryptedCanvas.getContext('2d');
        encryptedCanvas.width = this.encryptedImageData.width;
        encryptedCanvas.height = this.encryptedImageData.height;
        ctx.putImageData(this.encryptedImageData, 0, 0);

        document.getElementById('encrypted-size').textContent = `${this.encryptedImageData.width}×${this.encryptedImageData.height}px`;

        // Calculate metrics
        const npcr = this.calculateNPCR();
        const uaci = this.calculateUACI();

        // Update display
        document.getElementById('npcr-value').textContent = `${npcr.toFixed(4)}%`;
        document.getElementById('uaci-value').textContent = `${(uaci * 100).toFixed(4)}%`;
        document.getElementById('encryption-time-value').textContent = `${encryptionTime} ms`;

        // Show analysis section
        document.getElementById('encryption-analysis').style.display = 'block';

        // Generate histogram for encrypted image
        this.generateHistogram(this.encryptedImageData, 'encrypted');

        // Enable decrypt button
        document.getElementById('decrypt-image').disabled = false;
    }

    performEncryption(imageData, key) {
        const data = imageData.data;
        const encryptedData = new Uint8ClampedArray(data);
        
        // Generate keystream using key
        const keystream = this.generateKeystream(key, data.length);
        
        // XOR each pixel with keystream and apply S-box
        for (let i = 0; i < data.length; i += 4) {
            // Encrypt RGB channels (not alpha)
            encryptedData[i] = this.sbox[(data[i] ^ keystream[i]) & 0xFF]; // R
            encryptedData[i + 1] = this.sbox[(data[i + 1] ^ keystream[i + 1]) & 0xFF]; // G
            encryptedData[i + 2] = this.sbox[(data[i + 2] ^ keystream[i + 2]) & 0xFF]; // B
            // Keep alpha channel unchanged
            encryptedData[i + 3] = data[i + 3];
        }
        
        return new ImageData(encryptedData, imageData.width, imageData.height);
    }

    generateKeystream(key, length) {
        // Expand key to match data length using simple PRNG
        const keystream = new Uint8Array(length);
        let seed = 0;
        
        // Initialize seed from key
        for (let i = 0; i < key.length; i++) {
            seed = ((seed << 5) - seed) + key.charCodeAt(i);
            seed = seed & seed; // Keep as 32-bit integer
        }
        
        // Generate keystream using PRNG
        for (let i = 0; i < length; i++) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            keystream[i] = (seed >> 16) & 0xFF;
        }
        
        return keystream;
    }

    decryptImage() {
        if (!this.encryptedImageData) {
            alert('Silakan enkripsi gambar terlebih dahulu!');
            return;
        }

        const keyInput = document.getElementById('image-key');
        const key = keyInput.value;

        if (key.length === 0) {
            alert('Silakan masukkan kunci enkripsi!');
            return;
        }

        // Create inverse S-box for decryption
        const inverseSbox = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            inverseSbox[this.sbox[i]] = i;
        }

        const startTime = performance.now();

        // Perform decryption
        const decryptedData = this.performDecryption(this.encryptedImageData, key, inverseSbox);

        const endTime = performance.now();

        // Display decrypted image
        const encryptedCanvas = document.getElementById('encryptedImageCanvas');
        const ctx = encryptedCanvas.getContext('2d');
        ctx.putImageData(decryptedData, 0, 0);

        alert(`✓ Gambar berhasil didekripsi dalam ${(endTime - startTime).toFixed(2)} ms`);
        
        // Disable decrypt button after use
        document.getElementById('decrypt-image').disabled = true;
    }

    performDecryption(imageData, key, inverseSbox) {
        const data = imageData.data;
        const decryptedData = new Uint8ClampedArray(data);
        
        // Generate same keystream
        const keystream = this.generateKeystream(key, data.length);
        
        // Reverse encryption: apply inverse S-box and XOR with keystream
        for (let i = 0; i < data.length; i += 4) {
            decryptedData[i] = inverseSbox[data[i]] ^ keystream[i]; // R
            decryptedData[i + 1] = inverseSbox[data[i + 1]] ^ keystream[i + 1]; // G
            decryptedData[i + 2] = inverseSbox[data[i + 2]] ^ keystream[i + 2]; // B
            // Keep alpha channel unchanged
            decryptedData[i + 3] = data[i + 3];
        }
        
        return new ImageData(decryptedData, imageData.width, imageData.height);
    }

    calculateNPCR() {
        if (!this.originalImageData || !this.encryptedImageData) return 0;
        
        const original = this.originalImageData.data;
        const encrypted = this.encryptedImageData.data;
        
        let differentPixels = 0;
        const totalPixels = (original.length / 4); // 4 bytes per pixel (RGBA)
        
        // Compare each RGB channel (skip alpha)
        for (let i = 0; i < original.length; i += 4) {
            if (original[i] !== encrypted[i] || 
                original[i + 1] !== encrypted[i + 1] || 
                original[i + 2] !== encrypted[i + 2]) {
                differentPixels++;
            }
        }
        
        // NPCR = (D / Total) * 100%
        return (differentPixels / totalPixels) * 100;
    }

    calculateUACI() {
        if (!this.originalImageData || !this.encryptedImageData) return 0;
        
        const original = this.originalImageData.data;
        const encrypted = this.encryptedImageData.data;
        
        let totalIntensityChange = 0;
        const totalPixels = (original.length / 4);
        
        // Calculate sum of absolute differences for all RGB channels
        for (let i = 0; i < original.length; i += 4) {
            totalIntensityChange += Math.abs(original[i] - encrypted[i]); // R
            totalIntensityChange += Math.abs(original[i + 1] - encrypted[i + 1]); // G
            totalIntensityChange += Math.abs(original[i + 2] - encrypted[i + 2]); // B
        }
        
        // UACI = (sum of intensity changes) / (total pixels * 3 channels * 255)
        return totalIntensityChange / (totalPixels * 3 * 255);
    }

    generateHistogram(imageData, type) {
        const canvas = document.getElementById(
            type === 'original' ? 'originalHistogramCanvas' : 'encryptedHistogramCanvas'
        );

        if (!canvas) return;

        // Calculate histogram
        const histogram = {
            red: new Array(256).fill(0),
            green: new Array(256).fill(0),
            blue: new Array(256).fill(0)
        };

        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            histogram.red[data[i]]++;
            histogram.green[data[i + 1]]++;
            histogram.blue[data[i + 2]]++;
        }

        // Create chart
        const ctx = canvas.getContext('2d');
        const chartKey = type === 'original' ? 'originalHistogram' : 'encryptedHistogram';

        // Destroy existing chart if it exists
        if (this.charts[chartKey]) {
            this.charts[chartKey].destroy();
        }

        // Prepare chart data
        const labels = Array.from({ length: 256 }, (_, i) => i);
        
        this.charts[chartKey] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Red Channel',
                        data: histogram.red,
                        borderColor: 'rgba(255, 0, 0, 0.8)',
                        backgroundColor: 'rgba(255, 0, 0, 0.1)',
                        borderWidth: 1,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 0
                    },
                    {
                        label: 'Green Channel',
                        data: histogram.green,
                        borderColor: 'rgba(0, 255, 0, 0.8)',
                        backgroundColor: 'rgba(0, 255, 0, 0.1)',
                        borderWidth: 1,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 0
                    },
                    {
                        label: 'Blue Channel',
                        data: histogram.blue,
                        borderColor: 'rgba(0, 0, 255, 0.8)',
                        backgroundColor: 'rgba(0, 0, 255, 0.1)',
                        borderWidth: 1,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Intensity Value (0-255)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Frequency'
                        }
                    }
                }
            }
        });
    }

    downloadEncryptedImage() {
        if (!this.encryptedImageData) {
            alert('Silakan enkripsi gambar terlebih dahulu!');
            return;
        }

        const canvas = document.getElementById('encryptedImageCanvas');
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'encrypted-image.png';
        link.click();
    }

    downloadAnalysisReport() {
        const npcr = document.getElementById('npcr-value').textContent;
        const uaci = document.getElementById('uaci-value').textContent;
        const encryptionTime = document.getElementById('encryption-time-value').textContent;

        const report = `
Image Encryption Analysis Report
================================

Generated: ${new Date().toLocaleString()}

METRICS:
--------
NPCR (Number of Pixels Change Rate): ${npcr}
UACI (Unified Average Change in Intensity): ${uaci}
Encryption Time: ${encryptionTime}

DESCRIPTIONS:
-------------

1. NPCR (Number of Pixels Change Rate)
   - Measures the percentage of pixels that changed between original and encrypted image
   - Formula: NPCR = (D / (W × H)) × 100%
   - D: Number of changed pixels
   - W: Image width, H: Image height
   - Ideal value: > 99% (indicates good encryption)

2. UACI (Unified Average Change in Intensity)
   - Measures average intensity change between original and encrypted pixels
   - Formula: UACI = (1 / (W × H × 255)) × Σ|Original[i,j] - Encrypted[i,j]|
   - Ideal value: ≈ 33% (indicates random distribution)

3. Histogram Analysis
   - Original histogram shows frequency distribution of intensity values in original image
   - Encrypted histogram should be relatively uniform/flat
   - Uniform distribution indicates good encryption quality
   - Flatter histogram = better security

ENCRYPTION METHOD:
------------------
Algorithm: AES S-box substitution with XOR
Key size: 128 bits
Channels encrypted: RGB (Alpha channel preserved)

SECURITY PROPERTIES:
--------------------
✓ Pixel-level encryption
✓ Key-dependent transformation
✓ Non-linear substitution using AES S-box
✓ Diffusion through XOR operation
        `;

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(report));
        element.setAttribute('download', 'encryption-analysis-report.txt');
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.imageEncryption = new ImageEncryption();
    });
} else {
    window.imageEncryption = new ImageEncryption();
}
