/**
 * Seamless Loop Video Creator
 * 영상을 분석하여 가장 부드럽게 이어지는 구간을 찾아 루프 영상을 생성합니다.
 */

class SeamlessLoopCreator {
    constructor() {
        // DOM Elements
        this.uploadArea = document.getElementById('uploadArea');
        this.videoInput = document.getElementById('videoInput');
        this.uploadSection = document.getElementById('uploadSection');
        this.previewSection = document.getElementById('previewSection');
        this.analysisSection = document.getElementById('analysisSection');
        this.actionSection = document.getElementById('actionSection');

        this.originalVideo = document.getElementById('originalVideo');
        this.loopPreview = document.getElementById('loopPreview');
        this.frameCanvas = document.getElementById('frameCanvas');
        this.timelineCanvas = document.getElementById('timelineCanvas');

        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.progressContainer = document.getElementById('progressContainer');
        this.analysisResult = document.getElementById('analysisResult');

        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.createLoopBtn = document.getElementById('createLoopBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.resetBtn = document.getElementById('resetBtn');

        this.startSlider = document.getElementById('startSlider');
        this.endSlider = document.getElementById('endSlider');

        // State
        this.videoFile = null;
        this.videoUrl = null;
        this.videoDuration = 0;
        this.frames = [];
        this.similarityMatrix = [];
        this.bestLoop = { start: 0, end: 0, score: 0 };
        this.isAnalyzing = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];

        // Settings
        this.FRAME_SAMPLE_RATE = 4; // frames per second for analysis
        this.MIN_LOOP_DURATION = 1; // minimum loop duration in seconds
        this.MAX_LOOP_DURATION = 10; // maximum loop duration in seconds
        this.THUMBNAIL_SIZE = 64; // thumbnail size for comparison

        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Upload events
        this.uploadArea.addEventListener('click', () => this.videoInput.click());
        this.videoInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('drag-over');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('drag-over');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });

        // Video events
        this.originalVideo.addEventListener('loadedmetadata', () => this.onVideoLoaded());

        // Button events
        this.analyzeBtn.addEventListener('click', () => this.analyzeVideo());
        this.createLoopBtn.addEventListener('click', () => this.createLoopVideo());
        this.downloadBtn.addEventListener('click', () => this.downloadVideo());
        this.resetBtn.addEventListener('click', () => this.reset());

        // Slider events
        this.startSlider.addEventListener('input', (e) => this.onSliderChange(e, 'start'));
        this.endSlider.addEventListener('input', (e) => this.onSliderChange(e, 'end'));
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    handleFile(file) {
        // Validate file type
        const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (!validTypes.includes(file.type)) {
            alert('지원하지 않는 파일 형식입니다. MP4, WebM, MOV 파일만 지원합니다.');
            return;
        }

        // Validate file size (100MB)
        if (file.size > 100 * 1024 * 1024) {
            alert('파일 크기가 너무 큽니다. 100MB 이하의 파일만 지원합니다.');
            return;
        }

        this.videoFile = file;

        // Revoke previous URL if exists
        if (this.videoUrl) {
            URL.revokeObjectURL(this.videoUrl);
        }

        this.videoUrl = URL.createObjectURL(file);
        this.originalVideo.src = this.videoUrl;
        this.loopPreview.src = this.videoUrl;

        // Update file name display
        document.getElementById('fileName').textContent = file.name;
    }

    onVideoLoaded() {
        this.videoDuration = this.originalVideo.duration;

        // Update video info
        document.getElementById('videoDuration').textContent = this.formatTime(this.videoDuration);
        document.getElementById('videoResolution').textContent =
            `${this.originalVideo.videoWidth} x ${this.originalVideo.videoHeight}`;

        // Update timeline markers
        document.getElementById('timelineStart').textContent = '0:00';
        document.getElementById('timelineEnd').textContent = this.formatTime(this.videoDuration);

        // Setup sliders
        this.startSlider.max = this.videoDuration * 100;
        this.endSlider.max = this.videoDuration * 100;
        this.endSlider.value = this.videoDuration * 100;

        document.getElementById('startValue').textContent = '0:00';
        document.getElementById('endValue').textContent = this.formatTime(this.videoDuration);

        // Show sections
        this.uploadSection.classList.add('hidden');
        this.previewSection.classList.remove('hidden');
        this.previewSection.classList.add('fade-in');
        this.analysisSection.classList.remove('hidden');
        this.analysisSection.classList.add('fade-in');
        this.actionSection.classList.remove('hidden');
        this.actionSection.classList.add('fade-in');
    }

    async analyzeVideo() {
        if (this.isAnalyzing) return;
        this.isAnalyzing = true;

        this.analyzeBtn.disabled = true;
        this.analyzeBtn.innerHTML = '<span class="spinner"></span> 분석 중...';
        this.progressContainer.classList.remove('hidden');
        this.analysisResult.classList.add('hidden');

        try {
            // Step 1: Extract frames
            this.updateProgress(0, '프레임 추출 중...');
            this.frames = await this.extractFrames();

            // Step 2: Calculate similarity matrix
            this.updateProgress(40, '프레임 유사도 계산 중...');
            await this.calculateSimilarityMatrix();

            // Step 3: Find best loop points
            this.updateProgress(80, '최적 루프 구간 탐색 중...');
            this.bestLoop = this.findBestLoop();

            // Step 4: Draw timeline
            this.updateProgress(95, '결과 시각화 중...');
            this.drawTimeline();

            // Complete
            this.updateProgress(100, '분석 완료!');
            this.showResults();

        } catch (error) {
            console.error('Analysis error:', error);
            alert('영상 분석 중 오류가 발생했습니다.');
        } finally {
            this.isAnalyzing = false;
            this.analyzeBtn.disabled = false;
            this.analyzeBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                </svg>
                다시 분석
            `;
        }
    }

    async extractFrames() {
        const frames = [];
        const video = document.createElement('video');
        video.src = this.videoUrl;
        video.muted = true;

        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
        });

        const canvas = this.frameCanvas;
        const ctx = canvas.getContext('2d');
        canvas.width = this.THUMBNAIL_SIZE;
        canvas.height = this.THUMBNAIL_SIZE;

        const totalFrames = Math.floor(this.videoDuration * this.FRAME_SAMPLE_RATE);
        const interval = 1 / this.FRAME_SAMPLE_RATE;

        for (let i = 0; i < totalFrames; i++) {
            const time = i * interval;
            video.currentTime = time;

            await new Promise((resolve) => {
                video.onseeked = resolve;
            });

            // Draw frame to canvas
            ctx.drawImage(video, 0, 0, this.THUMBNAIL_SIZE, this.THUMBNAIL_SIZE);

            // Get image data
            const imageData = ctx.getImageData(0, 0, this.THUMBNAIL_SIZE, this.THUMBNAIL_SIZE);
            frames.push({
                time: time,
                data: this.extractFeatures(imageData)
            });

            // Update progress
            const progress = Math.floor((i / totalFrames) * 40);
            this.updateProgress(progress, `프레임 추출 중... (${i + 1}/${totalFrames})`);
        }

        return frames;
    }

    extractFeatures(imageData) {
        const data = imageData.data;
        const features = {
            histogram: new Array(256).fill(0),
            avgColor: { r: 0, g: 0, b: 0 },
            edges: 0
        };

        let totalR = 0, totalG = 0, totalB = 0;
        const pixelCount = data.length / 4;

        // Calculate histogram and average color
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Grayscale value for histogram
            const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
            features.histogram[gray]++;

            totalR += r;
            totalG += g;
            totalB += b;
        }

        features.avgColor.r = totalR / pixelCount;
        features.avgColor.g = totalG / pixelCount;
        features.avgColor.b = totalB / pixelCount;

        // Normalize histogram
        for (let i = 0; i < 256; i++) {
            features.histogram[i] /= pixelCount;
        }

        return features;
    }

    async calculateSimilarityMatrix() {
        const n = this.frames.length;
        this.similarityMatrix = [];

        for (let i = 0; i < n; i++) {
            this.similarityMatrix[i] = [];
            for (let j = 0; j < n; j++) {
                if (i === j) {
                    this.similarityMatrix[i][j] = 1;
                } else if (j < i) {
                    this.similarityMatrix[i][j] = this.similarityMatrix[j][i];
                } else {
                    this.similarityMatrix[i][j] = this.calculateSimilarity(
                        this.frames[i].data,
                        this.frames[j].data
                    );
                }
            }

            // Update progress
            const progress = 40 + Math.floor((i / n) * 40);
            this.updateProgress(progress, `유사도 계산 중... (${i + 1}/${n})`);

            // Yield to main thread
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    calculateSimilarity(features1, features2) {
        // Histogram comparison (Bhattacharyya coefficient)
        let histogramSim = 0;
        for (let i = 0; i < 256; i++) {
            histogramSim += Math.sqrt(features1.histogram[i] * features2.histogram[i]);
        }

        // Color similarity
        const colorDist = Math.sqrt(
            Math.pow(features1.avgColor.r - features2.avgColor.r, 2) +
            Math.pow(features1.avgColor.g - features2.avgColor.g, 2) +
            Math.pow(features1.avgColor.b - features2.avgColor.b, 2)
        );
        const colorSim = 1 - (colorDist / (255 * Math.sqrt(3)));

        // Combined similarity (weighted average)
        return 0.7 * histogramSim + 0.3 * colorSim;
    }

    findBestLoop() {
        const n = this.frames.length;
        const minFrames = Math.floor(this.MIN_LOOP_DURATION * this.FRAME_SAMPLE_RATE);
        const maxFrames = Math.floor(this.MAX_LOOP_DURATION * this.FRAME_SAMPLE_RATE);

        let bestScore = 0;
        let bestStart = 0;
        let bestEnd = n - 1;

        // Find best loop by comparing start and end frame similarities
        for (let duration = minFrames; duration <= Math.min(maxFrames, n - 1); duration++) {
            for (let start = 0; start <= n - duration - 1; start++) {
                const end = start + duration;

                // Calculate loop score based on:
                // 1. End frame to start frame similarity (most important)
                // 2. Transition smoothness (frames around the loop point)

                let score = this.similarityMatrix[end][start];

                // Add transition smoothness factor
                if (start > 0 && end < n - 1) {
                    const transitionScore = (
                        this.similarityMatrix[end][start] * 0.5 +
                        this.similarityMatrix[end - 1][start] * 0.25 +
                        this.similarityMatrix[end][start + 1] * 0.25
                    );
                    score = transitionScore;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestStart = start;
                    bestEnd = end;
                }
            }
        }

        return {
            start: this.frames[bestStart].time,
            end: this.frames[bestEnd].time,
            score: bestScore,
            startIndex: bestStart,
            endIndex: bestEnd
        };
    }

    drawTimeline() {
        const canvas = this.timelineCanvas;
        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth * 2;
        const height = canvas.height = 200;

        ctx.clearRect(0, 0, width, height);

        const n = this.frames.length;
        if (n < 2) return;

        // Draw similarity graph (similarity between consecutive frames and first frame)
        const similarities = [];
        for (let i = 0; i < n; i++) {
            similarities.push(this.similarityMatrix[i][0]); // Similarity to first frame
        }

        // Find min/max for normalization
        const minSim = Math.min(...similarities);
        const maxSim = Math.max(...similarities);
        const range = maxSim - minSim || 1;

        // Draw background gradient
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, 'rgba(99, 102, 241, 0.1)');
        bgGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

        // Draw area chart
        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * width;
            const normalizedSim = (similarities[i] - minSim) / range;
            const y = height - (normalizedSim * (height - 20));

            if (i === 0) {
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = bgGradient;
        ctx.fill();

        // Draw line
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const x = (i / (n - 1)) * width;
            const normalizedSim = (similarities[i] - minSim) / range;
            const y = height - (normalizedSim * (height - 20));

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw loop region
        const loopStartX = (this.bestLoop.startIndex / (n - 1)) * width;
        const loopEndX = (this.bestLoop.endIndex / (n - 1)) * width;

        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, height);

        // Draw loop markers
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(loopStartX, 0);
        ctx.lineTo(loopStartX, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(loopEndX, 0);
        ctx.lineTo(loopEndX, height);
        ctx.stroke();

        ctx.setLineDash([]);
    }

    showResults() {
        this.analysisResult.classList.remove('hidden');
        this.analysisResult.classList.add('fade-in');

        // Update loop info
        document.getElementById('loopStart').textContent = this.formatTime(this.bestLoop.start);
        document.getElementById('loopEnd').textContent = this.formatTime(this.bestLoop.end);
        document.getElementById('matchScore').textContent =
            Math.round(this.bestLoop.score * 100) + '%';

        // Update sliders
        this.startSlider.value = this.bestLoop.start * 100;
        this.endSlider.value = this.bestLoop.end * 100;
        document.getElementById('startValue').textContent = this.formatTime(this.bestLoop.start);
        document.getElementById('endValue').textContent = this.formatTime(this.bestLoop.end);

        // Show create button
        this.createLoopBtn.classList.remove('hidden');

        // Setup loop preview
        this.setupLoopPreview();
    }

    setupLoopPreview() {
        const start = this.bestLoop.start;
        const end = this.bestLoop.end;

        this.loopPreview.currentTime = start;
        this.loopPreview.play();

        // Create loop effect
        this.loopPreview.ontimeupdate = () => {
            if (this.loopPreview.currentTime >= end) {
                this.loopPreview.currentTime = start;
            }
        };
    }

    onSliderChange(e, type) {
        const value = parseFloat(e.target.value) / 100;

        if (type === 'start') {
            this.bestLoop.start = value;
            document.getElementById('startValue').textContent = this.formatTime(value);
            document.getElementById('loopStart').textContent = this.formatTime(value);

            // Ensure start < end
            if (value >= this.bestLoop.end - this.MIN_LOOP_DURATION) {
                this.bestLoop.start = this.bestLoop.end - this.MIN_LOOP_DURATION;
                this.startSlider.value = this.bestLoop.start * 100;
            }
        } else {
            this.bestLoop.end = value;
            document.getElementById('endValue').textContent = this.formatTime(value);
            document.getElementById('loopEnd').textContent = this.formatTime(value);

            // Ensure end > start
            if (value <= this.bestLoop.start + this.MIN_LOOP_DURATION) {
                this.bestLoop.end = this.bestLoop.start + this.MIN_LOOP_DURATION;
                this.endSlider.value = this.bestLoop.end * 100;
            }
        }

        // Update preview
        this.setupLoopPreview();

        // Recalculate similarity score for manual selection
        this.updateManualScore();
    }

    updateManualScore() {
        if (this.frames.length > 0) {
            const startIndex = Math.floor(this.bestLoop.start * this.FRAME_SAMPLE_RATE);
            const endIndex = Math.floor(this.bestLoop.end * this.FRAME_SAMPLE_RATE);

            if (startIndex < this.similarityMatrix.length &&
                endIndex < this.similarityMatrix.length) {
                const score = this.similarityMatrix[endIndex][startIndex];
                document.getElementById('matchScore').textContent =
                    Math.round(score * 100) + '%';
            }
        }
    }

    async createLoopVideo() {
        this.createLoopBtn.disabled = true;
        this.createLoopBtn.innerHTML = '<span class="spinner"></span> 생성 중...';

        try {
            // Use Canvas + MediaRecorder to create the loop video
            await this.recordLoop();

            this.downloadBtn.classList.remove('hidden');

        } catch (error) {
            console.error('Error creating loop:', error);
            alert('루프 영상 생성 중 오류가 발생했습니다.');
        } finally {
            this.createLoopBtn.disabled = false;
            this.createLoopBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 2l4 4-4 4"/>
                    <path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
                    <path d="M7 22l-4-4 4-4"/>
                    <path d="M21 13v1a4 4 0 0 1-4 4H3"/>
                </svg>
                루프 영상 재생성
            `;
        }
    }

    async recordLoop() {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.src = this.videoUrl;
            video.muted = true;

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                const stream = canvas.captureStream(30); // 30 FPS

                // Add audio track if exists
                if (this.originalVideo.captureStream) {
                    const audioStream = this.originalVideo.captureStream();
                    const audioTracks = audioStream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        stream.addTrack(audioTracks[0]);
                    }
                }

                const options = { mimeType: 'video/webm;codecs=vp9' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options.mimeType = 'video/webm';
                }

                this.mediaRecorder = new MediaRecorder(stream, options);
                this.recordedChunks = [];

                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        this.recordedChunks.push(e.data);
                    }
                };

                this.mediaRecorder.onstop = () => {
                    resolve();
                };

                this.mediaRecorder.onerror = reject;

                // Start recording
                this.mediaRecorder.start();

                // Record multiple loops for seamless effect
                const loopCount = 3;
                let currentLoop = 0;
                const loopDuration = this.bestLoop.end - this.bestLoop.start;

                video.currentTime = this.bestLoop.start;

                const drawFrame = () => {
                    if (video.currentTime >= this.bestLoop.end) {
                        currentLoop++;
                        if (currentLoop >= loopCount) {
                            this.mediaRecorder.stop();
                            return;
                        }
                        video.currentTime = this.bestLoop.start;
                    }

                    ctx.drawImage(video, 0, 0);
                    requestAnimationFrame(drawFrame);
                };

                video.onplay = () => {
                    drawFrame();
                };

                video.play();
            };

            video.onerror = reject;
        });
    }

    downloadVideo() {
        if (this.recordedChunks.length === 0) {
            alert('먼저 루프 영상을 생성해주세요.');
            return;
        }

        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `loop_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    }

    reset() {
        // Reset state
        this.videoFile = null;
        if (this.videoUrl) {
            URL.revokeObjectURL(this.videoUrl);
            this.videoUrl = null;
        }
        this.frames = [];
        this.similarityMatrix = [];
        this.bestLoop = { start: 0, end: 0, score: 0 };
        this.recordedChunks = [];

        // Reset videos
        this.originalVideo.src = '';
        this.loopPreview.src = '';
        this.loopPreview.ontimeupdate = null;

        // Reset UI
        this.uploadSection.classList.remove('hidden');
        this.previewSection.classList.add('hidden');
        this.analysisSection.classList.add('hidden');
        this.actionSection.classList.add('hidden');
        this.progressContainer.classList.add('hidden');
        this.analysisResult.classList.add('hidden');
        this.createLoopBtn.classList.add('hidden');
        this.downloadBtn.classList.add('hidden');

        // Reset progress
        this.updateProgress(0, '분석 준비 중...');

        // Reset input
        this.videoInput.value = '';

        // Reset analyze button
        this.analyzeBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
            </svg>
            분석 시작
        `;
    }

    updateProgress(percent, text) {
        this.progressFill.style.width = `${percent}%`;
        this.progressText.textContent = text;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 10);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new SeamlessLoopCreator();
});
