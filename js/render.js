import { MidiData } from "./parse.js";
import { playNotes } from "./play.js";
import { draw } from "./draw.js";

// Initialize workers used to draw our buffer images using offscreen canvasses
const drawWorker1 = new Worker("js/draw-worker.js", { type: "module" });
const drawWorker2 = new Worker("js/draw-worker.js", { type: "module" });

const mainCanvas = document.querySelector("#canvas");
const mainCtx = mainCanvas.getContext("2d");
var winW, winH, bufferW, bufferH, wasResized;

// Dynamically resize canvas on window resize
const resize = () => {
    winW = window.innerWidth;
    winH = window.innerHeight;
    bufferW = winW;
    bufferH = winH;
    mainCanvas.width = winW;
    mainCanvas.height = winH;
    wasResized = true;
}
resize();
window.addEventListener("resize", resize);

// Takes in arguments which are sent to the specified worker which runs the draw function of an offscreen canvas.
// Returns a promise which resolves to the output image once the worker has finished.
function drawWorkerWrapper(drawWorker, bufferW, bufferH, time, startX, endX, minY, maxY, pxPerSec, showRift = false, riftEnd = 0, riftPixels = 0) {
    let promise = new Promise((resolve, reject) => {
        drawWorker.onmessage = function (e) {
            resolve(e.data);
        }
    });
    // We slice off the first argument, which is just the worker to be used
    drawWorker.postMessage([...arguments].slice(1));
    return promise;
}

// Play and display midi file from binary data
export function play(midiFile) {
    let midiData = new MidiData(midiFile, 0.2);
    // Ugly, but gets the job done
    const midiDataTransferrable = JSON.parse(JSON.stringify(midiData));
    // Sends the midi data to the workers so that they can have it on hand when needed
    drawWorker1.postMessage([midiDataTransferrable]);
    drawWorker2.postMessage([midiDataTransferrable]);

    // Starts playing the notes using Tone.js
    playNotes(midiData.cleanMidi);
    let start = performance.now() / 1000, time;

    let riftPixels, riftStart, riftEnd, riftLength;
    let minY, maxY, pxPerSec;
    let bufferTime = 0, bufferTimeTemp, drawingBuffer = false, bufferDuration, bufferImage1 = null, bufferImage2 = null;
    let blurSafetyPixels = 100;

    // Runs every frame. Only draws the very beginning each frame. The rest is pre-rendered periodically and scrolled
    // past using buffer images, which are rendered in an offscreen canvas using web workers.
    async function drawAnimation() {
        mainCtx.clearRect(0, 0, winW, winH);
        time = performance.now() / 1000 - start;

        // Window was resized
        if (wasResized) {
            wasResized = false;

            // Updates all variables that rely on the dimensions
            pxPerSec = winH / 6;
            bufferDuration = bufferW / pxPerSec;
            riftPixels = Math.max(1, Math.round(0.15 * pxPerSec));
            riftEnd = Math.round(Math.max(winW - winH / 3, winW * 0.8));
            riftStart = Math.max(0, riftEnd - riftPixels - blurSafetyPixels);
            riftLength = riftEnd - riftStart;
            minY = 0.2 * winH;
            maxY = 0.8 * winH;

            // Resets the buffer time and renders everything that would already be on shown the screen. We set the
            // respective image variables to null so that we don't see a bunch of glitchiness while resizing.
            bufferTime = time - time % bufferDuration;
            bufferImage1 = null;
            drawWorkerWrapper(drawWorker1, bufferW, bufferH, bufferTime, 0 - blurSafetyPixels, bufferW + blurSafetyPixels, minY, maxY, pxPerSec, false, bufferW, 0, 0, 0)
                .then((newImage) => {
                    bufferImage1 = newImage;
                });
            bufferTime += bufferDuration;
            bufferImage2 = null;
            drawWorkerWrapper(drawWorker2, bufferW, bufferH, bufferTime, 0 - blurSafetyPixels, bufferW + blurSafetyPixels, minY, maxY, pxPerSec, false, bufferW, 0, 0, 0)
                .then((newImage) => {
                    bufferImage2 = newImage;
                });

            // We need to render the new buffer before it creeps onscreen
        } else if (!drawingBuffer && bufferTime < time) {
            // Increase/quantize the buffer time (we use a temp variable before committing to it so that movement
            // remains smooth while rendering, and the time only makes a jump when the buffers are in place)
            bufferTimeTemp = time - time % bufferDuration + bufferDuration;
            drawingBuffer = true;
            // Render the new buffer, then move the old buffer forward and put the new one in its place
            drawWorkerWrapper(drawWorker1, bufferW, bufferH, bufferTimeTemp, 0 - blurSafetyPixels, bufferW + blurSafetyPixels, minY, maxY, pxPerSec, false, bufferW, 0, 0, 0)
                .then((newImage) => {
                    bufferImage1 = bufferImage2;
                    bufferImage2 = newImage;
                    bufferTime = bufferTimeTemp;
                    drawingBuffer = false;
                });
        }

        // Draw the "rift", which is the section with extra effects where the notes first appear
        draw(midiData, mainCtx, time, riftStart - blurSafetyPixels, riftEnd, minY, maxY, pxPerSec, true, riftEnd, riftPixels, 0);

        // Blit the two buffer images if we can
        let renderW = (time - bufferTime + bufferDuration * 2) * pxPerSec - riftLength;
        if (renderW > 0 && bufferImage1 != null)
            mainCtx.drawImage(bufferImage1, 0, 0, renderW, bufferH, riftStart - renderW, 0, renderW, bufferH);
        renderW = (time - bufferTime + bufferDuration) * pxPerSec - riftLength;
        if (renderW > 0 && bufferImage2 != null)
            mainCtx.drawImage(bufferImage2, 0, 0, renderW, bufferH, riftStart - renderW, 0, renderW, bufferH);

        requestAnimationFrame(drawAnimation);
    }

    requestAnimationFrame(drawAnimation);
}