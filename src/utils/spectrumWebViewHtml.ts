/**
 * Generates the HTML content for the live spectrum capture WebView.
 *
 * The WebView uses getUserMedia for camera access and OpenCV.js for
 * real-time frame processing. It renders a live spectrum graph overlay
 * and a frame stability indicator.
 */
export function generateSpectrumHtml(config: {
  primaryGreen: string;
  darkGreen: string;
  rose: string;
  orange: string;
  white: string;
  stepLabel: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=no,maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: -apple-system, sans-serif; }

    #container { position: relative; width: 100%; height: 100%; }

    video {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Hidden canvas for frame extraction */
    #processingCanvas { display: none; }

    /* Spectrum graph overlay */
    #spectrumCanvas {
      position: absolute;
      bottom: 150px; left: 8px; right: 8px;
      width: calc(100% - 16px);
      height: 130px;
      border-radius: 10px;
    }

    /* Band energy chart overlay */
    #bandCanvas {
      position: absolute;
      bottom: 80px; left: 8px; right: 8px;
      width: calc(100% - 16px);
      height: 64px;
      border-radius: 10px;
    }

    /* Stability bar */
    #stabilityBar {
      position: absolute;
      top: 10px; left: 10px; right: 10px;
      height: 28px;
      background: rgba(0,0,0,0.5);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      align-items: center;
    }
    #stabilityFill {
      height: 100%;
      width: 0%;
      border-radius: 14px;
      transition: width 0.15s ease, background-color 0.3s ease;
      background-color: ${config.rose};
    }
    #stabilityText {
      position: absolute;
      width: 100%;
      text-align: center;
      color: ${config.white};
      font-size: 11px;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }

    /* Step label */
    #stepLabel {
      position: absolute;
      top: 46px; left: 10px;
      color: ${config.white};
      font-size: 12px;
      font-weight: 600;
      background: rgba(0,0,0,0.45);
      padding: 4px 10px;
      border-radius: 8px;
    }

    /* Live indicator */
    #liveIndicator {
      position: absolute;
      top: 46px; right: 10px;
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(0,0,0,0.45);
      padding: 4px 10px;
      border-radius: 8px;
    }
    #liveDot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: ${config.rose};
      animation: livePulse 1.2s infinite;
    }
    #liveText {
      color: ${config.white};
      font-size: 11px;
      font-weight: 700;
    }
    @keyframes livePulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Capture button */
    #captureBtn {
      position: absolute;
      bottom: 14px;
      left: 50%;
      transform: translateX(-50%);
      width: 60px; height: 60px;
      border-radius: 50%;
      border: 3px solid ${config.primaryGreen};
      background: rgba(255,255,255,0.92);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
    }
    #captureBtn:disabled {
      opacity: 0.35;
      border-color: #666;
    }
    #captureBtn svg { width: 28px; height: 28px; }

    /* Loading overlay */
    #loadingOverlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: ${config.primaryGreen};
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loadingText {
      color: ${config.white};
      margin-top: 14px;
      font-size: 13px;
      font-weight: 500;
    }

    /* Error overlay */
    #errorOverlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    #errorText {
      color: ${config.white};
      font-size: 13px;
      text-align: center;
      padding: 0 20px;
      margin-bottom: 16px;
    }
    #retryBtn {
      background: ${config.primaryGreen};
      color: ${config.white};
      border: none;
      padding: 10px 28px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="container">
    <video id="video" autoplay playsinline muted></video>
    <canvas id="processingCanvas"></canvas>
    <canvas id="spectrumCanvas"></canvas>
    <canvas id="bandCanvas"></canvas>

    <div id="stabilityBar">
      <div id="stabilityFill"></div>
      <span id="stabilityText">Stability: --</span>
    </div>

    <div id="stepLabel">${config.stepLabel}</div>

    <div id="liveIndicator">
      <div id="liveDot"></div>
      <span id="liveText">LIVE</span>
    </div>

    <button id="captureBtn" disabled>
      <svg viewBox="0 0 24 24" fill="none" stroke="${config.primaryGreen}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="4" fill="${config.primaryGreen}"/>
      </svg>
    </button>

    <div id="loadingOverlay">
      <div class="spinner"></div>
      <p id="loadingText">Loading OpenCV.js...</p>
    </div>

    <div id="errorOverlay">
      <p id="errorText"></p>
      <button id="retryBtn">Retry</button>
    </div>
  </div>

  <script>
    // === Configuration ===
    var PROCESS_INTERVAL = 100;
    var STABILITY_THRESHOLD = 80;
    var GAMMA_FACTOR = 2.2;
    var MIN_WAVELENGTH = 400;
    var MAX_WAVELENGTH = 700;
    var X_MIN = 50;
    var SMOOTH_KERNEL_SIZE = 9;
    var WHITE_THRESHOLD = 0.98;
    var BANDS = {
      "Violet": [400, 450],
      "Blue": [450, 495],
      "Green": [495, 570],
      "Yellow": [570, 590],
      "Orange": [590, 620],
      "Red": [620, 700]
    };
    var BAND_COLORS = {
      "Violet": "#8B00FF",
      "Blue": "#0066FF",
      "Green": "#00CC44",
      "Yellow": "#FFD700",
      "Orange": "#FF8C00",
      "Red": "#FF2200"
    };

    // === DOM refs ===
    var video = document.getElementById('video');
    var processingCanvas = document.getElementById('processingCanvas');
    var spectrumCanvas = document.getElementById('spectrumCanvas');
    var bandCanvas = document.getElementById('bandCanvas');
    var stabilityFill = document.getElementById('stabilityFill');
    var stabilityText = document.getElementById('stabilityText');
    var captureBtn = document.getElementById('captureBtn');
    var loadingOverlay = document.getElementById('loadingOverlay');
    var loadingTextEl = document.getElementById('loadingText');
    var errorOverlay = document.getElementById('errorOverlay');
    var errorText = document.getElementById('errorText');
    var retryBtn = document.getElementById('retryBtn');

    // === State ===
    var previousSpectrum = null;
    var currentSpectrum = null;
    var currentWavelength = null;
    var currentBandEnergy = null;
    var stabilityPercent = 0;
    var lastProcessTime = 0;
    var cvReady = false;
    var running = false;

    // === Messaging ===
    function postMsg(payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    // === OpenCV loading ===
    var cvLoadTimeout = setTimeout(function() {
      if (!cvReady) showError('OpenCV.js took too long to load. Check your internet connection.');
    }, 20000);

    function onOpenCvReady() {
      if (typeof cv === 'undefined') return;
      if (cv.Mat) {
        finishCvLoad();
      } else if (cv.onRuntimeInitialized !== undefined) {
        cv.onRuntimeInitialized = finishCvLoad;
      } else {
        // Fallback: poll
        var poll = setInterval(function() {
          if (typeof cv !== 'undefined' && cv.Mat) {
            clearInterval(poll);
            finishCvLoad();
          }
        }, 100);
      }
    }

    function finishCvLoad() {
      clearTimeout(cvLoadTimeout);
      cvReady = true;
      loadingTextEl.textContent = 'Starting camera...';
      postMsg({ type: 'opencv_ready' });
      initCamera();
    }

    function onOpenCvError() {
      clearTimeout(cvLoadTimeout);
      showError('Failed to load OpenCV.js. Please check your internet connection.');
    }

    function showError(msg) {
      loadingOverlay.style.display = 'none';
      errorOverlay.style.display = 'flex';
      errorText.textContent = msg;
      postMsg({ type: 'error', message: msg });
    }

    retryBtn.addEventListener('click', function() {
      errorOverlay.style.display = 'none';
      loadingOverlay.style.display = 'flex';
      loadingTextEl.textContent = 'Retrying...';
      // Reload OpenCV
      var old = document.getElementById('opencv-script');
      if (old) old.remove();
      var s = document.createElement('script');
      s.id = 'opencv-script';
      s.src = 'https://docs.opencv.org/4.x/opencv.js';
      s.async = true;
      s.onload = function() { onOpenCvReady(); };
      s.onerror = function() { onOpenCvError(); };
      document.body.appendChild(s);
      cvLoadTimeout = setTimeout(function() {
        if (!cvReady) showError('OpenCV.js took too long to load.');
      }, 20000);
    });

    // === mediaDevices polyfill for older WebView environments ===
    (function() {
      if (navigator.mediaDevices === undefined) {
        navigator.mediaDevices = {};
      }
      if (navigator.mediaDevices.getUserMedia === undefined) {
        navigator.mediaDevices.getUserMedia = function(constraints) {
          var legacyGetUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.getUserMedia;
          if (!legacyGetUserMedia) {
            return Promise.reject(new Error('getUserMedia is not supported in this WebView.'));
          }
          return new Promise(function(resolve, reject) {
            legacyGetUserMedia.call(navigator, constraints, resolve, reject);
          });
        };
      }
    })();

    // === Camera ===
    async function initCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          showError('Camera API not available. This WebView does not support camera access.');
          return;
        }
        var stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        video.srcObject = stream;
        await video.play();
        video.onloadedmetadata = function() {
          processingCanvas.width = video.videoWidth;
          processingCanvas.height = video.videoHeight;
          var container = document.getElementById('container');
          spectrumCanvas.width = container.clientWidth - 16;
          spectrumCanvas.height = 130;
          bandCanvas.width = container.clientWidth - 16;
          bandCanvas.height = 64;
          loadingOverlay.style.display = 'none';
          running = true;
          captureBtn.disabled = false;
          postMsg({ type: 'camera_ready' });
          requestAnimationFrame(processLoop);
        };
        // Trigger if metadata already loaded
        if (video.readyState >= 1) {
          video.onloadedmetadata();
        }
      } catch (err) {
        showError('Camera access failed: ' + (err.message || 'Unknown error') + '. Ensure camera permissions are granted.');
      }
    }

    // === Processing loop ===
    function processLoop(timestamp) {
      if (!running) return;
      requestAnimationFrame(processLoop);
      if (timestamp - lastProcessTime < PROCESS_INTERVAL) return;
      lastProcessTime = timestamp;

      var pCtx = processingCanvas.getContext('2d');
      pCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);
      var imageData = pCtx.getImageData(0, 0, processingCanvas.width, processingCanvas.height);

      var src;
      try {
        src = cv.matFromImageData(imageData);
        var rows = src.rows;
        var cols = src.cols;
        var data = src.data; // Uint8ClampedArray [R,G,B,A, R,G,B,A, ...]

        // =============================================
        // 1. GAMMA CORRECTION + NORMALIZE TO [0,1]
        // =============================================
        // Build a gamma LUT for speed (maps 0-255 → 0.0-1.0 with gamma)
        var gammaLUT = new Float32Array(256);
        for (var v = 0; v < 256; v++) {
          gammaLUT[v] = Math.pow(v / 255.0, GAMMA_FACTOR);
        }

        // =============================================
        // 2. WHITE REMOVAL + INTENSITY CALCULATION
        // Compute per-pixel grayscale intensity, zeroing white pixels
        // =============================================
        var intensity = new Float32Array(rows * cols);
        for (var row = 0; row < rows; row++) {
          for (var col = 0; col < cols; col++) {
            var idx = (row * cols + col) * 4;
            var rLin = gammaLUT[data[idx]];
            var gLin = gammaLUT[data[idx + 1]];
            var bLin = gammaLUT[data[idx + 2]];

            // White pixel check
            if (rLin > WHITE_THRESHOLD && gLin > WHITE_THRESHOLD && bLin > WHITE_THRESHOLD) {
              intensity[row * cols + col] = 0;
            } else {
              // Luminance weighted grayscale
              intensity[row * cols + col] = rLin * 0.2989 + gLin * 0.5870 + bLin * 0.1140;
            }
          }
        }

        // =============================================
        // 3. COLLAPSE 2D → 1D (sum each column across all rows)
        // =============================================
        var rawSpectrum = new Float32Array(cols);
        for (var col = 0; col < cols; col++) {
          var colSum = 0;
          for (var row = 0; row < rows; row++) {
            colSum += intensity[row * cols + col];
          }
          rawSpectrum[col] = colSum;
        }

        // Normalize
        var maxVal = 0;
        for (var i = 0; i < cols; i++) {
          if (rawSpectrum[i] > maxVal) maxVal = rawSpectrum[i];
        }
        if (maxVal > 0) {
          for (var i = 0; i < cols; i++) {
            rawSpectrum[i] /= maxVal;
          }
        }

        // =============================================
        // 4. SMOOTH (1D moving average convolution)
        // =============================================
        var half = Math.floor(SMOOTH_KERNEL_SIZE / 2);
        var smoothed = new Float32Array(cols);
        for (var i = 0; i < cols; i++) {
          var sum = 0;
          var count = 0;
          for (var k = -half; k <= half; k++) {
            var j = i + k;
            if (j >= 0 && j < cols) {
              sum += rawSpectrum[j];
              count++;
            }
          }
          smoothed[i] = sum / count;
        }

        // =============================================
        // 5. CALIBRATE WAVELENGTH (pixel → nm)
        // Linear mapping: pixel X_MIN → 400nm, pixel (cols-X_MIN) → 700nm
        // =============================================
        var xMax = cols - X_MIN;
        var wavelengthScale = (MAX_WAVELENGTH - MIN_WAVELENGTH) / (xMax - X_MIN);
        var wavelengthArr = [];
        var spectrumArr = [];

        for (var i = 0; i < cols; i++) {
          var wl = (i - X_MIN) * wavelengthScale + MIN_WAVELENGTH;
          if (wl >= MIN_WAVELENGTH && wl <= MAX_WAVELENGTH) {
            wavelengthArr.push(wl);
            spectrumArr.push(smoothed[i]);
          }
        }

        // =============================================
        // 6. COMPUTE BAND ENERGY
        // =============================================
        var bandEnergy = {};
        var totalEnergy = 0;
        for (var band in BANDS) {
          var lo = BANDS[band][0];
          var hi = BANDS[band][1];
          var energy = 0;
          for (var i = 0; i < wavelengthArr.length; i++) {
            if (wavelengthArr[i] >= lo && wavelengthArr[i] < hi) {
              energy += spectrumArr[i];
            }
          }
          bandEnergy[band] = energy;
          totalEnergy += energy;
        }
        if (totalEnergy > 0) {
          for (var band in bandEnergy) {
            bandEnergy[band] /= totalEnergy;
          }
        }

        // =============================================
        // STABILITY CALCULATION (on calibrated spectrum)
        // =============================================
        if (previousSpectrum && previousSpectrum.length === spectrumArr.length) {
          var diffSum = 0;
          for (var i = 0; i < spectrumArr.length; i++) {
            diffSum += Math.abs(spectrumArr[i] - previousSpectrum[i]);
          }
          var meanDiff = diffSum / spectrumArr.length;
          stabilityPercent = Math.max(0, Math.min(100, Math.round((1 - meanDiff * 10) * 100)));
        } else {
          stabilityPercent = 0;
        }
        previousSpectrum = spectrumArr.slice();
        currentSpectrum = spectrumArr;
        currentWavelength = wavelengthArr;
        currentBandEnergy = bandEnergy;

        updateStabilityUI();
        drawSpectrumGraph(wavelengthArr, spectrumArr);
        drawBandChart(bandEnergy);

      } catch (e) {
        // Silently skip frame on error
      } finally {
        if (src) src.delete();
      }
    }

    // === Stability UI ===
    function updateStabilityUI() {
      stabilityFill.style.width = stabilityPercent + '%';
      stabilityText.textContent = 'Stability: ' + stabilityPercent + '%';
      if (stabilityPercent >= STABILITY_THRESHOLD) {
        stabilityFill.style.backgroundColor = '${config.primaryGreen}';
      } else if (stabilityPercent >= 60) {
        stabilityFill.style.backgroundColor = '${config.orange}';
      } else {
        stabilityFill.style.backgroundColor = '${config.rose}';
      }
    }

    // === Spectrum graph drawing (wavelength-calibrated) ===
    function drawSpectrumGraph(wavelength, spectrum) {
      var ctx = spectrumCanvas.getContext('2d');
      var W = spectrumCanvas.width;
      var H = spectrumCanvas.height;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      roundRect(ctx, 0, 0, W, H, 10);
      ctx.fill();

      var padL = 36, padR = 14, padT = 20, padB = 22;
      var plotW = W - padL - padR;
      var plotH = H - padT - padB;
      var yMax = 1.1;

      // Gridlines
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 0.5;
      var gridTicks = [0.25, 0.5, 0.75, 1.0];
      for (var gi = 0; gi < gridTicks.length; gi++) {
        var gy = padT + plotH - (gridTicks[gi] / yMax) * plotH;
        ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + plotW, gy); ctx.stroke();
      }

      // Y axis labels
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('1.0', padL - 4, padT + plotH - (1.0 / yMax) * plotH + 3);
      ctx.fillText('0.5', padL - 4, padT + plotH - (0.5 / yMax) * plotH + 3);
      ctx.fillText('0.0', padL - 4, padT + plotH + 3);

      // X axis wavelength labels
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      var wlTicks = [400, 450, 500, 550, 600, 650, 700];
      for (var wi = 0; wi < wlTicks.length; wi++) {
        var xFrac = (wlTicks[wi] - MIN_WAVELENGTH) / (MAX_WAVELENGTH - MIN_WAVELENGTH);
        var xPos = padL + xFrac * plotW;
        ctx.fillText(wlTicks[wi] + '', xPos, padT + plotH + 14);
        // Vertical gridline
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.moveTo(xPos, padT); ctx.lineTo(xPos, padT + plotH); ctx.stroke();
      }

      // Spectrum line colored by wavelength
      if (wavelength.length > 1) {
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        for (var i = 1; i < wavelength.length; i++) {
          var xFrac0 = (wavelength[i-1] - MIN_WAVELENGTH) / (MAX_WAVELENGTH - MIN_WAVELENGTH);
          var xFrac1 = (wavelength[i] - MIN_WAVELENGTH) / (MAX_WAVELENGTH - MIN_WAVELENGTH);
          var x0 = padL + xFrac0 * plotW;
          var x1 = padL + xFrac1 * plotW;
          var y0 = padT + plotH - (Math.min(spectrum[i-1], yMax) / yMax) * plotH;
          var y1 = padT + plotH - (Math.min(spectrum[i], yMax) / yMax) * plotH;
          ctx.strokeStyle = wavelengthToColor(wavelength[i]);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }

      // Graph title
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '600 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Intensity vs Wavelength (nm)', padL, padT - 7);
    }

    // === Band energy bar chart ===
    function drawBandChart(bandEnergy) {
      var ctx = bandCanvas.getContext('2d');
      var W = bandCanvas.width;
      var H = bandCanvas.height;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      roundRect(ctx, 0, 0, W, H, 10);
      ctx.fill();

      var padL = 8, padR = 8, padT = 16, padB = 14;
      var plotW = W - padL - padR;
      var plotH = H - padT - padB;

      var bandNames = Object.keys(bandEnergy);
      var numBands = bandNames.length;
      if (numBands === 0) return;

      var barGap = 4;
      var barW = (plotW - barGap * (numBands - 1)) / numBands;

      // Find max for scaling
      var maxE = 0;
      for (var b = 0; b < numBands; b++) {
        if (bandEnergy[bandNames[b]] > maxE) maxE = bandEnergy[bandNames[b]];
      }
      if (maxE === 0) maxE = 1;

      for (var b = 0; b < numBands; b++) {
        var name = bandNames[b];
        var val = bandEnergy[name];
        var barH = (val / maxE) * plotH;
        var x = padL + b * (barW + barGap);
        var y = padT + plotH - barH;

        ctx.fillStyle = BAND_COLORS[name] || '#888';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y, barW, barH);
        ctx.globalAlpha = 1.0;

        // Band label
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(name.substring(0, 3), x + barW / 2, padT + plotH + 11);

        // Value on top
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '7px sans-serif';
        ctx.fillText((val * 100).toFixed(0) + '%', x + barW / 2, y - 2);
      }

      // Chart title
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '600 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Band Energy', padL, padT - 4);
    }

    // === Convert wavelength (nm) to visible color ===
    function wavelengthToColor(wl) {
      var r = 0, g = 0, b = 0;
      if (wl >= 380 && wl < 440) {
        r = -(wl - 440) / 60; g = 0; b = 1;
      } else if (wl >= 440 && wl < 490) {
        r = 0; g = (wl - 440) / 50; b = 1;
      } else if (wl >= 490 && wl < 510) {
        r = 0; g = 1; b = -(wl - 510) / 20;
      } else if (wl >= 510 && wl < 580) {
        r = (wl - 510) / 70; g = 1; b = 0;
      } else if (wl >= 580 && wl < 645) {
        r = 1; g = -(wl - 645) / 65; b = 0;
      } else if (wl >= 645 && wl <= 780) {
        r = 1; g = 0; b = 0;
      }
      // Intensity falloff at edges
      var factor = 1.0;
      if (wl >= 380 && wl < 420) factor = 0.3 + 0.7 * (wl - 380) / 40;
      else if (wl >= 645 && wl <= 780) factor = 0.3 + 0.7 * (780 - wl) / 135;
      r = Math.round(255 * r * factor);
      g = Math.round(255 * g * factor);
      b = Math.round(255 * b * factor);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // === Capture ===
    function doCapture() {
      if (!currentSpectrum || captureBtn.disabled) return;
      running = false;
      captureBtn.disabled = true;

      // Release the camera track NOW, before notifying React Native.
      // This ensures:
      //   a) resetForNextStep always calls initCamera() (which re-enables the
      //      button and restarts the loop) rather than the stale-stream branch.
      //   b) When the last step completes and LiveSpectrumCapture unmounts,
      //      the track is already gone so the leaf-image CameraView can open
      //      immediately without a hardware conflict.
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(function(t) { t.stop(); });
        video.srcObject = null;
      }

      postMsg({
        type: 'spectrum_captured',
        data: currentSpectrum,
        wavelength: currentWavelength,
        bandEnergy: currentBandEnergy
      });
    }

    captureBtn.addEventListener('click', doCapture);

    // === Reset for next step (called from React Native via injectJavaScript) ===
    window.resetForNextStep = function(newLabel) {
      // Reset spectrum state
      previousSpectrum = null;
      currentSpectrum = null;
      currentWavelength = null;
      currentBandEnergy = null;
      stabilityPercent = 0;
      lastProcessTime = 0;

      // Update step label
      document.getElementById('stepLabel').textContent = newLabel;

      // Reset stability UI
      stabilityFill.style.width = '0%';
      stabilityText.textContent = 'Stability: --';
      stabilityFill.style.backgroundColor = '${config.rose}';

      // Clear spectrum graph and band chart
      var ctx = spectrumCanvas.getContext('2d');
      ctx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
      var bCtx = bandCanvas.getContext('2d');
      bCtx.clearRect(0, 0, bandCanvas.width, bandCanvas.height);

      // Restart processing loop if camera is still running
      if (video.srcObject && video.srcObject.active) {
        running = true;
        requestAnimationFrame(processLoop);
      } else {
        // Camera was stopped, reinitialize
        initCamera();
      }
    };

    // === Stop camera completely (called from React Native on close) ===
    window.stopCamera = function() {
      running = false;
      if (video.srcObject) {
        video.srcObject.getTracks().forEach(function(t) { t.stop(); });
      }
    };

    // === Cleanup on unload ===
    window.addEventListener('beforeunload', function() {
      window.stopCamera();
    });
  </script>
  <script id="opencv-script" async
    src="https://docs.opencv.org/4.x/opencv.js"
    onload="onOpenCvReady()"
    onerror="onOpenCvError()">
  </script>
</body>
</html>`;
}
